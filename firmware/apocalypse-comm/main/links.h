// The physical ways this device can talk to others.
#pragma once
#include <stdint.h>
#include <stdbool.h>

// Wi-Fi radio, peer-to-peer ESP-NOW broadcast (no router needed). 2.4 GHz.
void espnow_link_init(void);
bool espnow_link_send(const uint8_t *data, int len);
void espnow_link_apply(void);      // re-apply channel / long-range settings

// Optional LoRa module (SX1276/RFM95), kilometres of range.
void lora_link_init(void);
bool lora_link_send(const uint8_t *data, int len);
bool lora_link_present(void);
int  lora_link_last_rssi(void);

// Audio modem (speaker/mic or walkie-talkie). Blocking, several seconds.
void afsk_link_send(const uint8_t *data, int len);

// Phone hotspot + web page
void portal_start(void);
void portal_stop(void);
bool portal_running(void);
int  portal_clients(void);
