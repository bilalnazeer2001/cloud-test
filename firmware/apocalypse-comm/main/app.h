// Shared definitions for the whole firmware.
#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "esp_timer.h"

#define FW_VERSION "1.0"

static inline uint32_t now_ms(void) { return (uint32_t)(esp_timer_get_time() / 1000); }

// ---------------------------------------------------------------- packets
// One packet format is used on every link (ESP-NOW, LoRa, audio modem),
// so a message heard on one link can be relayed onto another.
#define PKT_MAGIC     0xA5
#define PKT_VERSION   1
#define MAX_TEXT      160
#define NAME_LEN      12

enum pkt_type {
    PKT_MSG    = 1,   // normal text message
    PKT_SOS    = 2,   // emergency message (alarm on receivers)
    PKT_BEACON = 3,   // "I am here" heartbeat, not stored
    PKT_PING   = 4,   // asks every node to answer
    PKT_PONG   = 5,   // answer to a ping
};

typedef struct __attribute__((packed)) {
    uint8_t  magic;
    uint8_t  ver;
    uint8_t  type;
    uint8_t  ttl;          // hops left for relaying
    uint32_t src;          // sender node id
    uint32_t mid;          // message id (random) for duplicate detection
    char     name[NAME_LEN];
    uint8_t  hops;         // how many times it has been relayed
    uint8_t  len;          // text length
    char     text[MAX_TEXT];
} pkt_t;

#define PKT_HDR_LEN  (sizeof(pkt_t) - MAX_TEXT)

// Which link a packet came in on / should go out on (bit mask)
enum {
    VIA_ESPNOW = 1 << 0,
    VIA_LORA   = 1 << 1,
    VIA_AFSK   = 1 << 2,
    VIA_PHONE  = 1 << 3,
    VIA_RADIO  = VIA_ESPNOW | VIA_LORA,
};
const char *via_name(uint8_t via);

// ---------------------------------------------------------------- settings
typedef struct {
    char    name[NAME_LEN];
    uint8_t channel;       // Wi-Fi channel 1..13 used for ESP-NOW
    uint8_t volume;        // 0..10
    uint8_t wpm;           // Morse speed
    uint16_t tone_hz;      // Morse tone
    bool    relay;         // repeat other people's messages
    bool    long_range;    // Espressif Wi-Fi LR mode (more range, ESP32 only)
    bool    beacon;        // send "I am here" every minute
    char    ap_pass[12];   // phone hotspot password (random, made on first boot)
    int16_t tz_min;        // time zone offset from phone (minutes, JS style)
    uint8_t screen_s;      // screen off after N seconds (0 = never)
    bool    modem_listen;  // always decode audio modem packets from the mic
} settings_t;

extern settings_t g_set;
extern uint32_t   g_node_id;
void settings_load(void);
void settings_save(void);
