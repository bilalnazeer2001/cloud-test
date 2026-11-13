// Battery voltage through a resistor divider on an ADC pin.
#include "sdkconfig.h"
#include "app.h"
#include "power.h"

#if CONFIG_BATTERY_ADC_ENABLE
#include "esp_adc/adc_oneshot.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"

static adc_oneshot_unit_handle_t s_adc;
static adc_cali_handle_t s_cali;
static adc_channel_t s_ch;
static bool s_ok;
static int s_mv = -1;
static uint32_t s_when;

void power_init(void)
{
    adc_unit_t unit;
    if (adc_oneshot_io_to_channel(CONFIG_PIN_BATTERY_ADC, &unit, &s_ch) != ESP_OK || unit != ADC_UNIT_1) return;
    adc_oneshot_unit_init_cfg_t uc = {.unit_id = ADC_UNIT_1};
    if (adc_oneshot_new_unit(&uc, &s_adc) != ESP_OK) return;
    adc_oneshot_chan_cfg_t cc = {.atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_DEFAULT};
    adc_oneshot_config_channel(s_adc, s_ch, &cc);
    adc_cali_curve_fitting_config_t cf = {.unit_id = ADC_UNIT_1, .chan = s_ch, .atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_DEFAULT};
    s_ok = adc_cali_create_scheme_curve_fitting(&cf, &s_cali) == ESP_OK;
}

int power_battery_mv(void)
{
    if (!s_ok) return -1;
    if (s_mv >= 0 && now_ms() - s_when < 5000) return s_mv;
    int sum = 0, mv;
    for (int i = 0; i < 8; i++) {
        int raw;
        adc_oneshot_read(s_adc, s_ch, &raw);
        adc_cali_raw_to_voltage(s_cali, raw, &mv);
        sum += mv;
    }
    s_mv = sum / 8 * CONFIG_BATTERY_DIVIDER_X100 / 100;
    s_when = now_ms();
    return s_mv;
}

int power_battery_pct(void)
{
    int mv = power_battery_mv();
    if (mv < 2500) return -1;                  // nothing connected / USB only
    static const int curve[][2] = {{4200, 100}, {4000, 85}, {3850, 65}, {3750, 45}, {3650, 25}, {3500, 10}, {3300, 0}};
    if (mv >= 4200) return 100;
    for (int i = 1; i < 7; i++)
        if (mv >= curve[i][0])
            return curve[i][1] + (mv - curve[i][0]) * (curve[i - 1][1] - curve[i][1]) / (curve[i - 1][0] - curve[i][0]);
    return 0;
}

#else
void power_init(void) {}
int power_battery_mv(void) { return -1; }
int power_battery_pct(void) { return -1; }
#endif
