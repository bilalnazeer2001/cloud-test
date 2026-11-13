// Screen helpers: title bar, menus, text viewer, on-screen keyboard.
#include <string.h>
#include <stdio.h>
#include <time.h>
#include "app.h"
#include "ui.h"
#include "comm.h"
#include "store.h"
#include "audio.h"
#include "leds.h"
#include "morse.h"
#include "power.h"

static uint32_t s_last_input;
static bool s_screen_off;
static int s_last_unread;

// ------------------------------------------------------------ speaker-only mode
// With no screen, the device reads menus, numbers and messages in Morse code.
static QueueHandle_t s_sayq;
static volatile bool s_say_abort;

bool ui_headless(void) { return !disp_present(); }

static void say_task(void *arg)
{
    char buf[MAX_TEXT + 24];
    for (;;) {
        xQueueReceive(s_sayq, buf, portMAX_DELAY);
        s_say_abort = false;
        morse_send(buf, g_set.wpm < 18 ? 18 : g_set.wpm, true, false, &s_say_abort);
    }
}

void ui_say(const char *text)
{
    if (!ui_headless() || !audio_has_speaker() || !text) return;
    if (!s_sayq) {
        s_sayq = xQueueCreate(1, MAX_TEXT + 24);
        xTaskCreate(say_task, "say", 3072, NULL, 4, NULL);
    }
    char buf[MAX_TEXT + 24] = {0};
    strncpy(buf, text, sizeof(buf) - 1);
    s_say_abort = true;                          // interrupt whatever is being said
    xQueueOverwrite(s_sayq, buf);
}

static void say_stop(void) { s_say_abort = true; if (s_sayq) xQueueReset(s_sayq); }

void ui_header(const char *title)
{
    disp_clear();
    disp_fill_rect(0, 0, DISP_W, 9, true);
    disp_text(1, 1, title, true);

    char st[24];
    int n = 0, unread = store_unread();
    node_t nodes[16];
    int cnt = comm_nodes(nodes, 16), near = 0;
    for (int i = 0; i < cnt; i++) if (now_ms() - nodes[i].last_ms < 300000) near++;
    if (unread) n += snprintf(st + n, sizeof(st) - n, "M%d ", unread);
    n += snprintf(st + n, sizeof(st) - n, "N%d", near);
    int pct = power_battery_pct();
    if (pct >= 0) snprintf(st + n, sizeof(st) - n, " %d%%", pct);
    int w = strlen(st) * CHAR_W;
    disp_fill_rect(DISP_W - w - 3, 0, w + 3, 9, true);
    disp_text(DISP_W - w - 1, 1, st, true);
}

static void sos_popup(const char *who, const char *text)
{
    char b[MAX_TEXT + 24];
    snprintf(b, sizeof(b), "SOS %s %s", who, text);
    uint32_t t0 = now_ms();
    for (int blink = 0;; blink++) {
        if (blink % 40 == 1) ui_say(b);
        if (!buttons_present() && now_ms() - t0 > 30000) break;   // nobody can press OK
        disp_clear();
        if (blink & 1) disp_fill_rect(0, 0, DISP_W, 18, true);
        disp_text_big(28, 1, "! SOS !");
        disp_printf(0, 22, false, "From: %s", who);
        disp_text(0, 32, text, false);
        if (strlen(text) > DISP_COLS) disp_text(0, 41, text + DISP_COLS, false);
        disp_text(0, 56, "OK = I understand", false);
        disp_flush();
        btn_ev_t ev;
        if (buttons_get(&ev, 400) && ev.btn == BTN_OK) break;
    }
    led_set(LED_RED, false);
}

