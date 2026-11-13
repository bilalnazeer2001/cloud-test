// Hardware self-test: checks every part and says which ones work.
// Results are shown on screen, spoken in Morse (no screen), and printed on USB serial.
#include <string.h>
#include <stdio.h>
#include "esp_log.h"
#include "app.h"
#include "ui.h"
#include "audio.h"
#include "leds.h"
#include "links.h"
#include "comm.h"
#include "power.h"
#include "selftest.h"

static const char *TAG = "selftest";

void hw_summary(hw_status_t *h)
{
    h->display = disp_present();
    h->speaker = audio_has_speaker();
    h->mic_level = mic_check();
    h->buttons = buttons_present();
    h->lora = lora_link_present();
    h->wifi = espnow_link_active();
    h->battery_mv = power_battery_mv();
}

void hw_log(const hw_status_t *h)
{
    ESP_LOGI(TAG, "display : %s", h->display ? "OK" : "not found");
    ESP_LOGI(TAG, "speaker : %s", h->speaker ? "configured" : "none");
    if (h->mic_level < 0) ESP_LOGI(TAG, "mic     : not found");
    else ESP_LOGI(TAG, "mic     : OK (noise %d)", h->mic_level);
    ESP_LOGI(TAG, "buttons : %s", h->buttons ? "OK" : "not found");
    ESP_LOGI(TAG, "LoRa    : %s", h->lora ? "OK" : "not found");
    ESP_LOGI(TAG, "Wi-Fi   : %s", h->wifi ? "on" : "off (power saver)");
    if (h->battery_mv >= 2500) ESP_LOGI(TAG, "battery : %d mV", h->battery_mv);
    else ESP_LOGI(TAG, "battery : not measured");
}

static bool ask(const char *title, const char *q)
{
    ui_say(q);
    for (;;) {
        ui_header(title);
        disp_text(0, UI_LINE(1), q, false);
        disp_text(0, UI_LINE(4), "OK = yes  BACK = no", false);
        disp_flush();
        btn_ev_t ev;
        if (!ui_event(&ev, 1000)) continue;
        if (ev.btn == BTN_OK) return true;
        if (ev.btn == BTN_BACK) return false;
    }
}

static void test_buttons(bool *ok)
{
    static const char NAMES[BTN_COUNT] = {'U', 'D', 'L', 'R', 'O', 'B', 'M'};
    buttons_clear_seen();
    uint32_t t0 = now_ms();
    for (;;) {
        uint8_t seen = buttons_seen_mask();
        ui_header("Press every button");
        for (int b = 0; b < BTN_COUNT; b++) {
            char s[2] = {NAMES[b], 0};
            disp_text(8 + b * 16, UI_LINE(1), s, seen & (1 << b));
        }
        disp_text(0, UI_LINE(3), "U D L R OK BACK MORSE", false);
        disp_text(0, UI_LINE(5), "Hold BACK = skip", false);
        disp_flush();
        if (seen == (1 << BTN_COUNT) - 1) { *ok = true; ui_say("BUTTONS OK"); vTaskDelay(pdMS_TO_TICKS(800)); return; }
        btn_ev_t ev;
        if (ui_event(&ev, 100) && ev.btn == BTN_BACK && ev.type == EV_LONG) { *ok = false; return; }
        if (now_ms() - t0 > 60000) { *ok = false; return; }
    }
}

void app_selftest(void)
{
    hw_status_t h;
    ui_header("Self test");
    disp_text(0, UI_LINE(1), "Checking parts...", false);
    disp_flush();
    hw_summary(&h);
    hw_log(&h);

    // 1. Speaker
    ui_header("Speaker test");
    disp_text(0, UI_LINE(1), "Playing 3 beeps...", false);
    disp_flush();
    for (int i = 0; i < 3; i++) { audio_tone(600 + i * 300, 200); audio_silence(100); }
    ui_say("BEEP OK");
    bool spk = ask("Speaker test", "Did you hear beeps?");

    // 2. LEDs and screen flash
    ui_header("Light test");
    disp_text(0, UI_LINE(1), "Watch the LEDs", false);
    disp_flush();
    for (int l = 0; l < LED_COUNT; l++) { led_set(l, true); vTaskDelay(pdMS_TO_TICKS(300)); led_set(l, false); vTaskDelay(pdMS_TO_TICKS(100)); }
    for (int i = 0; i < 2; i++) { disp_invert(true); vTaskDelay(pdMS_TO_TICKS(200)); disp_invert(false); vTaskDelay(pdMS_TO_TICKS(200)); }
    bool leds = ask("Light test", "Did a light blink?");

    // 3. Buttons
    bool btn = false;
    if (h.buttons) test_buttons(&btn);

    // 4. Radio
    ui_header("Radio test");
    disp_text(0, UI_LINE(1), "Pinging other units", false);
    disp_text(0, UI_LINE(2), "(4 seconds)...", false);
    disp_flush();
    uint32_t t0 = now_ms();
    comm_ping();
    vTaskDelay(pdMS_TO_TICKS(4000));
    node_t n[16];
    int k = comm_nodes(n, 16), answers = 0;
    for (int i = 0; i < k; i++) if (n[i].last_ms >= t0) answers++;

    // Summary
    char rep[400];
    snprintf(rep, sizeof(rep),
             "Screen:  %s\nSpeaker: %s\nMic:     %s\nButtons: %s\nLights:  %s\nLoRa:    %s\nWi-Fi:   %s\nBattery: %s\nOther units heard: %d\n\n%s",
             h.display ? "OK" : "MISSING", spk ? "OK" : "FAIL", h.mic_level >= 0 ? "OK" : "MISSING",
             !h.buttons ? "MISSING" : btn ? "OK" : "NOT ALL", leds ? "OK" : "FAIL",
             h.lora ? "OK" : "missing", h.wifi ? "on" : "off (saver)",
             h.battery_mv >= 2500 ? "OK" : "not wired", answers,
             answers ? "" : "(0 is normal if no other unit is switched on)");
    ESP_LOGI(TAG, "summary:\n%s", rep);

    char spoken[64];
    snprintf(spoken, sizeof(spoken), "%s%s%s%s", h.mic_level < 0 ? "NO MIC " : "", !h.lora ? "NO LORA " : "",
             !spk ? "SPK FAIL " : "", "END");
    ui_say(spoken);
    ui_textview("Test results", rep);
}
