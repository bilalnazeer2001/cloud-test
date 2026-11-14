// Message routing: receives packets from every link, removes duplicates,
// stores messages, tracks nearby nodes and relays (mesh) to extend range.
#pragma once
#include "app.h"

typedef struct {
    uint32_t id;
    char     name[NAME_LEN + 1];
    int8_t   rssi;        // signal strength when heard directly (dBm)
    uint8_t  via;
    uint8_t  hops;        // 0 = heard directly
    uint32_t last_ms;
} node_t;

void comm_init(void);
// Called by links when bytes arrive (any task context).
void comm_rx(const uint8_t *data, int len, int rssi, uint8_t via);
// Send a text message. Returns links actually used.
uint8_t comm_send_text(const char *text, uint8_t type, uint8_t via_mask);
// Same, but save=false does not store it in the inbox (used for SOS repeats).
uint8_t comm_send(const char *text, uint8_t type, uint8_t via_mask, bool save);
void comm_ping(void);
int  comm_nodes(node_t *out, int max);      // newest first
// UI polls this to pop up SOS alarms. Returns true once per SOS.
bool comm_take_sos(char *who, char *text);
uint32_t comm_rx_count(void);
