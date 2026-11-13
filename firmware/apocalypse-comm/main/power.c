// Battery voltage, shared ADC access, and power-saver mode.
#include "sdkconfig.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "esp_pm.h"
#include "esp_log.h"
#include "app.h"
#include "power.h"
#include "links.h"
#include "audio.h"

static adc_oneshot_unit_handle_t s_adc;
static SemaphoreHandle_t s_mx;
static struct { int gpio; adc_channel_t ch; adc_cali_handle_t cali; } s_ch[3];
static int s_nch;

static void adc_setup(void)
{
    if (s_adc) return;
    s_mx = xSemaphoreCreateMutex();
    adc_oneshot_unit_init_cfg_t uc = {.unit_id = ADC_UNIT_1};
    if (adc_oneshot_new_unit(&uc, &s_adc) != ESP_OK) s_adc = NULL;
}

int adc_read_mv(int gpio)
{
    adc_setup();
    if (!s_adc || gpio < 0) return -1;
    xSemaphoreTake(s_mx, portMAX_DELAY);
    int i;
    for (i = 0; i < s_nch && s_ch[i].gpio != gpio; i++) {}
    if (i == s_nch) {                          // first use of this pin: configure it
        adc_unit_t unit;
        adc_channel_t ch;
        if (s_nch == 3 || adc_oneshot_io_to_channel(gpio, &unit, &ch) != ESP_OK || unit != ADC_UNIT_1) {
            xSemaphoreGive(s_mx);
            return -1;
        }
        adc_oneshot_chan_cfg_t cc = {.atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_DEFAULT};
        adc_oneshot_config_channel(s_adc, ch, &cc);
        adc_cali_curve_fitting_config_t cf = {.unit_id = ADC_UNIT_1, .chan = ch, .atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_DEFAULT};
        s_ch[i].gpio = gpio;
        s_ch[i].ch = ch;
        if (adc_cali_create_scheme_curve_fitting(&cf, &s_ch[i].cali) != ESP_OK) s_ch[i].cali = NULL;
        s_nch++;
    }
    int raw = 0, mv = -1;
    if (adc_oneshot_read(s_adc, s_ch[i].ch, &raw) == ESP_OK) {
        if (s_ch[i].cali) adc_cali_raw_to_voltage(s_ch[i].cali, raw, &mv);
        else mv = raw * 3100 / 4095;
    }
    xSemaphoreGive(s_mx);
    return mv;
}

#if CONFIG_BATTERY_ADC_ENABLE
static int s_mv = -1;
static uint32_t s_when;

int power_battery_mv(void)
{
    if (s_mv >= 0 && now_ms() - s_when < 5000 && s_when) return s_mv;
    int sum = 0;
    for (int i = 0; i < 8; i++) {
        int mv = adc_read_mv(CONFIG_PIN_BATTERY_ADC);
        if (mv < 0) return -1;
        sum += mv;
    }
    s_mv = sum / 8 * CONFIG_BATTERY_DIVIDER_X100 / 100;
    s_when = now_ms();
    return s_mv;
}
#else
int power_battery_mv(void) { return -1; }
#endif

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

void power_apply_saver(void)
{
#if CONFIG_PM_ENABLE
    esp_pm_config_t pm = {
        .max_freq_mhz = g_set.power_saver ? 80 : 160,
        .min_freq_mhz = g_set.power_saver ? 40 : 80,
        .light_sleep_enable = false,
    };
    esp_pm_configure(&pm);
#endif
    if (g_set.power_saver) portal_stop();
    espnow_link_enable(!g_set.power_saver);
    ESP_LOGI("power", "power saver %s", g_set.power_saver ? "ON (Wi-Fi radio off)" : "OFF");
}

void power_init(void)
{
    adc_setup();
    power_battery_mv();
}
