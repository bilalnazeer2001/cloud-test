#pragma once
void power_init(void);
int  power_battery_mv(void);    // -1 if not measured
int  power_battery_pct(void);   // -1 if not measured (single Li-ion cell curve)
