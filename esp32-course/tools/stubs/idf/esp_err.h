/* STUB of ESP-IDF v5.x headers, used ONLY for syntax checking on a PC. */
#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <inttypes.h>
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1
#define ESP_ERR_NO_MEM 0x101
#define ESP_ERR_INVALID_ARG 0x102
#define ESP_ERR_TIMEOUT 0x107
const char *esp_err_to_name(esp_err_t code);
void _esp_error_check_failed(esp_err_t rc, const char *file, int line);
#define ESP_ERROR_CHECK(x) do { esp_err_t err_rc_ = (x); if (err_rc_ != ESP_OK) { _esp_error_check_failed(err_rc_, __FILE__, __LINE__); } } while (0)
