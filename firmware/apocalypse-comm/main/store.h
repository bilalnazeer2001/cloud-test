// Saved data: inbox, notes and settings, kept in flash (NVS) across reboots.
#pragma once
#include "app.h"

typedef struct {
    uint32_t src;
    char     name[NAME_LEN + 1];
    char     text[MAX_TEXT + 1];
    uint8_t  type;       // PKT_MSG / PKT_SOS
    uint8_t  via;
    int8_t   rssi;
    uint8_t  hops;
    bool     out;        // sent by me
    bool     read;
    uint16_t boot;       // boot number when stored (for "x min ago")
    uint32_t up_s;       // uptime seconds when stored
    uint32_t epoch;      // real time if the clock was set, else 0
} msg_t;

#define STORE_MAX 24
#define NOTES_MAX 8
#define NOTE_LEN  160

void store_init(void);
void store_add(const msg_t *m);
int  store_count(void);
bool store_get(int i, msg_t *m);          // i = 0 is the newest
void store_mark_read(int i);
int  store_unread(void);
void store_clear(void);
uint16_t store_boot(void);
void store_age(const msg_t *m, char *out, int n);   // "5m ago", "14:32" ...

bool note_get(int i, char *buf);          // buf >= NOTE_LEN+1
void note_set(int i, const char *text);
