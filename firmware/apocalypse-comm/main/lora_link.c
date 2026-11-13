// LoRa drivers (register level): SX1276/RFM95 or SX1262 (Seeed Wio-SX1262).
// Settings: SF9, 125 kHz, CR 4/5, sync 0x12 -> roughly 2-10 km line of sight.
#include <string.h>
#include "sdkconfig.h"
#include "app.h"
#include "links.h"

#if !CONFIG_LORA_ENABLE

void lora_link_init(void) {}
bool lora_link_send(const uint8_t *d, int l) { return false; }
bool lora_link_present(void) { return false; }
int  lora_link_last_rssi(void) { return 0; }

#elif CONFIG_LORA_SX1276

#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "comm.h"
#include "leds.h"

static const char *TAG = "lora";
static spi_device_handle_t s_spi;
static bool s_present;
static int s_rssi;
static QueueHandle_t s_txq;

typedef struct { uint8_t len; uint8_t data[255]; } lora_pkt_t;

enum {
    REG_FIFO = 0x00, REG_OPMODE = 0x01, REG_FRF_MSB = 0x06, REG_PA_CONFIG = 0x09, REG_OCP = 0x0B,
    REG_LNA = 0x0C, REG_FIFO_PTR = 0x0D, REG_FIFO_TX_BASE = 0x0E, REG_FIFO_RX_BASE = 0x0F,
    REG_FIFO_RX_CUR = 0x10, REG_IRQ = 0x12, REG_RX_NB = 0x13, REG_PKT_SNR = 0x19, REG_PKT_RSSI = 0x1A,
    REG_MODEM1 = 0x1D, REG_MODEM2 = 0x1E, REG_PREAMBLE_MSB = 0x20, REG_PREAMBLE_LSB = 0x21,
    REG_PAYLOAD_LEN = 0x22, REG_MODEM3 = 0x26, REG_SYNC = 0x39, REG_VERSION = 0x42, REG_PA_DAC = 0x4D,
};
enum { MODE_SLEEP = 0x80, MODE_STDBY = 0x81, MODE_TX = 0x83, MODE_RXCONT = 0x85 };

static void wr(uint8_t reg, uint8_t v)
{
    spi_transaction_t t = {.flags = SPI_TRANS_USE_TXDATA, .length = 16, .tx_data = {reg | 0x80, v}};
    spi_device_polling_transmit(s_spi, &t);
}

static uint8_t rd(uint8_t reg)
{
    spi_transaction_t t = {.flags = SPI_TRANS_USE_TXDATA | SPI_TRANS_USE_RXDATA, .length = 16, .tx_data = {reg & 0x7F, 0}};
    spi_device_polling_transmit(s_spi, &t);
    return t.rx_data[1];
}

static void wr_burst(uint8_t reg, const uint8_t *d, int n)
{
    uint8_t buf[256];
    buf[0] = reg | 0x80;
    memcpy(buf + 1, d, n);
    spi_transaction_t t = {.length = (n + 1) * 8, .tx_buffer = buf};
    spi_device_polling_transmit(s_spi, &t);
}

static void rd_burst(uint8_t reg, uint8_t *d, int n)
{
    uint8_t tx[256] = {reg & 0x7F}, rx[256];
    spi_transaction_t t = {.length = (n + 1) * 8, .tx_buffer = tx, .rx_buffer = rx};
    spi_device_polling_transmit(s_spi, &t);
    memcpy(d, rx + 1, n);
}

static void do_tx(const lora_pkt_t *p)
{
    wr(REG_OPMODE, MODE_STDBY);
    wr(REG_FIFO_PTR, 0x80);
    wr_burst(REG_FIFO, p->data, p->len);
    wr(REG_PAYLOAD_LEN, p->len);
    wr(REG_IRQ, 0xFF);
    wr(REG_OPMODE, MODE_TX);
    led_set(LED_BLUE, true);
    uint32_t t0 = now_ms();
    while (!(rd(REG_IRQ) & 0x08) && now_ms() - t0 < 3000) vTaskDelay(pdMS_TO_TICKS(5));
    led_set(LED_BLUE, false);
    wr(REG_IRQ, 0xFF);
    wr(REG_OPMODE, MODE_RXCONT);
}

