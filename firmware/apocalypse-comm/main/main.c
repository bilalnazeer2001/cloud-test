// Field Communicator - off-grid emergency messenger and pocket computer for ESP32-S3.
#include "esp_log.h"
#include "app.h"
#include "display.h"
#include "buttons.h"
#include "leds.h"
#include "audio.h"
#include "store.h"
#include "comm.h"
#include "links.h"
#include "power.h"
#include "ui.h"

void apply_timezone(void);

void app_main(void)
{
    leds_init();
    led_set(LED_GREEN, true);
    store_init();                 // flash storage + settings (needed by Wi-Fi too)
    apply_timezone();
    disp_init();
    disp_text_big(4, 8, "FIELD");
    disp_text_big(4, 28, "COMM");
    disp_printf(80, 56, false, "v%s", FW_VERSION);
    disp_flush();

    buttons_init();
    audio_init();
    power_init();
    comm_init();
    espnow_link_init();
    lora_link_init();
    audio_rx_init();

    audio_tone(880, 80);
    audio_tone(1320, 120);
    led_set(LED_GREEN, false);
    ESP_LOGI("main", "node %s ready", g_set.name);
    ui_run();
}
