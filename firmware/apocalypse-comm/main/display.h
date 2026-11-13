#pragma once
#include <stdbool.h>
#include <stdint.h>

#define DISP_W 128
#define DISP_H 64
#define CHAR_W 6     // 5 px glyph + 1 px gap
#define CHAR_H 8
#define DISP_COLS (DISP_W / CHAR_W)   // 21

bool disp_init(void);
void disp_clear(void);
void disp_flush(void);
void disp_pixel(int x, int y, bool on);
void disp_fill_rect(int x, int y, int w, int h, bool on);
void disp_rect(int x, int y, int w, int h);
void disp_hline(int x, int y, int w);
// Draws text. invert = white box with black letters. Returns x after text.
int  disp_text(int x, int y, const char *s, bool invert);
int  disp_printf(int x, int y, bool invert, const char *fmt, ...) __attribute__((format(printf, 4, 5)));
// Big 2x scaled text (for clocks, calculator result)
int  disp_text_big(int x, int y, const char *s);
void disp_contrast(uint8_t level);
void disp_power(bool on);
void disp_invert(bool on);          // whole screen white (signal light)
bool disp_present(void);            // re-checked every few seconds (hot-plug)