bool ui_event(btn_ev_t *ev, uint32_t timeout_ms)
{
    uint32_t start = now_ms();
    for (;;) {
        uint32_t slice = timeout_ms < 200 ? timeout_ms : 200;
        bool got = buttons_get(ev, slice);
        char who[NAME_LEN + 1], text[MAX_TEXT + 1];
        if (comm_take_sos(who, text)) {
            if (s_screen_off) { disp_power(true); s_screen_off = false; }
            sos_popup(who, text);
            s_last_input = now_ms();
            return false;
        }
        int unread = store_unread();
        if (unread > s_last_unread) {
            if (s_screen_off) { disp_power(true); s_screen_off = false; s_last_input = now_ms(); }
            msg_t m;
            if (ui_headless() && store_get(0, &m) && !m.out) {
                char b[MAX_TEXT + 24];
                snprintf(b, sizeof(b), "MSG %s %s", m.name, m.text);
                vTaskDelay(pdMS_TO_TICKS(600));      // let the alert sound finish
                ui_say(b);
            }
        }
        s_last_unread = unread;

        static uint32_t last_bat_warn;               // low battery reminder every 10 min
        int pct = power_battery_pct();
        if (pct >= 0 && pct < 10 && (!last_bat_warn || now_ms() - last_bat_warn > 600000)) {
            last_bat_warn = now_ms();
            audio_alert();
            ui_say("LOW BAT");
        }

        if (got) {
            s_last_input = now_ms();
            if (s_screen_off) {                      // first press only wakes the screen
                disp_power(true);
                s_screen_off = false;
                if (ev->btn != BTN_MORSE) continue;
            }
            if (ev->btn != BTN_MORSE && (ev->type == EV_CLICK || ev->type == EV_LONG)) {
                say_stop();
                audio_click(ev->btn);
            }
            return true;
        }
        if (g_set.screen_s && !s_screen_off && now_ms() - s_last_input > g_set.screen_s * 1000u) {
            disp_power(false);
            s_screen_off = true;
        }
        if (timeout_ms != UINT32_MAX && now_ms() - start >= timeout_ms) return false;
    }
}

int ui_menu(const char *title, const char *const *items, int n, int start)
{
    int sel = start < n ? start : 0, top = 0, said = -1;
    for (;;) {
        if (sel != said) { ui_say(items[sel]); said = sel; }
        if (sel < top) top = sel;
        if (sel >= top + UI_LINES) top = sel - UI_LINES + 1;
        ui_header(title);
        for (int i = 0; i < UI_LINES && top + i < n; i++) {
            int y = UI_LINE(i);
            if (top + i == sel) disp_fill_rect(0, y - 1, DISP_W - 4, 9, true);
            disp_text(2, y, items[top + i], top + i == sel);
        }
        if (n > UI_LINES) {                          // scroll bar
            int h = 54 * UI_LINES / n, y = 10 + (54 - h) * top / (n - UI_LINES);
            disp_fill_rect(DISP_W - 2, y, 2, h, true);
        }
        disp_flush();
        btn_ev_t ev;
        if (!ui_event(&ev, 1000)) continue;
        if (ev.btn == BTN_UP) sel = (sel + n - 1) % n;
        else if (ev.btn == BTN_DOWN) sel = (sel + 1) % n;
        else if (ev.btn == BTN_LEFT) sel = sel >= UI_LINES ? sel - UI_LINES : 0;
        else if (ev.btn == BTN_RIGHT) sel = sel + UI_LINES < n ? sel + UI_LINES : n - 1;
        else if (ev.btn == BTN_OK && ev.type == EV_CLICK) return sel;
        else if (ev.btn == BTN_BACK) return -1;
    }
}

// Word-wrap text into lines of DISP_COLS chars. Returns number of lines.
static int wrap(const char *text, char lines[][DISP_COLS + 1], int max)
{
    int n = 0;
    const char *p = text;
    while (*p && n < max) {
        if (*p == '\n') { lines[n++][0] = 0; p++; continue; }
        int len = 0, brk = -1;
        while (p[len] && p[len] != '\n' && len < DISP_COLS) { if (p[len] == ' ') brk = len; len++; }
        if (p[len] && p[len] != '\n' && p[len] != ' ' && brk > 0) len = brk;
        memcpy(lines[n], p, len);
        lines[n][len] = 0;
        n++;
        p += len;
        if (*p == ' ' || *p == '\n') p++;
    }
    return n;
}

