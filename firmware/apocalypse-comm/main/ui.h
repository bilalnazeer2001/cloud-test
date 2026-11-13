#pragma once
#include "app.h"
#include "buttons.h"
#include "display.h"

#define UI_LINE(n) (10 + (n) * 9)     // y of content line n (0..5)
#define UI_LINES 6

void ui_header(const char *title);    // clear screen + title bar with status icons
bool ui_event(btn_ev_t *ev, uint32_t timeout_ms);   // false on timeout / after popup
int  ui_menu(const char *title, const char *const *items, int n, int start);   // -1 = back
void ui_textview(const char *title, const char *text);
bool ui_text_input(const char *title, char *buf, int max);
bool ui_confirm(const char *question);
void ui_toast(const char *msg, uint32_t ms);
int  ui_number(const char *title, int val, int min, int max, int step, const char *unit);
void ui_run(void);                    // main menu, never returns
bool ui_headless(void);               // true when no screen is connected
void ui_say(const char *text);         // speak in Morse (only when headless)
void app_selftest(void);

// apps
void app_messages(void);
void app_radio(void);
void app_audio(void);
void app_tools(void);
void app_phone(void);
void app_settings(void);
void app_sos(void);
// background audio receiver (modem / morse from microphone)
void audio_rx_init(void);
int  mic_check(void);                 // -1 = no microphone, else noise level
