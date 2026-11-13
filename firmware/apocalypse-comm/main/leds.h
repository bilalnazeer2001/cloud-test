#pragma once
#include <stdbool.h>
#include <stdint.h>

typedef enum { LED_RED, LED_GREEN, LED_BLUE, LED_WHITE, LED_COUNT } led_t;

void leds_init(void);
void led_set(led_t l, bool on);
// Turn on for ms, then off automatically.
void led_pulse(led_t l, uint32_t ms);