static void task(void *arg)
{
    lora_pkt_t p;
    for (;;) {
        if (xQueueReceive(s_txq, &p, pdMS_TO_TICKS(10))) do_tx(&p);
        uint8_t irq = rd(REG_IRQ);
        if (irq & 0x40) {                               // RxDone
            wr(REG_IRQ, 0xFF);
            if (irq & 0x20) continue;                   // CRC error
            uint8_t n = rd(REG_RX_NB);
            wr(REG_FIFO_PTR, rd(REG_FIFO_RX_CUR));
            rd_burst(REG_FIFO, p.data, n);
            s_rssi = (CONFIG_LORA_FREQ_KHZ > 600000 ? -157 : -164) + rd(REG_PKT_RSSI);
            comm_rx(p.data, n, s_rssi, VIA_LORA);
        }
    }
}

void lora_link_init(void)
{
    spi_bus_config_t bus = {
        .sclk_io_num = CONFIG_PIN_LORA_SCK, .mosi_io_num = CONFIG_PIN_LORA_MOSI,
        .miso_io_num = CONFIG_PIN_LORA_MISO, .quadwp_io_num = -1, .quadhd_io_num = -1,
        .max_transfer_sz = 300,
    };
    if (spi_bus_initialize(SPI2_HOST, &bus, SPI_DMA_CH_AUTO) != ESP_OK) return;
    spi_device_interface_config_t dev = {
        .clock_speed_hz = 8 * 1000 * 1000, .mode = 0, .spics_io_num = CONFIG_PIN_LORA_NSS, .queue_size = 1,
    };
    spi_bus_add_device(SPI2_HOST, &dev, &s_spi);

    gpio_set_direction(CONFIG_PIN_LORA_RST, GPIO_MODE_OUTPUT);
    gpio_set_level(CONFIG_PIN_LORA_RST, 0);
    vTaskDelay(pdMS_TO_TICKS(5));
    gpio_set_level(CONFIG_PIN_LORA_RST, 1);
    vTaskDelay(pdMS_TO_TICKS(10));

    uint8_t ver = rd(REG_VERSION);
    if (ver != 0x12) { ESP_LOGW(TAG, "no SX127x found (version 0x%02X)", ver); return; }

    wr(REG_OPMODE, MODE_SLEEP);                         // LoRa mode can only be set in sleep
    uint64_t frf = ((uint64_t)CONFIG_LORA_FREQ_KHZ * 1000 << 19) / 32000000;
    wr(REG_FRF_MSB, frf >> 16); wr(REG_FRF_MSB + 1, frf >> 8); wr(REG_FRF_MSB + 2, frf);
    wr(REG_FIFO_TX_BASE, 0x80);
    wr(REG_FIFO_RX_BASE, 0x00);
    wr(REG_LNA, 0x23);                                  // max gain, boost
    wr(REG_PA_CONFIG, 0x80 | (CONFIG_LORA_TX_POWER_DBM - 2));   // PA_BOOST pin
    wr(REG_PA_DAC, 0x84);
    wr(REG_OCP, 0x2B);                                  // 100 mA
    wr(REG_MODEM1, 0x72);                               // BW 125k, CR 4/5, explicit header
    wr(REG_MODEM2, 0x94);                               // SF9, CRC on
    wr(REG_MODEM3, 0x04);                               // AGC auto
    wr(REG_PREAMBLE_MSB, 0); wr(REG_PREAMBLE_LSB, 8);
    wr(REG_SYNC, 0x12);                                 // private network
    wr(REG_OPMODE, MODE_STDBY);
    wr(REG_OPMODE, MODE_RXCONT);

    s_present = true;
    s_txq = xQueueCreate(4, sizeof(lora_pkt_t));
    xTaskCreate(task, "lora", 4096, NULL, 7, NULL);
    ESP_LOGI(TAG, "SX127x ready at %d kHz", CONFIG_LORA_FREQ_KHZ);
}

bool lora_link_send(const uint8_t *data, int len)
{
    if (!s_present || len > 255) return false;
    lora_pkt_t p = {.len = len};
    memcpy(p.data, data, len);
    return xQueueSend(s_txq, &p, pdMS_TO_TICKS(100)) == pdTRUE;
}

bool lora_link_present(void) { return s_present; }
int  lora_link_last_rssi(void) { return s_rssi; }

#else  // ------------------------------------------------------------ SX1262

#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "comm.h"
#include "leds.h"

static const char *TAG = "lora";
static spi_device_handle_t s_spi;
static bool s_present;
static int s_rssi;
static QueueHandle_t s_txq;

typedef struct { uint8_t len; uint8_t data[255]; } lora_pkt_t;

// Wait until the chip is ready for a command. A missing module never gets ready.
static bool wait_busy(uint32_t ms)
{
    uint32_t t0 = now_ms();
    while (gpio_get_level(CONFIG_PIN_LORA_BUSY)) {
        if (now_ms() - t0 > ms) return false;
        vTaskDelay(1);
    }
    return true;
}

