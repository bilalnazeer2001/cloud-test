#pragma once
#include <Arduino.h>
typedef enum { ESP_SLEEP_WAKEUP_UNDEFINED, ESP_SLEEP_WAKEUP_ALL, ESP_SLEEP_WAKEUP_EXT0, ESP_SLEEP_WAKEUP_EXT1, ESP_SLEEP_WAKEUP_TIMER, ESP_SLEEP_WAKEUP_TOUCHPAD, ESP_SLEEP_WAKEUP_ULP } esp_sleep_wakeup_cause_t;
esp_err_t esp_sleep_enable_timer_wakeup(uint64_t time_in_us);
esp_err_t esp_sleep_enable_ext0_wakeup(gpio_num_t gpio_num, int level);
esp_sleep_wakeup_cause_t esp_sleep_get_wakeup_cause(void);
void esp_deep_sleep_start(void) __attribute__((noreturn));
