#pragma once
#include <stdint.h>
#include <stdbool.h>

typedef enum { BTN_UP, BTN_DOWN, BTN_LEFT, BTN_RIGHT, BTN_OK, BTN_BACK, BTN_MORSE, BTN_COUNT } btn_t;

typedef enum {
    EV_CLICK,     // short press (arrows also auto-repeat while held)
    EV_LONG,      // held > 0.7 s (OK and BACK only)
    EV_DOWN,      // raw press   (MORSE key only, for timing)
    EV_UP,        // raw release (MORSE key only)
} btn_ev_type_t;

typedef struct {
    btn_t btn;
    btn_ev_type_t type;
    uint32_t t_ms;       // time of the event
    uint32_t held_ms;    // for EV_UP: how long it was held
} btn_ev_t;

void buttons_init(void);
// Wait for a button event. Returns false on timeout.
bool buttons_get(btn_ev_t *ev, uint32_t timeout_ms);
bool buttons_is_down(btn_t b);
void buttons_flush(void);
bool buttons_present(void);        // false if the button ladder is not wired
uint8_t buttons_seen_mask(void);   // which buttons were pressed (self-test)
void buttons_clear_seen(void);
