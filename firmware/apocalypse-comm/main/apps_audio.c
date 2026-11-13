// Microphone listener (audio modem + Morse decoder) and the Audio/Morse menu.
#include <string.h>
#include <stdio.h>
#include <math.h>
#include "app.h"
#include "ui.h"
#include "audio.h"
#include "afsk.h"
#include "morse.h"
#include "comm.h"
#include "links.h"
#include "leds.h"

typedef enum { RX_OFF, RX_MODEM, RX_MORSE } rx_mode_t;
static volatile rx_mode_t s_mode = RX_OFF;
static volatile bool s_sending;
static volatile int s_level;                // 0..100 for meters
static volatile bool s_tone_on;
static volatile float s_wpm;
static char s_text[256];                    // decoded Morse text ring
static volatile int s_text_len;
static volatile uint32_t s_modem_pkts;

static void on_modem_packet(const uint8_t *d, int len)
{
    s_modem_pkts++;
    comm_rx(d, len, 0, VIA_AFSK);
}

void afsk_link_send(const uint8_t *data, int len)
{
    s_sending = true;                       // don't decode our own speaker
    led_set(LED_BLUE, true);
    afsk_send(data, len);
    led_set(LED_BLUE, false);
    vTaskDelay(pdMS_TO_TICKS(100));
    s_sending = false;
}

static void push_char(char c)
{
    if (s_text_len >= (int)sizeof(s_text) - 1) {
        memmove(s_text, s_text + 64, s_text_len - 64);
        s_text_len -= 64;
    }
    s_text[s_text_len++] = c;
    s_text[s_text_len] = 0;
}

static float goertzel(const int16_t *x, int n, float f)
{
    float c = 2.0f * cosf(2.0f * (float)M_PI * f / AUDIO_RATE), s1 = 0, s2 = 0;
    for (int i = 0; i < n; i++) { float s = x[i] + c * s1 - s2; s2 = s1; s1 = s; }
    return s1 * s1 + s2 * s2 - c * s1 * s2;
}

#define MBLK 64                             // 4 ms blocks for Morse detection

static void rx_task(void *arg)
{
    static int16_t buf[MBLK];
    rx_mode_t last = RX_OFF;
    morse_dec_t md;
    float noise = 1e6f;
    bool on = false;
    uint32_t run_ms = 0;

    for (;;) {
        rx_mode_t mode = s_mode;
        if (mode == RX_OFF && g_set.modem_listen) mode = RX_MODEM;
        if (mode != last) {
            audio_mic_enable(mode != RX_OFF);
            if (mode == RX_MODEM) afsk_rx_reset(on_modem_packet);
            if (mode == RX_MORSE) { morse_dec_init(&md, 1200.0f / g_set.wpm, true); on = false; run_ms = 0; }
            last = mode;
        }
        if (mode == RX_OFF) { vTaskDelay(pdMS_TO_TICKS(100)); continue; }
        size_t n = audio_mic_read(buf, MBLK, 100);
        if (n < MBLK) { vTaskDelay(pdMS_TO_TICKS(10)); continue; }
        if (s_sending) continue;

        if (mode == RX_MODEM) {
            afsk_rx_feed(buf, n);
            s_level = afsk_rx_level();
            continue;
        }

        // Morse: strongest tone between 400 and 1200 Hz
        float best = 0;
        for (int f = 400; f <= 1200; f += 100) { float p = goertzel(buf, MBLK, f); if (p > best) best = p; }
        float floor_ = noise < 2e6f ? 2e6f : noise;
        bool now_on = on ? best > floor_ * 3 : best > floor_ * 8;
        if (!now_on) noise = noise * 0.97f + best * 0.03f;
        float db = 10.0f * log10f(best / floor_ + 1);
        s_level = db > 30 ? 100 : (int)(db * 3.3f);
        if (now_on != on) {
            if (on) morse_dec_mark(&md, run_ms);             // tone just ended
            on = now_on;
            run_ms = 0;
            s_tone_on = on;
            led_set(LED_GREEN, on);
        }
        run_ms += MBLK * 1000 / AUDIO_RATE;
        if (!on) { char c = morse_dec_gap(&md, run_ms); if (c) push_char(c); }
        s_wpm = 1200.0f / md.dot_ms;
    }
}

void audio_rx_init(void)
{
    xTaskCreate(rx_task, "audio_rx", 4096, NULL, 6, NULL);
}

static void meter(int y, int level)
{
    disp_rect(0, y, DISP_W, 7);
    disp_fill_rect(1, y + 1, (DISP_W - 2) * level / 100, 5, true);
}

static void modem_listen(void)
{
    s_mode = RX_MODEM;
    uint32_t start_pkts = s_modem_pkts;
    for (;;) {
        ui_header("Modem listening");
        disp_text(0, UI_LINE(0), "Signal quality:", false);
        meter(UI_LINE(1), s_level);
        disp_printf(0, UI_LINE(3), false, "Packets: %lu", (unsigned long)(s_modem_pkts - start_pkts));
        disp_text(0, UI_LINE(4), "Messages go to Inbox", false);
        disp_text(0, UI_LINE(5), "BACK = stop", false);
        disp_flush();
        btn_ev_t ev;
        if (ui_event(&ev, 150) && ev.btn == BTN_BACK) break;
    }
    s_mode = RX_OFF;
}

