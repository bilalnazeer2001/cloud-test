// The "basic computer": calculator, timers, flashlight, notes, counters, guides.
#include <string.h>
#include <stdio.h>
#include "esp_random.h"
#include "app.h"
#include "ui.h"
#include "calc.h"
#include "leds.h"
#include "audio.h"
#include "store.h"
#include "power.h"

// ------------------------------------------------------------ calculator
static void calculator(void)
{
    static const char *const K[4][6] = {
        {"7", "8", "9", "/", "C", "("},
        {"4", "5", "6", "*", "DEL", ")"},
        {"1", "2", "3", "-", "^", "sqr"},
        {"0", ".", "=", "+", "ans", "%"},
    };
    char ex[64] = "", res[24] = "";
    int r = 3, c = 0;
    for (;;) {
        ui_header("Calculator");
        int l = strlen(ex);
        disp_text(0, 10, l > DISP_COLS ? ex + l - DISP_COLS : ex, false);
        disp_text(DISP_W - strlen(res) * CHAR_W, 19, res, false);
        for (int i = 0; i < 4; i++)
            for (int j = 0; j < 6; j++) {
                int x = j * 21, y = 29 + i * 9;
                bool s = i == r && j == c;
                if (s) disp_fill_rect(x, y - 1, 21, 9, true);
                disp_text(x + (21 - strlen(K[i][j]) * CHAR_W) / 2, y, K[i][j], s);
            }
        disp_flush();
        btn_ev_t ev;
        if (!ui_event(&ev, 1000)) continue;
        switch (ev.btn) {
        case BTN_UP: r = (r + 3) % 4; break;
        case BTN_DOWN: r = (r + 1) % 4; break;
        case BTN_LEFT: c = (c + 5) % 6; break;
        case BTN_RIGHT: c = (c + 1) % 6; break;
        case BTN_BACK:
            if (ev.type == EV_LONG || !ex[0]) return;
            ex[strlen(ex) - 1] = 0;
            break;
        case BTN_OK: {
            const char *k = K[r][c];
            if (!strcmp(k, "C")) { ex[0] = 0; res[0] = 0; }
            else if (!strcmp(k, "DEL")) { if (ex[0]) ex[strlen(ex) - 1] = 0; }
            else if (!strcmp(k, "=")) {
                double v;
                if (calc_eval(ex, &v)) snprintf(res, sizeof(res), "= %.10g", v);
                else snprintf(res, sizeof(res), "error");
            } else if (strlen(ex) + strlen(k) + 1 < sizeof(ex)) {
                strcat(ex, k);
                if (!strcmp(k, "sqr")) strcat(ex, "(");
            }
            break;
        }
        default: break;
        }
    }
}

// ------------------------------------------------------------ stopwatch
static void stopwatch(void)
{
    bool run = false;
    uint32_t acc = 0, start = 0, lap = 0;
    for (;;) {
        uint32_t t = acc + (run ? now_ms() - start : 0);
        ui_header("Stopwatch");
        char b[16];
        snprintf(b, sizeof(b), "%02lu:%02lu.%lu", (unsigned long)(t / 60000), (unsigned long)(t / 1000 % 60), (unsigned long)(t / 100 % 10));
        disp_text_big(10, 20, b);
        if (lap) disp_printf(0, 44, false, "Lap: %lu.%lus", (unsigned long)(lap / 1000), (unsigned long)(lap / 100 % 10));
        disp_text(0, 55, "OK=go/stop  >=lap", false);
        disp_flush();
        btn_ev_t ev;
        if (!ui_event(&ev, 100)) continue;
        if (ev.btn == BTN_OK) {
            if (ev.type == EV_LONG) { run = false; acc = lap = 0; }
            else if (run) { acc += now_ms() - start; run = false; }
            else { start = now_ms(); run = true; }
        } else if (ev.btn == BTN_RIGHT) lap = t;
        else if (ev.btn == BTN_BACK) return;
    }
}