// Send command bytes, optionally read back the same number of bytes.
static bool xfer(const uint8_t *tx, uint8_t *rx, int n)
{
    if (!wait_busy(100)) return false;
    spi_transaction_t t = {.length = n * 8, .tx_buffer = tx, .rx_buffer = rx};
    return spi_device_polling_transmit(s_spi, &t) == ESP_OK;
}

static bool cmd(uint8_t op, const uint8_t *p, int n)
{
    uint8_t b[16] = {op};
    memcpy(b + 1, p, n);
    return xfer(b, NULL, n + 1);
}
#define CMD(op, ...) do { const uint8_t _p[] = {__VA_ARGS__}; cmd(op, _p, sizeof(_p)); } while (0)

static uint8_t read_reg(uint16_t addr)
{
    uint8_t tx[5] = {0x1D, addr >> 8, addr & 0xFF, 0, 0}, rx[5] = {0};
    xfer(tx, rx, 5);
    return rx[4];
}

static uint16_t irq_status(void)
{
    uint8_t tx[4] = {0x12, 0, 0, 0}, rx[4] = {0};
    xfer(tx, rx, 4);
    return (rx[2] << 8) | rx[3];
}

static void rxen(bool on)
{
    if (CONFIG_PIN_LORA_RXEN >= 0) gpio_set_level(CONFIG_PIN_LORA_RXEN, on);
}

static void packet_params(uint8_t len)
{
    CMD(0x8C, 0x00, 0x08, 0x00, len, 0x01, 0x00);   // preamble 8, explicit header, CRC on, normal IQ
}

static void start_rx(void)
{
    packet_params(255);
    rxen(true);
    CMD(0x82, 0xFF, 0xFF, 0xFF);                     // SetRx continuous
}

static void do_tx(const lora_pkt_t *p)
{
    CMD(0x80, 0x00);                                  // standby
    uint8_t b[258] = {0x0E, 0x00};                    // WriteBuffer at offset 0
    memcpy(b + 2, p->data, p->len);
    xfer(b, NULL, p->len + 2);
    packet_params(p->len);
    CMD(0x02, 0xFF, 0xFF);                            // clear IRQs
    rxen(false);
    led_set(LED_BLUE, true);
    CMD(0x83, 0x00, 0x00, 0x00);                      // SetTx, no timeout
    uint32_t t0 = now_ms();
    while (!(irq_status() & 0x0001) && now_ms() - t0 < 3000) vTaskDelay(pdMS_TO_TICKS(5));
    led_set(LED_BLUE, false);
    CMD(0x02, 0xFF, 0xFF);
    start_rx();
}

static void task(void *arg)
{
    lora_pkt_t p;
    for (;;) {
        if (xQueueReceive(s_txq, &p, pdMS_TO_TICKS(10))) do_tx(&p);
        if (CONFIG_PIN_LORA_DIO1 >= 0 && !gpio_get_level(CONFIG_PIN_LORA_DIO1)) continue;   // nothing pending
        uint16_t irq = irq_status();
        if (!(irq & 0x0002)) continue;                // RxDone
        CMD(0x02, 0xFF, 0xFF);
        if (irq & 0x0040) continue;                   // CRC error
        uint8_t tx[4] = {0x13, 0, 0, 0}, rx[4] = {0};
        xfer(tx, rx, 4);                              // GetRxBufferStatus
        uint8_t len = rx[2], off = rx[3];
        uint8_t rb[258] = {0x1E, off, 0}, rr[258];
        xfer(rb, rr, len + 3);                        // ReadBuffer
        uint8_t ps[5] = {0x14, 0, 0, 0, 0}, pr[5] = {0};
        xfer(ps, pr, 5);                              // GetPacketStatus
        s_rssi = -(int)pr[2] / 2;
        comm_rx(rr + 3, len, s_rssi, VIA_LORA);
    }
}

