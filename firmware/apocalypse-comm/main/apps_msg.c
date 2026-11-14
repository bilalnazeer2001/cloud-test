// Messages, SOS beacon, radio settings, phone link, settings.
#include <string.h>
#include <stdio.h>
#include "esp_system.h"
#include "esp_heap_caps.h"
#include "app.h"
#include "ui.h"
#include "comm.h"
#include "store.h"
#include "links.h"
#include "morse.h"
#include "leds.h"
#include "audio.h"
#include "power.h"

static const char *const QUICK[] = {
    "I AM OK", "SOS - NEED HELP", "NEED MEDICAL HELP", "NEED WATER", "NEED FOOD",
    "DANGER - STAY AWAY", "SAFE PLACE HERE", "MEET AT RALLY POINT", "MOVING NOW",
    "COME TO ME", "ALL CLEAR", "WHO IS OUT THERE?",
};
#define N_QUICK (sizeof(QUICK) / sizeof(QUICK[0]))

static void send_with_choice(const char *text, uint8_t type)
{
    static const char *const how[] = { "Radio (all links)", "Audio modem", "Morse - sound", "Morse - light", "Radio + audio" };
    int c = ui_menu("Send how?", how, 5, 0);
    if (c < 0) return;
    ui_header("Sending");
    disp_text(0, UI_LINE(1), c == 0 ? "Transmitting..." : "Playing... (BACK=stop)", false);
    disp_flush();
    if (c == 0) {
        uint8_t used = comm_send_text(text, type, VIA_RADIO);
        ui_toast(used ? "Sent!" : "Radio not ready", 900);
    } else if (c == 1 || c == 4) {
        comm_send_text(text, type, c == 4 ? (VIA_RADIO | VIA_AFSK) : VIA_AFSK);
        ui_toast("Sent", 700);
    } else {
        morse_send(text, g_set.wpm, c == 2, c == 3, NULL);
    }
}

static void inbox(void)
{
    int sel = 0;
    for (;;) {
        int n = store_count();
        if (!n) { ui_textview("Inbox", "No messages yet.\n\nMessages from other nodes appear here."); return; }
        static char labels[STORE_MAX][DISP_COLS + 1];
        const char *items[STORE_MAX];
        for (int i = 0; i < n; i++) {
            msg_t m;
            store_get(i, &m);
            char mark = m.out ? '>' : m.type == PKT_SOS ? '!' : m.read ? ' ' : '*';
            snprintf(labels[i], sizeof(labels[i]), "%c%.6s:%s", mark, m.out ? "me" : m.name, m.text);
            items[i] = labels[i];
        }
        char title[22];
        snprintf(title, sizeof(title), "Inbox (%d)", n);
        sel = ui_menu(title, items, n, sel);
        if (sel < 0) return;
        msg_t m;
        store_get(sel, &m);
        store_mark_read(sel);
        char body[400], age[24];
        store_age(&m, age, sizeof(age));
        int k = snprintf(body, sizeof(body), "%s%s\n\n--\n%s\nvia %s", m.type == PKT_SOS ? "*** SOS ***\n" : "", m.text, age, via_name(m.via));
        if (!m.out && (m.via & VIA_RADIO)) {
            if (m.hops) snprintf(body + k, sizeof(body) - k, ", %d hop(s)", m.hops);
            else snprintf(body + k, sizeof(body) - k, ", %d dBm", m.rssi);
        }
        char t[22];
        snprintf(t, sizeof(t), "%s %.12s", m.out ? "To all" : "From", m.out ? "" : m.name);
        ui_textview(t, body);
    }
}

void app_messages(void)
{
    int sel = 0;
    for (;;) {
        char l0[22];
        int u = store_unread();
        snprintf(l0, sizeof(l0), u ? "Inbox (%d new)" : "Inbox", u);
        const char *items[] = { l0, "Write message", "Quick message", "Clear inbox" };
        sel = ui_menu("Messages", items, 4, sel);
        if (sel < 0) return;
        if (sel == 0) inbox();
        else if (sel == 1) {
            char text[MAX_TEXT + 1] = "";
            if (ui_text_input("Write  OK-hold=done", text, MAX_TEXT)) send_with_choice(text, PKT_MSG);
        } else if (sel == 2) {
            int q = ui_menu("Quick message", QUICK, N_QUICK, 0);
            if (q >= 0) send_with_choice(QUICK[q], q == 1 ? PKT_SOS : PKT_MSG);
        } else if (sel == 3 && ui_confirm("Delete all saved messages?")) {
            store_clear();
        }
    }
}

