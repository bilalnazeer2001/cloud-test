// Driver for SX1276 / SX1278 / RFM95 / Ra-02 LoRa modules (register level).
// Settings: SF9, 125 kHz, CR 4/5 -> roughly 2-10 km line of sight.
#include <string.h>
#include "sdkconfig.h"
#include "app.h"
#include "links.h"

#if !CONFIG_LORA_ENABLE

void lora_link_init(void) {}
bool lora_link_send(const uint8_t *d, int l) { return false; }
bool lora_link_present(void) { return false; }
int  lora_link_last_rssi(void) { return 0; }

#else

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

#endif
