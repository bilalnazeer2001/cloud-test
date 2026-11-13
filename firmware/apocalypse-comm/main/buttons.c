// Polls the buttons every 5 ms, debounces them and turns them into events.
#include "driver/gpio.h"
#include "sdkconfig.h"
#include "app.h"
#include "buttons.h"

#define POLL_MS      5
#define DEBOUNCE     4      // polls (20 ms)
#define LONG_MS      700
#define REPEAT_DELAY 450
#define REPEAT_EVERY 110

static const int PINS[BTN_COUNT] = {
    CONFIG_PIN_BTN_UP, CONFIG_PIN_BTN_DOWN, CONFIG_PIN_BTN_LEFT, CONFIG_PIN_BTN_RIGHT,
    CONFIG_PIN_BTN_OK, CONFIG_PIN_BTN_BACK, CONFIG_PIN_BTN_MORSE,
};

static QueueHandle_t s_q;
static volatile bool s_down[BTN_COUNT];

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

    for (;;) {
        uint32_t t = now_ms();
        for (int b = 0; b < BTN_COUNT; b++) {
            bool raw = gpio_get_level(PINS[b]) == 0;     // active low
            if (raw != s_down[b]) {
                if (++cnt[b] < DEBOUNCE) continue;
                cnt[b] = 0;
                s_down[b] = raw;
                if (raw) {                                   // pressed
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
    for (int b = 0; b < BTN_COUNT; b++) {
        gpio_config_t c = {
            .pin_bit_mask = 1ULL << PINS[b],
            .mode = GPIO_MODE_INPUT,
            .pull_up_en = GPIO_PULLUP_ENABLE,
        };
        gpio_config(&c);
    }
    xTaskCreate(task, "buttons", 3072, NULL, 10, NULL);
}

bool buttons_get(btn_ev_t *ev, uint32_t timeout_ms)
{
    return xQueueReceive(s_q, ev, pdMS_TO_TICKS(timeout_ms)) == pdTRUE;
}

bool buttons_is_down(btn_t b) { return s_down[b]; }
void buttons_flush(void) { xQueueReset(s_q); }
