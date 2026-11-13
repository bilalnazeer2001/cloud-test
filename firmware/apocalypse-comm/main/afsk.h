// Audio modem: sends data as two beeping tones (like old dial-up modems).
// Works speaker->air->microphone, or through a walkie-talkie / CB / ham radio
// by plugging the speaker output into the radio's mic input and vice versa.
#pragma once
#include <stdint.h>

#define AFSK_BAUD   400
#define AFSK_MARK   1200   // Hz for bit 1
#define AFSK_SPACE  2200   // Hz for bit 0
#define AFSK_MAXLEN 200

// Blocking. Sends a framed, checksummed packet.
void afsk_send(const uint8_t *data, int len);

typedef void (*afsk_cb_t)(const uint8_t *data, int len);
void afsk_rx_reset(afsk_cb_t cb);
void afsk_rx_feed(const int16_t *samples, int n);
int  afsk_rx_level(void);       // 0..100 signal quality, for a meter
uint16_t crc16(const uint8_t *d, int n);