// ------------------------------------------------------------ countdown
static void countdown(void)
{
    int mins = ui_number("Timer minutes", 5, 1, 600, 1, "min");
    if (mins == INT32_MIN) return;
    uint32_t end = now_ms() + mins * 60000u;
    for (;;) {
        int32_t left = (int32_t)(end - now_ms());
        ui_header("Timer");
        char b[16];
        if (left < 0) left = 0;
        snprintf(b, sizeof(b), "%02ld:%02ld", (long)(left / 60000), (long)(left / 1000 % 60));
        disp_text_big(34, 20, b);
        disp_text(0, 55, left ? "BACK = cancel" : "TIME UP! OK = stop", false);
        disp_flush();
        if (!left) { led_pulse(LED_RED, 300); audio_alert(); }
        btn_ev_t ev;
        if (ui_event(&ev, left ? 200 : 700) && (ev.btn == BTN_BACK || (ev.btn == BTN_OK && !left))) return;
    }
}

// ------------------------------------------------------------ flashlight
static void flashlight(void)
{
    static const char *const modes[] = { "Off", "On", "Strobe", "Slow blink (marker)", "SOS" };
    int m = 1;
    led_set(LED_WHITE, true);
    for (;;) {
        ui_header("Flashlight");
        disp_text_big(10, 20, modes[m]);
        disp_text(0, 55, "UP/DOWN = mode", false);
        disp_flush();
        btn_ev_t ev;
        bool got = ui_event(&ev, 50);
        uint32_t t = now_ms();
        switch (m) {
        case 0: led_set(LED_WHITE, false); break;
        case 1: led_set(LED_WHITE, true); break;
        case 2: led_set(LED_WHITE, (t / 60) % 2); break;
        case 3: led_set(LED_WHITE, (t % 3000) < 150); break;
        case 4: {                                   // ... --- ...  in a 6 s loop
            static const char *pat = "1010100011101110111000101010000000";
            led_set(LED_WHITE, pat[(t / 180) % strlen(pat)] == '1');
            break;
        }
        }
        if (!got) continue;
        if (ev.btn == BTN_UP) m = (m + 1) % 5;
        else if (ev.btn == BTN_DOWN) m = (m + 4) % 5;
        else if (ev.btn == BTN_BACK) break;
    }
    led_set(LED_WHITE, false);
}

// ------------------------------------------------------------ notes
static void notes(void)
{
    int sel = 0;
    for (;;) {
        static char labels[NOTES_MAX][DISP_COLS + 1];
        const char *items[NOTES_MAX];
        for (int i = 0; i < NOTES_MAX; i++) {
            char b[NOTE_LEN + 1];
            if (note_get(i, b)) snprintf(labels[i], sizeof(labels[i]), "%d %s", i + 1, b);
            else snprintf(labels[i], sizeof(labels[i]), "%d (empty)", i + 1);
            items[i] = labels[i];
        }
        sel = ui_menu("Notes", items, NOTES_MAX, sel);
        if (sel < 0) return;
        char b[NOTE_LEN + 1];
        bool has = note_get(sel, b);
        int a = 1;
        if (has) {
            static const char *const acts[] = { "Read", "Edit", "Delete" };
            a = ui_menu("Note", acts, 3, 0);
        }
        if (a == 0) ui_textview("Note", b);
        else if (a == 1 && ui_text_input("Edit  OK-hold=save", b, NOTE_LEN)) note_set(sel, b);
        else if (a == 2 && ui_confirm("Delete this note?")) note_set(sel, NULL);
    }
}

