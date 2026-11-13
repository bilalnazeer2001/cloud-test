#include <string.h>
#include <ctype.h>
#include "app.h"
#include "audio.h"
#include "leds.h"
#include "morse.h"
#include "display.h"

static const struct { char c; const char *m; } TABLE[] = {
    {'A', ".-"}, {'B', "-..."}, {'C', "-.-."}, {'D', "-.."}, {'E', "."}, {'F', "..-."},
    {'G', "--."}, {'H', "...."}, {'I', ".."}, {'J', ".---"}, {'K', "-.-"}, {'L', ".-.."},
    {'M', "--"}, {'N', "-."}, {'O', "---"}, {'P', ".--."}, {'Q', "--.-"}, {'R', ".-."},
    {'S', "..."}, {'T', "-"}, {'U', "..-"}, {'V', "...-"}, {'W', ".--"}, {'X', "-..-"},
    {'Y', "-.--"}, {'Z', "--.."},
    {'0', "-----"}, {'1', ".----"}, {'2', "..---"}, {'3', "...--"}, {'4', "....-"},
    {'5', "....."}, {'6', "-...."}, {'7', "--..."}, {'8', "---.."}, {'9', "----."},
    {'.', ".-.-.-"}, {',', "--..--"}, {'?', "..--.."}, {'/', "-..-."}, {'-', "-....-"},
    {'=', "-...-"}, {'@', ".--.-."}, {'!', "-.-.--"}, {':', "---..."}, {'\'', ".----."},
    {'(', "-.--."}, {')', "-.--.-"}, {'+', ".-.-."},
};
#define N_TABLE (sizeof(TABLE) / sizeof(TABLE[0]))

const char *morse_code(char c)
{
    c = toupper((unsigned char)c);
    for (int i = 0; i < N_TABLE; i++) if (TABLE[i].c == c) return TABLE[i].m;
    return NULL;
}

char morse_char(const char *code)
{
    if (!strcmp(code, "...---...")) return '#';     // SOS prosign shown as '#'
    for (int i = 0; i < N_TABLE; i++) if (!strcmp(TABLE[i].m, code)) return TABLE[i].c;
    return 0;
}

static void element(uint32_t ms, bool on, bool sound, bool light)
{
    if (light) { led_set(LED_WHITE, on); led_set(LED_RED, on); if (!led_has_own(LED_WHITE)) disp_invert(on); }
    if (on && sound) audio_tone(g_set.tone_hz, ms);
    else if (sound) audio_silence(ms);
    else vTaskDelay(pdMS_TO_TICKS(ms));
    if (light) { led_set(LED_WHITE, false); led_set(LED_RED, false); if (!led_has_own(LED_WHITE)) disp_invert(false); }
}

void morse_send(const char *text, uint8_t wpm, bool sound, bool light, volatile bool *abort_flag)
{
    uint32_t dot = 1200 / (wpm ? wpm : 12);
    if (sound) audio_lock();
    for (const char *p = text; *p; p++) {
        if (abort_flag && *abort_flag) break;
        if (*p == ' ') { element(dot * 4, false, sound, light); continue; }   // 3 after letter + 4 = 7
        const char *m = (*p == '#') ? "...---..." : morse_code(*p);
        if (!m) continue;
        for (const char *e = m; *e && !(abort_flag && *abort_flag); e++) {
            element(*e == '.' ? dot : dot * 3, true, sound, light);
            element(dot, false, sound, light);
        }
        element(dot * 2, false, sound, light);
    }
    if (sound) audio_unlock();
}

void morse_dec_init(morse_dec_t *d, float dot_ms, bool adaptive)
{
    memset(d, 0, sizeof(*d));
    d->dot_ms = dot_ms;
    d->adaptive = adaptive;
}

void morse_dec_mark(morse_dec_t *d, float ms)
{
    if (ms < d->dot_ms * 0.3f) return;              // glitch
    bool dash = ms > d->dot_ms * 2.0f;
    if (d->adaptive) {
        float est = dash ? ms / 3.0f : ms;
        d->dot_ms = d->dot_ms * 0.75f + est * 0.25f;
        if (d->dot_ms < 30) d->dot_ms = 30;         // ~40 WPM max
        if (d->dot_ms > 300) d->dot_ms = 300;       // ~4 WPM min
    }
    if (d->len < (int)sizeof(d->code) - 1) d->code[d->len++] = dash ? '-' : '.';
    d->code[d->len] = 0;
}

char morse_dec_gap(morse_dec_t *d, float silence_ms)
{
    if (d->len && silence_ms > d->dot_ms * 2.5f) {
        char c = morse_char(d->code);
        d->len = 0;
        d->code[0] = 0;
        d->word_pending = true;
        return c ? c : '*';
    }
    if (!d->len && d->word_pending && silence_ms > d->dot_ms * 6.0f) {
        d->word_pending = false;
        return ' ';
    }
    return 0;
}
