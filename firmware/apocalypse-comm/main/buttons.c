// Polls the buttons every 5 ms, debounces them and turns them into events.
// Two wiring options: one GPIO per button, or all buttons on one analog pin
// (resistor ladder). Missing or stuck buttons are ignored safely.
#include "driver/gpio.h"
#include "esp_log.h"
#include "sdkconfig.h"
#include "app.h"
#include "buttons.h"
#include "power.h"

#define POLL_MS      5
#define DEBOUNCE     4      // polls (20 ms)
#define LONG_MS      700
#define REPEAT_DELAY 450
#define REPEAT_EVERY 110

static QueueHandle_t s_q;
static volatile bool s_down[BTN_COUNT];
static volatile bool s_present = true;
static volatile uint8_t s_seen;          // bit mask of buttons ever pressed (self-test)

#if CONFIG_BUTTONS_LADDER
// Each button connects the pin to GND through its own resistor; a pull-up goes to 3V3.
// Order: UP DOWN LEFT RIGHT OK BACK MORSE. OK has 0 ohm so the centre of a 5-way switch works.
static const int LADDER_OHM[BTN_COUNT] = {1000, 2200, 3900, 6800, 0, 12000, 22000};
static int s_level_mv[BTN_COUNT];
static uint32_t s_idle_since;

static void ladder_setup(void)
{
    for (int b = 0; b < BTN_COUNT; b++)
        s_level_mv[b] = 3300LL * LADDER_OHM[b] / (CONFIG_LADDER_PULLUP_OHM + LADDER_OHM[b]);
    s_present = false;                   // until we see a clean idle level
}

// Returns pressed button, -1 = none, -2 = invalid / floating reading
static int ladder_read(void)
{
    int mv = adc_read_mv(CONFIG_PIN_BTN_LADDER);
    if (mv < 0) return -2;
    int best = -1, bestd = 3300 - mv > 0 ? 3300 - mv : 0;   // distance to idle
    if (mv > 2750) bestd = 0;                                // ADC tops out near 3.1 V
    for (int b = 0; b < BTN_COUNT; b++) {
        int d = mv > s_level_mv[b] ? mv - s_level_mv[b] : s_level_mv[b] - mv;
        if (d < bestd) { bestd = d; best = b; }
    }
    return bestd > 160 ? -2 : best;
}
#else
static const int PINS[BTN_COUNT] = {
    CONFIG_PIN_BTN_UP, CONFIG_PIN_BTN_DOWN, CONFIG_PIN_BTN_LEFT, CONFIG_PIN_BTN_RIGHT,
    CONFIG_PIN_BTN_OK, CONFIG_PIN_BTN_BACK, CONFIG_PIN_BTN_MORSE,
};
#endif

static void post(btn_t b, btn_ev_type_t t, uint32_t held)
{
    btn_ev_t ev = {.btn = b, .type = t, .t_ms = now_ms(), .held_ms = held};
    xQueueSend(s_q, &ev, 0);
}

static void task(void *arg)
{
    uint8_t cnt[BTN_COUNT] = {0};
    uint32_t t_press[BTN_COUNT] = {0}, t_rep[BTN_COUNT] = {0};
    bool long_sent[BTN_COUNT] = {0};
    bool armed[BTN_COUNT] = {0};          // a button must be seen released once (stuck/missing = ignored)

    for (;;) {
        uint32_t t = now_ms();
        bool raw_all[BTN_COUNT] = {0};
#if CONFIG_BUTTONS_LADDER
        int lb = ladder_read();
        if (lb == -2) {                    // floating / not wired: treat as nothing pressed
            s_idle_since = 0;
            vTaskDelay(pdMS_TO_TICKS(POLL_MS));
            continue;
        }
        if (lb == -1) {
            if (!s_idle_since) s_idle_since = t ? t : 1;
            if (!s_present && t - s_idle_since > 1000) { s_present = true; ESP_LOGI("btn", "button ladder detected"); }
        }
        if (!s_present) { vTaskDelay(pdMS_TO_TICKS(POLL_MS)); continue; }
        if (lb >= 0) raw_all[lb] = true;
#else
        for (int b = 0; b < BTN_COUNT; b++) raw_all[b] = PINS[b] >= 0 && gpio_get_level(PINS[b]) == 0;
#endif
        for (int b = 0; b < BTN_COUNT; b++) {
            bool raw = raw_all[b];
            if (!armed[b]) { if (!raw) armed[b] = true; continue; }
            if (raw != s_down[b]) {
                if (++cnt[b] < DEBOUNCE) continue;
                cnt[b] = 0;
                s_down[b] = raw;
                if (raw) {                                   // pressed
                    s_seen |= 1 << b;
                    t_press[b] = t_rep[b] = t;
                    long_sent[b] = false;
                    if (b == BTN_MORSE) post(b, EV_DOWN, 0);
                    else if (b <= BTN_RIGHT) post(b, EV_CLICK, 0);
                } else {                                     // released
                    uint32_t held = t - t_press[b];
                    if (b == BTN_MORSE) post(b, EV_UP, held);
                    else if ((b == BTN_OK || b == BTN_BACK) && !long_sent[b]) post(b, EV_CLICK, held);
                }
            } else {
                cnt[b] = 0;
                if (!s_down[b]) continue;
                uint32_t held = t - t_press[b];
                if ((b == BTN_OK || b == BTN_BACK) && !long_sent[b] && held >= LONG_MS) {
                    long_sent[b] = true;
                    post(b, EV_LONG, held);
                }
                if (b <= BTN_RIGHT && held >= REPEAT_DELAY && t - t_rep[b] >= REPEAT_EVERY) {
                    t_rep[b] = t;
                    post(b, EV_CLICK, held);
                }
            }
        }
        vTaskDelay(pdMS_TO_TICKS(POLL_MS));
    }
}

void buttons_init(void)
{
    s_q = xQueueCreate(32, sizeof(btn_ev_t));
#if CONFIG_BUTTONS_LADDER
    ladder_setup();
#else
    for (int b = 0; b < BTN_COUNT; b++) {
        if (PINS[b] < 0) continue;
        gpio_config_t c = {
            .pin_bit_mask = 1ULL << PINS[b],
            .mode = GPIO_MODE_INPUT,
            .pull_up_en = GPIO_PULLUP_ENABLE,
        };
        gpio_config(&c);
    }
#endif
    xTaskCreate(task, "buttons", 3072, NULL, 10, NULL);
}

bool buttons_get(btn_ev_t *ev, uint32_t timeout_ms)
{
    return xQueueReceive(s_q, ev, pdMS_TO_TICKS(timeout_ms)) == pdTRUE;
}

bool buttons_is_down(btn_t b) { return s_down[b]; }
void buttons_flush(void) { xQueueReset(s_q); }
bool buttons_present(void) { return s_present; }
uint8_t buttons_seen_mask(void) { return s_seen; }
void buttons_clear_seen(void) { s_seen = 0; }