// ------------------------------------------------------------ tally counter
static void tally(void)
{
    static int counts[4];
    static const char *names[] = { "People", "Water L", "Food days", "Count" };
    int sel = 0;
    for (;;) {
        ui_header("Tally counter");
        for (int i = 0; i < 4; i++) disp_printf(0, UI_LINE(i), i == sel, " %-10s %6d ", names[i], counts[i]);
        disp_text(0, 55, "L/R -1/+1  OK hold=0", false);
        disp_flush();
        btn_ev_t ev;
        if (!ui_event(&ev, 1000)) continue;
        if (ev.btn == BTN_UP) sel = (sel + 3) % 4;
        else if (ev.btn == BTN_DOWN) sel = (sel + 1) % 4;
        else if (ev.btn == BTN_RIGHT || (ev.btn == BTN_OK && ev.type == EV_CLICK)) counts[sel]++;
        else if (ev.btn == BTN_LEFT) counts[sel]--;
        else if (ev.btn == BTN_OK && ev.type == EV_LONG) counts[sel] = 0;
        else if (ev.btn == BTN_BACK) return;
    }
}

// ------------------------------------------------------------ supplies planner
static void supplies(void)
{
    int people = ui_number("How many people?", 2, 1, 200, 1, "");
    if (people == INT32_MIN) return;
    int days = ui_number("For how many days?", 7, 1, 365, 1, "days");
    if (days == INT32_MIN) return;
    char b[400];
    int pd = people * days;
    snprintf(b, sizeof(b),
             "%d people x %d days\n\n"
             "Drinking water:\n %d L (3 L/person/day)\n"
             "Water incl. cooking\n and washing:\n %d L (4 L/p/day)\n\n"
             "Food energy:\n %d kcal\n (2000 kcal/p/day)\n"
             "= approx %d kg rice\n   or %d kg dry beans\n\n"
             "Toilet paper: %d rolls\nBleach to purify all\nwater: %d ml\n(2 drops / L, 6%%)",
             people, days, pd * 3, pd * 4, pd * 2000, pd * 2000 / 3600, pd * 2000 / 3400,
             (pd + 6) / 7, (pd * 4 * 2 + 19) / 20);
    ui_textview("Supplies needed", b);
}

// ------------------------------------------------------------ survival guide
static const char *const GUIDE_T[] = {
    "Water purification", "Signals & distress", "First aid: bleeding", "First aid: CPR",
    "Shock & hypothermia", "Finding direction", "Shelter & fire", "Radio tips",
};
static const char *const GUIDE[] = {
    "BOIL: rolling boil 1 min (3 min above 2000 m).\n\nBLEACH (unscented 5-6%): 2 drops per litre, 4 if cloudy. Wait 30 min. Should smell slightly of chlorine.\n\nFILTER cloudy water through cloth first.\n\nSUN (SODIS): clear PET bottle, 6 h full sun.\n\nNever drink sea water or urine.",
    "Rule of 3: three of anything = distress (3 fires, 3 whistles, 3 flashes).\n\nSOS: ... --- ... (light, sound, mirror).\n\nGround signal: large V = need help, X = need medical, arrow = travelling this way.\n\nUse this device's SOS beacon: it sends on radio, sound and light.",
    "1. Protect yourself (gloves/plastic).\n2. Press HARD on wound with cloth, 10 min, don't peek.\n3. Add more cloth on top if soaked.\n4. Raise the limb.\n5. Life-threatening limb bleed: tourniquet 5-8 cm above wound, tighten until bleeding stops, note the TIME.\n6. Keep the person warm.",
    "Not breathing normally?\n1. Call for help.\n2. Hands centre of chest.\n3. Push 5-6 cm deep, 100-120 per minute (beat of 'Stayin Alive').\n4. If trained: 30 pushes then 2 breaths.\n5. Don't stop until help arrives or they breathe.\n\nRecovery position if breathing but unconscious.",
    "SHOCK: pale, cold, fast pulse. Lay flat, raise legs, keep warm, nothing to eat.\n\nHYPOTHERMIA: shivering, confusion. Get out of wind and wet, remove wet clothes, insulate from ground, warm the body core, give warm sweet drinks if awake.\n\nHEAT: move to shade, cool with water, fan.",
    "SUN: rises east, sets west. At noon it is south (northern hemisphere) or north (southern).\n\nSTICK: put a stick in ground, mark shadow tip, wait 15 min, mark again. Line from 1st to 2nd mark points EAST.\n\nNIGHT: Polaris (north) is in line with the two end stars of the Big Dipper.",
    "SHELTER first: get out of wind/rain, insulate from the ground (leaves, branches).\n\nFIRE needs: tinder (dry grass, cotton), kindling (twigs), fuel. Build small and feed slowly.\n\nNever use fire or generators inside closed rooms (carbon monoxide).",
    "Agree a CHANNEL and a TIME with your group (e.g. ch 1, every hour at :00).\n\nHigher = farther. Put the device up high, line of sight.\n\nTurn on Relay so every unit repeats messages (mesh).\n\nAudio modem works through any walkie-talkie: hold speaker to its mic.",
};

