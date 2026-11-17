#pragma once
#include "esp_err.h"
void esp_log_stub(const char *tag, const char *format, ...) __attribute__((format(printf, 2, 3)));
#define ESP_LOGE(tag, format, ...) esp_log_stub(tag, format, ##__VA_ARGS__)
#define ESP_LOGW(tag, format, ...) esp_log_stub(tag, format, ##__VA_ARGS__)
#define ESP_LOGI(tag, format, ...) esp_log_stub(tag, format, ##__VA_ARGS__)
#define ESP_LOGD(tag, format, ...) esp_log_stub(tag, format, ##__VA_ARGS__)
typedef enum { ESP_LOG_NONE, ESP_LOG_ERROR, ESP_LOG_WARN, ESP_LOG_INFO, ESP_LOG_DEBUG, ESP_LOG_VERBOSE } esp_log_level_t;
void esp_log_level_set(const char *tag, esp_log_level_t level);
