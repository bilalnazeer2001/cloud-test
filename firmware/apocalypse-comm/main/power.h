#pragma once
#include <stdbool.h>
void power_init(void);
int  power_battery_mv(void);    // -1 if not measured / not connected
int  power_battery_pct(void);   // -1 if not measured (single Li-ion cell curve)
// Shared ADC1 reader (battery + button ladder). Returns millivolts or -1.
int  adc_read_mv(int gpio);
// Power saver: radio Wi-Fi off (LoRa only), slower CPU.
void power_apply_saver(void);
