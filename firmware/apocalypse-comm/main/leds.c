// LEDs. Any role without its own LED (pin -1) uses another LED that exists,
// so a board with a single built-in LED still blinks for everything.
#include "driver/gpio.h"
#include "sdkconfig.h"
#include "app.h"
#include "leds.h"

static const int CFG[LED_COUNT] = {
    CONFIG_PIN_LED_RED, CONFIG_PIN_LED_GREEN, CONFIG_PIN_LED_BLUE, CONFIG_PIN_LED_WHITE,
};
static int s_pin[LED_COUNT];
static volatile uint32_t s_off_at[LED_COUNT];

#if CONFIG_LED_ACTIVE_LOW
#define LVL(on) (!(on))
#else
#define LVL(on) (on)
#endif

static void tick(void *arg)
{
    uint32_t t = now_ms();
    for (int i = 0; i < LED_COUNT; i++)
        if (s_off_at[i] && (int32_t)(t - s_off_at[i]) >= 0) {
            s_off_at[i] = 0;
            if (s_pin[i] >= 0) gpio_set_level(s_pin[i], LVL(0));
        }
}

void leds_init(void)
{
    int any = -1;
    for (int i = 0; i < LED_COUNT; i++) if (CFG[i] >= 0) { any = CFG[i]; break; }
    for (int i = 0; i < LED_COUNT; i++) {
        s_pin[i] = CFG[i] >= 0 ? CFG[i] : any;
        if (CFG[i] < 0) continue;
        gpio_reset_pin(CFG[i]);
        gpio_set_direction(CFG[i], GPIO_MODE_OUTPUT);
        gpio_set_level(CFG[i], LVL(0));
    }
    const esp_timer_create_args_t a = {.callback = tick, .name = "leds"};
    esp_timer_handle_t t;
    esp_timer_create(&a, &t);
    esp_timer_start_periodic(t, 10000);
}

bool led_has_own(led_t l) { return CFG[l] >= 0; }

void led_set(led_t l, bool on)
{
    s_off_at[l] = 0;
    if (s_pin[l] >= 0) gpio_set_level(s_pin[l], LVL(on));
}

void led_pulse(led_t l, uint32_t ms)
{
    if (s_pin[l] < 0) return;
    gpio_set_level(s_pin[l], LVL(1));
    uint32_t off = now_ms() + ms;
    s_off_at[l] = off ? off : 1;
}