// Repeats an SOS on every link until stopped: radio packet every 30 s,
// Morse SOS on the speaker and flashing lights in between.
static volatile bool s_stop;
void app_sos(void)
{
    static const char *const opts[] = { "Radio + sound + light", "Radio + light (quiet)", "Light only (silent)" };
    int mode = ui_menu("SOS beacon", opts, 3, 0);
    if (mode < 0) return;
    char text[MAX_TEXT + 1] = "SOS - NEED HELP";
    if (!ui_confirm("Start SOS beacon? It repeats until you hold BACK.")) return;
    s_stop = false;
    uint32_t last_tx = 0, count = 0;
    buttons_flush();
    while (!s_stop) {
        if (mode < 2 && (last_tx == 0 || now_ms() - last_tx > 30000)) {
            char t[MAX_TEXT + 1];
            snprintf(t, sizeof(t), "%s (#%lu)", text, (unsigned long)++count);
            comm_send(t, PKT_SOS, VIA_RADIO, count == 1);   // only the first one is saved
            last_tx = now_ms();
        }
        ui_header("SOS ACTIVE");
        disp_text_big(10, 16, "S O S");
        disp_printf(0, 38, false, "Sent %lu times", (unsigned long)count);
        disp_printf(0, 47, false, "Next in %lus", (unsigned long)(mode < 2 ? (30000 - (now_ms() - last_tx)) / 1000 : 0));
        disp_text(0, 56, "Hold BACK to stop", false);
        disp_flush();
        morse_send("#", 10, mode == 0, true, &s_stop);
        btn_ev_t ev;
        uint32_t t0 = now_ms();
        while (now_ms() - t0 < 1500)
            if (buttons_get(&ev, 100) && ev.btn == BTN_BACK && ev.type == EV_LONG) s_stop = true;
    }
    led_set(LED_RED, false);
    led_set(LED_WHITE, false);
}

static void nodes_view(void)
{
    for (;;) {
        node_t n[16];
        int k = comm_nodes(n, 16);
        ui_header("Nodes heard");
        if (!k) disp_text(0, UI_LINE(1), "Nobody heard yet.", false);
        for (int i = 0; i < k && i < UI_LINES; i++) {
            uint32_t a = (now_ms() - n[i].last_ms) / 1000;
            char ag[8];
            if (a < 60) snprintf(ag, sizeof(ag), "%lus", (unsigned long)a);
            else if (a < 3600) snprintf(ag, sizeof(ag), "%lum", (unsigned long)(a / 60));
            else snprintf(ag, sizeof(ag), "%luh", (unsigned long)(a / 3600));
            if (n[i].hops) disp_printf(0, UI_LINE(i), false, "%-8.8s %dhop %s", n[i].name, n[i].hops, ag);
            else disp_printf(0, UI_LINE(i), false, "%-8.8s %4d %s %s", n[i].name, n[i].rssi, n[i].via & VIA_LORA ? "L" : "W", ag);
        }
        disp_flush();
        btn_ev_t ev;
        if (ui_event(&ev, 1000) && (ev.btn == BTN_BACK || ev.btn == BTN_OK)) return;
    }
}

static void ping(void)
{
    uint32_t t0 = now_ms();
    comm_ping();
    while (now_ms() - t0 < 4000) {
        node_t n[16];
        int k = comm_nodes(n, 16), fresh = 0;
        for (int i = 0; i < k; i++) if (n[i].last_ms >= t0) fresh++;
        ui_header("Ping");
        disp_printf(0, UI_LINE(1), false, "Waiting for answers..");
        char b[8];
        snprintf(b, sizeof(b), "%d", fresh);
        disp_text_big(56, 30, b);
        disp_flush();
        vTaskDelay(pdMS_TO_TICKS(200));
    }
    nodes_view();
}

void app_radio(void)
{
    int sel = 0;
    for (;;) {
        char l[6][22];
        snprintf(l[0], 22, "Channel: %d", g_set.channel);
        snprintf(l[1], 22, "Long range: %s", g_set.long_range ? "ON" : "OFF");
        snprintf(l[2], 22, "Relay (mesh): %s", g_set.relay ? "ON" : "OFF");
        snprintf(l[3], 22, "Beacon: %s", g_set.beacon ? "ON" : "OFF");
        if (lora_link_present()) snprintf(l[4], 22, "LoRa: OK %ddBm", lora_link_last_rssi());
        else snprintf(l[4], 22, "LoRa: not fitted");
        snprintf(l[5], 22, "Received: %lu", (unsigned long)comm_rx_count());
        const char *items[] = { "Nodes heard", "Ping everyone", l[0], l[1], l[2], l[3], l[4], l[5] };
        sel = ui_menu("Radio & mesh", items, 8, sel);
        if (sel < 0) return;
        switch (sel) {
        case 0: nodes_view(); break;
        case 1: ping(); break;
        case 2: {
            int v = ui_number("Channel (all same!)", g_set.channel, 1, 13, 1, "");
            if (v != INT32_MIN) { g_set.channel = v; settings_save(); espnow_link_apply(); }
            break;
        }
        case 3:
            if (!g_set.long_range && !ui_confirm("Long range only talks to other units with it ON. Enable?")) break;
            g_set.long_range = !g_set.long_range; settings_save(); espnow_link_apply(); break;
        case 4: g_set.relay = !g_set.relay; settings_save(); break;
        case 5: g_set.beacon = !g_set.beacon; settings_save(); break;
        default: break;
        }
    }
}

