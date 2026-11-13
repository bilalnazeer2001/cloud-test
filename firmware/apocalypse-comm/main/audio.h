#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#define AUDIO_RATE 16000

void audio_init(void);
// Blocking: play a sine tone. Volume comes from settings.
void audio_tone(uint32_t freq_hz, uint32_t ms);
void audio_silence(uint32_t ms);
// Blocking: play raw mono samples.
void audio_write(const int16_t *samples, size_t n);
// Lock the speaker for a long sequence (Morse, modem). Others wait.
void audio_lock(void);
void audio_unlock(void);
// Short UI sounds (non-blocking, queued in background)
void audio_beep(void);
void audio_click(int button);  // short click, different pitch per button
bool audio_has_speaker(void);
bool audio_has_mic(void);      // mic pin configured (see mic_check for a real test)
void audio_alert(void);      // new message
void audio_alarm(void);      // SOS received
// Continuous tone while a Morse key is held (non-blocking)
void audio_sidetone(bool on);
// Microphone: read n mono samples. Returns number read.
size_t audio_mic_read(int16_t *out, size_t n, uint32_t timeout_ms);
void audio_mic_enable(bool on);