static void morse_listen(void)
{
    s_text_len = 0;
    s_text[0] = 0;
    s_mode = RX_MORSE;
    for (;;) {
        ui_header("Morse decoder");
        meter(10, s_level);
        disp_printf(0, 19, s_tone_on, "%s ~%d wpm", s_tone_on ? "TONE" : "    ", (int)s_wpm);
        int len = s_text_len, shown = 4 * DISP_COLS, st = len > shown ? len - shown : 0;
        for (int i = 0; i < 4; i++) {
            char line[DISP_COLS + 1] = {0};
            if (st + i * DISP_COLS < len) strncpy(line, s_text + st + i * DISP_COLS, DISP_COLS);
            disp_text(0, 28 + i * 9, line, false);
        }
        disp_flush();
        btn_ev_t ev;
        if (ui_event(&ev, 100)) {
            if (ev.btn == BTN_BACK) break;
            if (ev.btn == BTN_OK) { s_text_len = 0; s_text[0] = 0; }
        }
    }
    s_mode = RX_OFF;
    led_set(LED_GREEN, false);
}

static void morse_trainer(void)
{
    morse_dec_t md;
    morse_dec_init(&md, 1200.0f / g_set.wpm, false);
    char out[4 * DISP_COLS + 1] = "";
    uint32_t up_at = 0;
    bool down = false;
    int target = 0;
    const char *letters = "ETIANMSURWDKGOHVFLPJBXCYZQ0123456789";
    for (;;) {
        ui_header("Morse practice");
        disp_printf(0, 10, false, "Send: %c  %s", letters[target], morse_code(letters[target]));
        disp_printf(0, 19, false, "Key: %s", md.code);
        disp_text(0, 28, out, false);
        if (strlen(out) > DISP_COLS) disp_text(0, 37, out + DISP_COLS, false);
        disp_text(0, 55, "MORSE key  OK=next", false);
        disp_flush();
        btn_ev_t ev;
        bool got = ui_event(&ev, 30);
        if (!down && up_at) {
            char c = morse_dec_gap(&md, now_ms() - up_at);
            if (c && c != ' ') {
                if (strlen(out) >= 2 * DISP_COLS) out[0] = 0;
                strncat(out, (char[]){c, 0}, sizeof(out) - strlen(out) - 1);
                if (c == letters[target]) { audio_beep(); target = (target + 1) % strlen(letters); }
            }
        }
        if (!got) continue;
        if (ev.btn == BTN_MORSE) {
            if (ev.type == EV_DOWN) { down = true; audio_sidetone(true); led_set(LED_BLUE, true); }
            else { down = false; audio_sidetone(false); led_set(LED_BLUE, false); morse_dec_mark(&md, ev.held_ms); up_at = now_ms(); }
        } else if (ev.btn == BTN_OK) target = (target + 1) % strlen(letters);
        else if (ev.btn == BTN_BACK) break;
    }
    audio_sidetone(false);
}

static void morse_table(void)
{
    static char t[900];
    int n = 0;
    const char *chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?/";
    for (const char *c = chars; *c; c++) n += snprintf(t + n, sizeof(t) - n, "%c %-6s%s", *c, morse_code(*c), ((c - chars) % 2) ? "\n" : "   ");
    snprintf(t + n, sizeof(t) - n, "\nSOS ...---...\n(no gaps)\n\nDot=1 Dash=3\nLetter gap=3\nWord gap=7");
    ui_textview("Morse code", t);
}

static void flash_message(bool sound, bool light)
{
    char text[MAX_TEXT + 1] = "";
    if (!ui_text_input("Text to send", text, MAX_TEXT)) return;
    ui_header("Playing Morse");
    disp_text(0, UI_LINE(1), text, false);
    disp_flush();
    morse_send(text, g_set.wpm, sound, light, NULL);
}

void app_audio(void)
{
    int sel = 0;
    static const char *const items[] = {
        "Modem: listen", "Morse: decode (mic)", "Morse: practice key", "Morse: play text", "Morse: flash light",
        "Morse code table", "Test tone",
    };
    for (;;) {
        sel = ui_menu("Audio / Morse", items, 7, sel);
        switch (sel) {
        case -1: return;
        case 0: modem_listen(); break;
        case 1: morse_listen(); break;
        case 2: morse_trainer(); break;
        case 3: flash_message(true, false); break;
        case 4: flash_message(false, true); break;
        case 5: morse_table(); break;
        case 6: ui_toast("Beep!", 0); audio_tone(AFSK_MARK, 500); audio_tone(AFSK_SPACE, 500); break;
        }
    }
}
