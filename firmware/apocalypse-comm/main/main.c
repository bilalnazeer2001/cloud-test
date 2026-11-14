// Field Communicator - off-grid emergency messenger and pocket computer for ESP32-S3.
// Every part is optional: the firmware checks what is connected and adapts.
#include <stdio.h>
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
#include "selftest.h"
#include "ui.h"

void apply_timezone(void);

void app_main(void)
{
    leds_init();
    led_set(LED_GREEN, true);
    store_init();                 // flash storage + settings (needed by Wi-Fi too)
    apply_timezone();
    disp_init();
    disp_text_big(4, 4, "FIELD");
    disp_text_big(4, 22, "COMM");
    disp_printf(80, 4, false, "v%s", FW_VERSION);
    disp_flush();

    power_init();                 // ADC must be ready before the button task starts using it
    buttons_init();
    audio_init();
    comm_init();
    espnow_link_init();
    lora_link_init();
    audio_rx_init();
    power_apply_saver();

    // Hardware report: screen, serial log, and sound
    vTaskDelay(pdMS_TO_TICKS(1200));        // give the button ladder time to be detected
    hw_status_t h;
    hw_summary(&h);
    hw_log(&h);
    disp_printf(0, 40, false, "LoRa:%s Mic:%s", h.lora ? "OK" : "--", h.mic_level >= 0 ? "OK" : "--");
    disp_printf(0, 50, false, "Keys:%s Radio:%s", h.buttons ? "OK" : "--", h.wifi ? "OK" : "off");
    disp_flush();

    audio_tone(880, 80);
    audio_tone(1320, 120);
    if (!h.display) ui_say(h.buttons ? "OK" : "OK RELAY");   // no screen: say we're alive
    vTaskDelay(pdMS_TO_TICKS(1500));
    led_set(LED_GREEN, false);
    if (!h.buttons) ESP_LOGW("main", "no buttons found: working as an automatic relay / listener");
    ESP_LOGI("main", "node %s ready", g_set.name);
    ui_run();
}
