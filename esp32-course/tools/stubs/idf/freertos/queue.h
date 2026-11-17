#pragma once
#include "freertos/FreeRTOS.h"
typedef void *QueueHandle_t;
QueueHandle_t xQueueCreate(UBaseType_t length, UBaseType_t item_size);
BaseType_t xQueueSend(QueueHandle_t q, const void *item, TickType_t ticks);
BaseType_t xQueueSendFromISR(QueueHandle_t q, const void *item, BaseType_t *woken);
BaseType_t xQueueReceive(QueueHandle_t q, void *buffer, TickType_t ticks);