void lora_link_init(void)
{
    gpio_config_t in = {
        .pin_bit_mask = 1ULL << CONFIG_PIN_LORA_BUSY,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,             // missing module -> looks busy -> detected as absent
    };
    gpio_config(&in);
    if (CONFIG_PIN_LORA_DIO1 >= 0) {
        gpio_config_t d = {.pin_bit_mask = 1ULL << (CONFIG_PIN_LORA_DIO1 & 63), .mode = GPIO_MODE_INPUT, .pull_down_en = GPIO_PULLDOWN_ENABLE};
        gpio_config(&d);
    }
    if (CONFIG_PIN_LORA_RXEN >= 0) { gpio_reset_pin(CONFIG_PIN_LORA_RXEN); gpio_set_direction(CONFIG_PIN_LORA_RXEN, GPIO_MODE_OUTPUT); }

    spi_bus_config_t bus = {
        .sclk_io_num = CONFIG_PIN_LORA_SCK, .mosi_io_num = CONFIG_PIN_LORA_MOSI,
        .miso_io_num = CONFIG_PIN_LORA_MISO, .quadwp_io_num = -1, .quadhd_io_num = -1,
        .max_transfer_sz = 300,
    };
    if (spi_bus_initialize(SPI2_HOST, &bus, SPI_DMA_CH_AUTO) != ESP_OK) return;
    spi_device_interface_config_t dev = {
        .clock_speed_hz = 8 * 1000 * 1000, .mode = 0, .spics_io_num = CONFIG_PIN_LORA_NSS, .queue_size = 1,
    };
    spi_bus_add_device(SPI2_HOST, &dev, &s_spi);

    gpio_reset_pin(CONFIG_PIN_LORA_RST);
    gpio_set_direction(CONFIG_PIN_LORA_RST, GPIO_MODE_OUTPUT);
    gpio_set_level(CONFIG_PIN_LORA_RST, 0);
    vTaskDelay(pdMS_TO_TICKS(2));
    gpio_set_level(CONFIG_PIN_LORA_RST, 1);
    vTaskDelay(pdMS_TO_TICKS(10));

    if (!wait_busy(50)) { ESP_LOGW(TAG, "no SX1262 found (BUSY stuck) - LoRa off"); return; }
    CMD(0x80, 0x00);                                  // standby RC
    uint8_t sw = read_reg(0x0740);                    // sync word MSB, 0x14 after reset
    if (sw != 0x14 && sw != 0x34) { ESP_LOGW(TAG, "no SX1262 found (reg 0x%02X) - LoRa off", sw); return; }

#if CONFIG_LORA_TCXO
    CMD(0x97, 0x02, 0x00, 0x01, 0x40);                // DIO3 powers TCXO at 1.8 V, 5 ms start-up
    CMD(0x89, 0x7F);                                  // calibrate everything
    wait_busy(50);
#endif
    CMD(0x9D, 0x01);                                  // DIO2 drives the antenna switch
    CMD(0x96, 0x01);                                  // DC-DC regulator (saves power)
    CMD(0x8A, 0x01);                                  // packet type LoRa
    uint32_t f = CONFIG_LORA_FREQ_KHZ;
    if (f > 900000) CMD(0x98, 0xE1, 0xE9);            // image calibration for the band
    else if (f > 850000) CMD(0x98, 0xD7, 0xDB);
    else if (f > 420000) CMD(0x98, 0x6B, 0x6F);
    wait_busy(50);
    uint32_t frf = (uint32_t)(((uint64_t)f * 1000 << 25) / 32000000);
    CMD(0x86, frf >> 24, frf >> 16, frf >> 8, frf);
    CMD(0x95, 0x04, 0x07, 0x00, 0x01);                // PA config for SX1262 up to +22 dBm
    CMD(0x8E, (uint8_t)(int8_t)CONFIG_LORA_TX_POWER_DBM, 0x04);
    CMD(0x8F, 0x00, 0x00);                            // buffer base addresses
    CMD(0x8B, 0x09, 0x04, 0x01, 0x00);                // SF9, BW125, CR4/5, no LDRO
    { uint8_t b[] = {0x0D, 0x07, 0x40, 0x14, 0x24}; xfer(b, NULL, sizeof(b)); }   // private sync word (= 0x12)
    CMD(0x08, 0x02, 0x43, 0x02, 0x43, 0x00, 0x00, 0x00, 0x00);   // IRQs TxDone RxDone CrcErr Timeout -> DIO1
    CMD(0x02, 0xFF, 0xFF);
    start_rx();

    s_present = true;
    s_txq = xQueueCreate(4, sizeof(lora_pkt_t));
    xTaskCreate(task, "lora", 4096, NULL, 7, NULL);
    ESP_LOGI(TAG, "SX1262 ready at %lu kHz, %d dBm", (unsigned long)f, CONFIG_LORA_TX_POWER_DBM);
}

bool lora_link_send(const uint8_t *data, int len)
{
    if (!s_present || len > 255) return false;
    lora_pkt_t p = {.len = len};
    memcpy(p.data, data, len);
    return xQueueSend(s_txq, &p, pdMS_TO_TICKS(100)) == pdTRUE;
}

bool lora_link_present(void) { return s_present; }
int  lora_link_last_rssi(void) { return s_rssi; }

#endif
