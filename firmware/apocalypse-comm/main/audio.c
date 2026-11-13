// Speaker: MAX98357A I2S amplifier. Microphone: INMP441 I2S microphone.
#include <math.h>
#include <string.h>
#include "driver/i2s_std.h"
#include "esp_log.h"
#include "sdkconfig.h"
#include "app.h"
#include "audio.h"

static const char *TAG = "audio";
static i2s_chan_handle_t s_tx, s_rx;
static SemaphoreHandle_t s_lock;
static QueueHandle_t s_fxq;
static bool s_mic_on;
static volatile bool s_side;
static TaskHandle_t s_side_task;

#define SINE_N 256
static int16_t s_sine[SINE_N];

void audio_lock(void)   { xSemaphoreTakeRecursive(s_lock, portMAX_DELAY); }
void audio_unlock(void) { xSemaphoreGiveRecursive(s_lock); }

void audio_write(const int16_t *samples, size_t n)
{
    int16_t st[256];                       // duplicate mono -> stereo
    audio_lock();
    while (n) {
        size_t k = n > 128 ? 128 : n;
        for (size_t i = 0; i < k; i++) st[2 * i] = st[2 * i + 1] = samples[i];
        size_t w;
        i2s_channel_write(s_tx, st, k * 4, &w, portMAX_DELAY);
        samples += k;
        n -= k;
    }
    audio_unlock();
}

void audio_tone(uint32_t freq, uint32_t ms)
{
    int16_t buf[128];
    uint32_t total = AUDIO_RATE * ms / 1000;
    int32_t amp = g_set.volume * 3000;          // 0..30000
    uint32_t phase = 0, step = (uint32_t)((uint64_t)freq * SINE_N * 65536 / AUDIO_RATE);
    uint32_t ramp = AUDIO_RATE / 400;          // 2.5 ms fade in/out, avoids clicks
    audio_lock();
    for (uint32_t i = 0; i < total;) {
        size_t k = 0;
        for (; k < 128 && i < total; k++, i++) {
            int32_t a = amp;
            if (i < ramp) a = a * i / ramp;
            else if (total - i < ramp) a = a * (total - i) / ramp;
            buf[k] = (int16_t)(s_sine[(phase >> 16) & (SINE_N - 1)] * a / 32767);
            phase += step;
        }
        audio_write(buf, k);
    }
    audio_unlock();
}

void audio_silence(uint32_t ms)
{
    int16_t z[128] = {0};
    uint32_t total = AUDIO_RATE * ms / 1000;
    audio_lock();
    while (total) {
        uint32_t k = total > 128 ? 128 : total;
        audio_write(z, k);
        total -= k;
    }
    audio_unlock();
}

// Background sound effects so the UI never blocks on a beep
static void fx_task(void *arg)
{
    uint8_t fx;
    for (;;) {
        xQueueReceive(s_fxq, &fx, portMAX_DELAY);
        if (g_set.volume == 0) continue;
        switch (fx) {
        case 0: audio_tone(2000, 25); break;
        case 1: audio_tone(1200, 90); audio_silence(40); audio_tone(1800, 120); break;
        case 2:
            for (int i = 0; i < 6; i++) { audio_tone(1000, 150); audio_tone(1600, 150); }
            break;
        }
    }
}

void audio_beep(void)  { uint8_t f = 0; xQueueSend(s_fxq, &f, 0); }
void audio_alert(void) { uint8_t f = 1; xQueueSend(s_fxq, &f, 0); }
void audio_alarm(void) { uint8_t f = 2; xQueueSend(s_fxq, &f, 0); }

static void side_task(void *arg)
{
    int16_t buf[64];
    uint32_t ph = 0;
    for (;;) {
        if (!s_side) { ulTaskNotifyTake(pdTRUE, portMAX_DELAY); continue; }
        uint32_t step = (uint32_t)((uint64_t)g_set.tone_hz * SINE_N * 65536 / AUDIO_RATE);
        int32_t amp = g_set.volume * 2000;
        for (int i = 0; i < 64; i++) { buf[i] = s_sine[(ph >> 16) & (SINE_N - 1)] * amp / 32767; ph += step; }
        audio_write(buf, 64);
    }
}

void audio_sidetone(bool on)
{
    s_side = on;
    if (on && s_side_task) xTaskNotifyGive(s_side_task);
}

void audio_mic_enable(bool on)
{
    if (on == s_mic_on || !s_rx) return;
    if (on) i2s_channel_enable(s_rx); else i2s_channel_disable(s_rx);
    s_mic_on = on;
}

size_t audio_mic_read(int16_t *out, size_t n, uint32_t timeout_ms)
{
    int32_t raw[128];
    size_t got = 0;
    if (!s_mic_on) return 0;
    while (got < n) {
        size_t k = n - got > 128 ? 128 : n - got, r = 0;
        if (i2s_channel_read(s_rx, raw, k * 4, &r, timeout_ms) != ESP_OK) break;
        r /= 4;
        for (size_t i = 0; i < r; i++) {
            int32_t v = raw[i] >> 13;           // 24-bit data in top bits, plus ~x8 gain
            out[got + i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
        }
        got += r;
    }
    return got;
}

void audio_init(void)
{
    s_lock = xSemaphoreCreateRecursiveMutex();
    s_fxq = xQueueCreate(4, 1);
    for (int i = 0; i < SINE_N; i++) s_sine[i] = (int16_t)(32767 * sinf(2 * M_PI * i / SINE_N));

    // Speaker (I2S0, stereo frames, amp mixes L+R)
    i2s_chan_config_t cc = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    cc.auto_clear = true;                       // silence instead of buzzing when idle
    ESP_ERROR_CHECK(i2s_new_channel(&cc, &s_tx, NULL));
    i2s_std_config_t sc = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(AUDIO_RATE),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = CONFIG_PIN_SPK_BCLK,
            .ws = CONFIG_PIN_SPK_WS,
            .dout = CONFIG_PIN_SPK_DIN,
            .din = I2S_GPIO_UNUSED,
        },
    };
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(s_tx, &sc));
    ESP_ERROR_CHECK(i2s_channel_enable(s_tx));

    // Microphone (I2S1, 32-bit slots, L/R pin of mic tied to GND = left)
    i2s_chan_config_t rc = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_1, I2S_ROLE_MASTER);
    rc.dma_frame_num = 256;
    if (i2s_new_channel(&rc, NULL, &s_rx) == ESP_OK) {
        i2s_std_config_t mc = {
            .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(AUDIO_RATE),
            .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO),
            .gpio_cfg = {
                .mclk = I2S_GPIO_UNUSED,
                .bclk = CONFIG_PIN_MIC_SCK,
                .ws = CONFIG_PIN_MIC_WS,
                .dout = I2S_GPIO_UNUSED,
                .din = CONFIG_PIN_MIC_SD,
            },
        };
        mc.slot_cfg.slot_mask = I2S_STD_SLOT_LEFT;
        if (i2s_channel_init_std_mode(s_rx, &mc) != ESP_OK) {
            ESP_LOGW(TAG, "mic init failed");
            i2s_del_channel(s_rx);
            s_rx = NULL;
        }
    }
    xTaskCreate(fx_task, "sfx", 3072, NULL, 5, NULL);
    xTaskCreate(side_task, "side", 2048, NULL, 6, &s_side_task);
}