void ui_textview(const char *title, const char *text)
{
    static char lines[120][DISP_COLS + 1];
    int n = wrap(text, lines, 120), top = 0;
    ui_say(text);
    for (;;) {
        ui_header(title);
        for (int i = 0; i < UI_LINES && top + i < n; i++) disp_text(0, UI_LINE(i), lines[top + i], false);
        if (n > UI_LINES) {
            int h = 54 * UI_LINES / n, y = 10 + (54 - h) * top / (n - UI_LINES);
            disp_fill_rect(DISP_W - 2, y, 2, h, true);
        }
        disp_flush();
        btn_ev_t ev;
        if (!ui_event(&ev, 1000)) continue;
        int maxtop = n > UI_LINES ? n - UI_LINES : 0;
        if (ev.btn == BTN_UP && top > 0) top--;
        else if (ev.btn == BTN_DOWN && top < maxtop) top++;
        else if (ev.btn == BTN_LEFT) top = top > UI_LINES ? top - UI_LINES : 0;
        else if (ev.btn == BTN_RIGHT) top = top + UI_LINES < maxtop ? top + UI_LINES : maxtop;
        else if (ev.btn == BTN_OK && ui_headless()) ui_say(text);      // OK = read again
        else if (ev.btn == BTN_BACK || ev.btn == BTN_OK) return;
    }
}

bool ui_confirm(const char *q)
{
    int sel = 0, said = -1;
    for (;;) {
        if (said != sel) {
            char b[MAX_TEXT + 24];
            snprintf(b, sizeof(b), said < 0 ? "%.40s %s" : "%.0s%s", q, sel ? "YES" : "NO");
            ui_say(b);
            said = sel;
        }
        ui_header("Are you sure?");
        char lines[4][DISP_COLS + 1];
        int n = wrap(q, lines, 3);
        for (int i = 0; i < n; i++) disp_text(0, UI_LINE(i), lines[i], false);
        disp_text(20, UI_LINE(4), " NO ", sel == 0);
        disp_text(76, UI_LINE(4), " YES ", sel == 1);
        disp_flush();
        btn_ev_t ev;
        if (!ui_event(&ev, 1000)) continue;
        if (ev.btn == BTN_LEFT || ev.btn == BTN_RIGHT || ev.btn == BTN_UP || ev.btn == BTN_DOWN) sel ^= 1;
        else if (ev.btn == BTN_OK) return sel == 1;
        else if (ev.btn == BTN_BACK) return false;
    }
}

void ui_toast(const char *msg, uint32_t ms)
{
    disp_fill_rect(6, 20, DISP_W - 12, 24, false);
    disp_rect(6, 20, DISP_W - 12, 24);
    int w = strlen(msg) * CHAR_W;
    if (w > DISP_W - 16) w = DISP_W - 16;
    disp_text((DISP_W - w) / 2, 28, msg, false);
    disp_flush();
    ui_say(msg);
    if (ms) vTaskDelay(pdMS_TO_TICKS(ms));
}

int ui_number(const char *title, int val, int min, int max, int step, const char *unit)
{
    for (;;) {
        ui_header(title);
        char b[24];
        snprintf(b, sizeof(b), "%d %s", val, unit ? unit : "");
        static int said = INT32_MIN;
        if (said != val) { char n[12]; snprintf(n, sizeof(n), "%d", val); ui_say(n); said = val; }
        disp_text_big((DISP_W - strlen(b) * 12) / 2, 24, b);
        disp_text(0, 55, "UP/DN change  OK save", false);
        disp_flush();
        btn_ev_t ev;
        if (!ui_event(&ev, 1000)) continue;
        if (ev.btn == BTN_UP || ev.btn == BTN_RIGHT) val = val + step > max ? max : val + step;
        else if (ev.btn == BTN_DOWN || ev.btn == BTN_LEFT) val = val - step < min ? min : val - step;
        else if (ev.btn == BTN_OK) return val;
        else if (ev.btn == BTN_BACK) return INT32_MIN;
    }
}

