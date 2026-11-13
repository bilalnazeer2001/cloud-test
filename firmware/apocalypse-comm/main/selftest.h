#pragma once
#include <stdbool.h>

typedef struct {
    bool display, speaker, buttons, lora, wifi;
    int  mic_level;       // -1 = no mic
    int  battery_mv;      // < 2500 = not measured
} hw_status_t;

void hw_summary(hw_status_t *h);
void hw_log(const hw_status_t *h);