static void guide(void)
{
    int sel = 0;
    for (;;) {
        sel = ui_menu("Survival guide", GUIDE_T, 8, sel);
        if (sel < 0) return;
        ui_textview(GUIDE_T[sel], GUIDE[sel]);
    }
}

// ------------------------------------------------------------ dice / coin
static void random_tool(void)
{
    static const char *const items[] = { "Coin flip", "Dice (1-6)", "Number 1-100" };
    for (;;) {
        int s = ui_menu("Random", items, 3, 0);
        if (s < 0) return;
        char b[16];
        uint32_t r = esp_random();
        if (s == 0) snprintf(b, sizeof(b), "%s", r & 1 ? "HEADS" : "TAILS");
        else if (s == 1) snprintf(b, sizeof(b), "%lu", (unsigned long)(r % 6 + 1));
        else snprintf(b, sizeof(b), "%lu", (unsigned long)(r % 100 + 1));
        ui_header(items[s]);
        disp_text_big((DISP_W - strlen(b) * 12) / 2, 26, b);
        disp_flush();
        btn_ev_t ev;
        while (!ui_event(&ev, 1000)) {}
    }
}

static void system_info(void)
{
    for (;;) {
        ui_header("Battery & system");
        int mv = power_battery_mv(), pct = power_battery_pct();
        if (mv >= 0) disp_printf(0, UI_LINE(0), false, "Battery: %d.%02dV %d%%", mv / 1000, mv % 1000 / 10, pct < 0 ? 0 : pct);
        else disp_text(0, UI_LINE(0), "Battery: not wired", false);
        uint32_t s = now_ms() / 1000;
        disp_printf(0, UI_LINE(1), false, "Uptime: %luh %02lum", (unsigned long)(s / 3600), (unsigned long)(s / 60 % 60));
        disp_printf(0, UI_LINE(2), false, "Messages saved: %d", store_count());
        disp_text(0, UI_LINE(4), "Save power: lower", false);
        disp_text(0, UI_LINE(5), "screen-off time", false);
        disp_flush();
        btn_ev_t ev;
        if (ui_event(&ev, 1000) && ev.btn == BTN_BACK) return;
    }
}

void app_tools(void)
{
    static const char *const items[] = {
        "Calculator", "Flashlight", "Notes", "Stopwatch", "Countdown timer", "Tally counter",
        "Supplies planner", "Survival guide", "Random / dice", "Battery & system", "Self test",
    };
    int sel = 0;
    for (;;) {
        sel = ui_menu("Tools", items, 11, sel);
        switch (sel) {
        case -1: return;
        case 0: calculator(); break;
        case 1: flashlight(); break;
        case 2: notes(); break;
        case 3: stopwatch(); break;
        case 4: countdown(); break;
        case 5: tally(); break;
        case 6: supplies(); break;
        case 7: guide(); break;
        case 8: random_tool(); break;
        case 9: system_info(); break;
        case 10: app_selftest(); break;
        }
    }
}