// ------------------------------------------------------------ keyboard
static const char *KB[4] = { "ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "0123456789.,?", "!-/@:'()+=&#_" };
#define KB_COLS 13

bool ui_text_input(const char *title, char *buf, int max)
{
    int r = 0, c = 0, len = strlen(buf);
    morse_dec_t md;
    morse_dec_init(&md, 1200.0f / g_set.wpm, true);
    uint32_t key_up_at = 0;
    bool key_down = false;
    int said_r = -1, said_c = -1;

    for (;;) {
        if (r != said_r || c != said_c) {
            char ch[8] = {KB[r][c], 0};
            ui_say(ch[0] == '_' ? "SPACE" : ch);
            said_r = r; said_c = c;
        }
        ui_header(title);
        // last 42 characters of the text, with a cursor
        int start = len > 2 * DISP_COLS - 1 ? len - (2 * DISP_COLS - 1) : 0;
        char l1[DISP_COLS + 1] = {0}, l2[DISP_COLS + 1] = {0};
        char tmp[2 * DISP_COLS + 1];
        snprintf(tmp, sizeof(tmp), "%s_", buf + start);
        strncpy(l1, tmp, DISP_COLS);
        if (strlen(tmp) > DISP_COLS) strncpy(l2, tmp + DISP_COLS, DISP_COLS);
        disp_text(0, 10, l1, false);
        disp_text(0, 19, l2, false);
        if (md.len) disp_text(DISP_W - md.len * CHAR_W, 19, md.code, true);   // morse in progress
        for (int i = 0; i < 4; i++)
            for (int j = 0; j < KB_COLS; j++) {
                char s[2] = {KB[i][j], 0};
                int x = 5 + j * 9, y = 29 + i * 9;
                if (i == r && j == c) disp_fill_rect(x - 2, y - 1, 9, 9, true);
                disp_text(x, y, s, i == r && j == c);
            }
        disp_flush();

        btn_ev_t ev;
        bool got = ui_event(&ev, md.len || md.word_pending ? 30 : 1000);
        if (!key_down && key_up_at) {
            char ch = morse_dec_gap(&md, now_ms() - key_up_at);
            if (ch == '#') ch = 0;
            if (ch && len < max && !(ch == ' ' && (len == 0 || buf[len - 1] == ' '))) { buf[len++] = ch; buf[len] = 0; }
        }
        if (!got) continue;
        if (ev.btn == BTN_MORSE) {
            if (ev.type == EV_DOWN) { key_down = true; audio_sidetone(true); led_set(LED_BLUE, true); }
            else { key_down = false; audio_sidetone(false); led_set(LED_BLUE, false); morse_dec_mark(&md, ev.held_ms); key_up_at = now_ms(); }
            continue;
        }
        switch (ev.btn) {
        case BTN_UP:    r = (r + 3) % 4; break;
        case BTN_DOWN:  r = (r + 1) % 4; break;
        case BTN_LEFT:  c = (c + KB_COLS - 1) % KB_COLS; break;
        case BTN_RIGHT: c = (c + 1) % KB_COLS; break;
        case BTN_OK:
            if (ev.type == EV_LONG) return len > 0;
            if (len < max) { char ch = KB[r][c]; buf[len++] = ch == '_' ? ' ' : ch; buf[len] = 0; }
            break;
        case BTN_BACK:
            if (ev.type == EV_LONG) return false;
            if (len) buf[--len] = 0;
            break;
        default: break;
        }
    }
}

// ------------------------------------------------------------ main menu
void ui_run(void)
{
    static const char *const items[] = {
        "Messages", "SOS beacon", "Radio & mesh", "Audio / Morse", "Tools", "Phone link", "Settings",
    };
    int sel = 0;
    s_last_input = now_ms();
    for (;;) {
        char title[22];
        time_t t = time(NULL);
        if (t > 1700000000) {
            struct tm tm;
            localtime_r(&t, &tm);
            strftime(title, sizeof(title), "%H:%M", &tm);
        } else {
            snprintf(title, sizeof(title), "%s", g_set.name);
        }
        sel = ui_menu(title, items, 7, sel);
        switch (sel) {
        case 0: app_messages(); break;
        case 1: app_sos(); break;
        case 2: app_radio(); break;
        case 3: app_audio(); break;
        case 4: app_tools(); break;
        case 5: app_phone(); break;
        case 6: app_settings(); break;
        default: sel = 0; break;
        }
    }
}
