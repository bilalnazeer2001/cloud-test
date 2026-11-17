#pragma once
#include "esp_err.h"
typedef uint32_t TickType_t;
typedef int BaseType_t;
typedef unsigned int UBaseType_t;
#define pdTRUE 1
#define pdFALSE 0
#define pdPASS 1
#define pdFAIL 0
#define portMAX_DELAY ((TickType_t)0xffffffffUL)
#define portTICK_PERIOD_MS ((TickType_t)10)
#define pdMS_TO_TICKS(ms) ((TickType_t)((ms) / portTICK_PERIOD_MS))
#define configMINIMAL_STACK_SIZE 768
#define tskIDLE_PRIORITY 0
