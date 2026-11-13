#include "driver/gpio.h"
#include "sdkconfig.h"
#include "app.h"
#include "leds.h"

static const int PINS[LED_COUNT] = {
    CONFIG_PIN_LED_RED, CONFIG_PIN_LED_GREEN, CONFIG_PIN_LED_BLUE, CONFIG_PIN_LED_WHITE,
};
static volatile uint32_t s_off_at[LED_COUNT];

static void tick(void *arg)
{
    uint32_t t = now_ms();
    for (int i = 0; i < LED_COUNT; i++)
        if (s_off_at[i] && (int32_t)(t - s_off_at[i]) >= 0) {
            s_off_at[i] = 0;
            gpio_set_level(PINS[i], 0);
        }
}

void leds_init(void)
{
    for (int i = 0; i < LED_COUNT; i++) {
        gpio_reset_pin(PINS[i]);
        gpio_set_direction(PINS[i], GPIO_MODE_OUTPUT);
        gpio_set_level(PINS[i], 0);
    }
    const esp_timer_create_args_t a = {.callback = tick, .name = "leds"};
    esp_timer_handle_t t;
    esp_timer_create(&a, &t);
    esp_timer_start_periodic(t, 10000);
}

void led_set(led_t l, bool on)
{
    s_off_at[l] = 0;
    gpio_set_level(PINS[l], on);
}

void led_pulse(led_t l, uint32_t ms)
{
    gpio_set_level(PINS[l], 1);
    uint32_t off = now_ms() + ms;
    s_off_at[l] = off ? off : 1;
}
