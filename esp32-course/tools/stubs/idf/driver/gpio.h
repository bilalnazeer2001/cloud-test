#pragma once
#include "esp_err.h"
typedef enum { GPIO_NUM_NC = -1, GPIO_NUM_0 = 0, GPIO_NUM_2 = 2, GPIO_NUM_4 = 4, GPIO_NUM_13 = 13, GPIO_NUM_14 = 14, GPIO_NUM_27 = 27, GPIO_NUM_34 = 34, GPIO_NUM_MAX = 40 } gpio_num_t;
typedef enum { GPIO_MODE_DISABLE = 0, GPIO_MODE_INPUT = 1, GPIO_MODE_OUTPUT = 2, GPIO_MODE_INPUT_OUTPUT = 3 } gpio_mode_t;
typedef enum { GPIO_PULLUP_DISABLE = 0, GPIO_PULLUP_ENABLE = 1 } gpio_pullup_t;
typedef enum { GPIO_PULLDOWN_DISABLE = 0, GPIO_PULLDOWN_ENABLE = 1 } gpio_pulldown_t;
typedef enum { GPIO_INTR_DISABLE = 0, GPIO_INTR_POSEDGE = 1, GPIO_INTR_NEGEDGE = 2, GPIO_INTR_ANYEDGE = 3 } gpio_int_type_t;
typedef enum { GPIO_PULLUP_ONLY, GPIO_PULLDOWN_ONLY, GPIO_PULLUP_PULLDOWN, GPIO_FLOATING } gpio_pull_mode_t;
typedef struct { uint64_t pin_bit_mask; gpio_mode_t mode; gpio_pullup_t pull_up_en; gpio_pulldown_t pull_down_en; gpio_int_type_t intr_type; } gpio_config_t;
esp_err_t gpio_config(const gpio_config_t *cfg);
esp_err_t gpio_reset_pin(gpio_num_t gpio_num);
esp_err_t gpio_set_direction(gpio_num_t gpio_num, gpio_mode_t mode);
esp_err_t gpio_set_pull_mode(gpio_num_t gpio_num, gpio_pull_mode_t pull);
esp_err_t gpio_set_level(gpio_num_t gpio_num, uint32_t level);
int gpio_get_level(gpio_num_t gpio_num);