void app_phone(void)
{
    for (;;) {
        ui_header("Phone link");
        if (portal_running()) {
            disp_printf(0, UI_LINE(0), false, "WiFi: FIELDCOMM-%s", g_set.name);
            disp_printf(0, UI_LINE(1), false, "Pass: %s", g_set.ap_pass);
            disp_text(0, UI_LINE(2), "Open: 192.168.4.1", false);
            disp_printf(0, UI_LINE(3), false, "Phones joined: %d", portal_clients());
            disp_text(0, UI_LINE(5), "OK = turn hotspot OFF", false);
        } else {
            disp_text(0, UI_LINE(0), "Chat from a phone", false);
            disp_text(0, UI_LINE(1), "with a real keyboard.", false);
            disp_text(0, UI_LINE(2), "Uses more battery.", false);
            disp_text(0, UI_LINE(5), "OK = turn hotspot ON", false);
        }
        disp_flush();
        btn_ev_t ev;
        if (!ui_event(&ev, 1000)) continue;
        if (ev.btn == BTN_BACK) return;
        if (ev.btn == BTN_OK) {
            if (portal_running()) portal_stop(); else { ui_toast("Starting...", 0); portal_start(); }
        }
    }
}

void app_settings(void)
{
    int sel = 0;
    for (;;) {
        char l[7][22];
        snprintf(l[6], 22, "Power saver: %s", g_set.power_saver ? "ON" : "OFF");
        snprintf(l[0], 22, "Name: %s", g_set.name);
        snprintf(l[1], 22, "Volume: %d", g_set.volume);
        snprintf(l[2], 22, "Morse speed: %d wpm", g_set.wpm);
        snprintf(l[3], 22, "Morse tone: %d Hz", g_set.tone_hz);
        snprintf(l[4], 22, "Screen off: %ds", g_set.screen_s);
        snprintf(l[5], 22, "Modem listen: %s", g_set.modem_listen ? "ON" : "OFF");
        const char *items[] = { l[0], l[1], l[2], l[3], l[4], l[5], "About", "Restart", l[6], "Self test" };
        sel = ui_menu("Settings", items, 10, sel);
        if (sel < 0) return;
        int v;
        switch (sel) {
        case 0: {
            char b[NAME_LEN + 1];
            strncpy(b, g_set.name, NAME_LEN);
            b[NAME_LEN] = 0;
            if (ui_text_input("Your name / callsign", b, NAME_LEN - 1)) { strcpy(g_set.name, b); settings_save(); }
            break;
        }
        case 1: if ((v = ui_number("Volume", g_set.volume, 0, 10, 1, "")) != INT32_MIN) { g_set.volume = v; settings_save(); audio_beep(); } break;
        case 2: if ((v = ui_number("Morse speed", g_set.wpm, 5, 30, 1, "wpm")) != INT32_MIN) { g_set.wpm = v; settings_save(); } break;
        case 3: if ((v = ui_number("Morse tone", g_set.tone_hz, 400, 1200, 50, "Hz")) != INT32_MIN) { g_set.tone_hz = v; settings_save(); } break;
        case 4: if ((v = ui_number("Screen off after", g_set.screen_s, 0, 240, 15, "s")) != INT32_MIN) { g_set.screen_s = v; settings_save(); } break;
        case 5: g_set.modem_listen = !g_set.modem_listen; settings_save(); break;
        case 6: {
            char b[300];
            snprintf(b, sizeof(b),
                     "Field Communicator v%s\n\nNode ID: %08lX\nName: %s\nFree RAM: %u KB\nUptime: %lu min\n\n"
                     "Links: ESP-NOW radio%s, audio modem, Morse, phone hotspot.",
                     FW_VERSION, (unsigned long)g_node_id, g_set.name,
                     (unsigned)(heap_caps_get_free_size(MALLOC_CAP_DEFAULT) / 1024),
                     (unsigned long)(now_ms() / 60000), lora_link_present() ? ", LoRa" : "");
            ui_textview("About", b);
            break;
        }
        case 7: if (ui_confirm("Restart now?")) esp_restart(); break;
        case 8:
            if (!g_set.power_saver && !ui_confirm(lora_link_present()
                    ? "Turn Wi-Fi radio off? Only LoRa + audio will work. Battery lasts ~3x longer."
                    : "No LoRa fitted: radio messages will STOP. Only audio/Morse work. Continue?"))
                break;
            g_set.power_saver = !g_set.power_saver;
            settings_save();
            power_apply_saver();
            break;
        case 9: app_selftest(); break;
        }
    }
}
