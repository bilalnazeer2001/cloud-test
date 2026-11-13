#pragma once
#include <stdbool.h>
#include <stdint.h>

const char *morse_code(char c);          // 'A' -> ".-" (NULL if none)
char morse_char(const char *code);       // ".-" -> 'A' (0 if unknown)

// Play text as Morse on speaker and/or white+red LED. Blocking.
// abort_flag (optional) is checked between symbols.
void morse_send(const char *text, uint8_t wpm, bool sound, bool light, volatile bool *abort_flag);

// Decoder used for both the Morse key button and the microphone.
typedef struct {
    char  code[8];
    int   len;
    float dot_ms;        // current estimate of one dot
    bool  adaptive;      // learn the sender's speed
    bool  word_pending;
} morse_dec_t;

void morse_dec_init(morse_dec_t *d, float dot_ms, bool adaptive);
void morse_dec_mark(morse_dec_t *d, float ms);           // a beep/keypress of this length ended
char morse_dec_gap(morse_dec_t *d, float silence_ms);    // call often; returns letter, ' ' or 0
