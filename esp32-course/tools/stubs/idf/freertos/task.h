#pragma once
#include "freertos/FreeRTOS.h"
typedef void *TaskHandle_t;
typedef void (*TaskFunction_t)(void *);
BaseType_t xTaskCreate(TaskFunction_t fn, const char *name, uint32_t stack_depth, void *arg, UBaseType_t priority, TaskHandle_t *handle);
BaseType_t xTaskCreatePinnedToCore(TaskFunction_t fn, const char *name, uint32_t stack_depth, void *arg, UBaseType_t priority, TaskHandle_t *handle, BaseType_t core);
void vTaskDelay(TickType_t ticks);
void vTaskDelete(TaskHandle_t task);
TickType_t xTaskGetTickCount(void);
UBaseType_t uxTaskGetStackHighWaterMark(TaskHandle_t task);
