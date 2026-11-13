// Frequency-shift-keyed audio modem, 400 baud, async (UART-style) framing.
// Frame: [mark lead-in][0x55 x4][0x7E][len][data...][crc16 hi][crc16 lo]
#include <math.h>
#include <string.h>
#include "app.h"
#include "audio.h"
#include "afsk.h"

#define SPB   (AUDIO_RATE / AFSK_BAUD)      // 40 samples per bit
#define TWO_PI 6.28318530718f

uint16_t crc16(const uint8_t *d, int n)
{
    uint16_t c = 0xFFFF;
    while (n--) {
        c ^= (uint16_t)(*d++) << 8;
        for (int i = 0; i < 8; i++) c = (c & 0x8000) ? (c << 1) ^ 0x1021 : c << 1;
    }
    return c;
}

// ------------------------------------------------------------------ transmit
static int16_t s_buf[256];
static int s_bn;
static float s_ph;

static void tx_bit(int bit)
{
    float step = TWO_PI * (bit ? AFSK_MARK : AFSK_SPACE) / AUDIO_RATE;
    float amp = g_set.volume ? g_set.volume * 3000.0f : 3000.0f;
    for (int i = 0; i < SPB; i++) {
        s_buf[s_bn++] = (int16_t)(sinf(s_ph) * amp);
        s_ph += step;
        if (s_ph > TWO_PI) s_ph -= TWO_PI;
        if (s_bn == 256) { audio_write(s_buf, 256); s_bn = 0; }
    }
}

static void tx_byte(uint8_t b)
{
    tx_bit(0);                                   // start
    for (int i = 0; i < 8; i++) tx_bit((b >> i) & 1);
    tx_bit(1); tx_bit(1);                        // 2 stop bits
}

void afsk_send(const uint8_t *data, int len)
{
    if (len > AFSK_MAXLEN) len = AFSK_MAXLEN;
    uint16_t crc = crc16(data, len);
    audio_lock();
    s_bn = 0; s_ph = 0;
    for (int i = 0; i < 120; i++) tx_bit(1);     // 0.3 s lead-in (lets walkie-talkie VOX open)
    for (int i = 0; i < 4; i++) tx_byte(0x55);
    tx_byte(0x7E);
    tx_byte((uint8_t)len);
    for (int i = 0; i < len; i++) tx_byte(data[i]);
    tx_byte(crc >> 8);
    tx_byte(crc & 0xFF);
    for (int i = 0; i < 16; i++) tx_bit(1);
    if (s_bn) audio_write(s_buf, s_bn);
    s_bn = 0;
    audio_unlock();
}

// ------------------------------------------------------------------ receive
static struct {
    float pm, ps;                         // local oscillator phases
    float hist[4][SPB];                   // products in the window
    float hx[SPB];                        // x^2 in the window
    float sum[4], sx;
    int   idx, recalc;
    int   prev, ustate, ucnt, nbit;
    uint8_t ubyte;
    int   fstate, flen, fpos;
    uint8_t frame[AFSK_MAXLEN + 2];
    float quality;
    afsk_cb_t cb;
} R;

void afsk_rx_reset(afsk_cb_t cb)
{
    memset(&R, 0, sizeof(R));
    R.prev = 1;
    R.cb = cb;
}

int afsk_rx_level(void) { return (int)(R.quality * 100); }

static void got_byte(uint8_t b)
{
    switch (R.fstate) {
    case 0: if (b == 0x7E) R.fstate = 1; break;
    case 1:
        if (b == 0 || b > AFSK_MAXLEN) { R.fstate = (b == 0x7E); break; }
        R.flen = b; R.fpos = 0; R.fstate = 2;
        break;
    case 2:
        R.frame[R.fpos++] = b;
        if (R.fpos == R.flen + 2) {
            uint16_t c = (R.frame[R.flen] << 8) | R.frame[R.flen + 1];
            if (c == crc16(R.frame, R.flen) && R.cb) R.cb(R.frame, R.flen);
            R.fstate = 0;
        }
        break;
    }
}

static void got_bit(int bit)
{
    switch (R.ustate) {
    case 0:                                       // idle, wait for start edge
        if (R.prev == 1 && bit == 0) { R.ustate = 1; R.ucnt = SPB / 2; }
        break;
    case 1:                                       // middle of start bit
        if (--R.ucnt == 0) {
            if (bit == 0) { R.ustate = 2; R.ucnt = SPB; R.nbit = 0; R.ubyte = 0; }
            else R.ustate = 0;
        }
        break;
    case 2:
        if (--R.ucnt == 0) {
            if (R.nbit < 8) { R.ubyte |= bit << R.nbit++; R.ucnt = SPB; }
            else {
                if (bit == 1) got_byte(R.ubyte);
                else R.fstate = 0;                // framing error
                R.ustate = 0;
            }
        }
        break;
    }
    R.prev = bit;
}

void afsk_rx_feed(const int16_t *x, int n)
{
    const float sm = TWO_PI * AFSK_MARK / AUDIO_RATE, ss = TWO_PI * AFSK_SPACE / AUDIO_RATE;
    for (int i = 0; i < n; i++) {
        float v = x[i] / 32768.0f;
        float p[4] = { v * cosf(R.pm), v * sinf(R.pm), v * cosf(R.ps), v * sinf(R.ps) };
        R.pm += sm; if (R.pm > TWO_PI) R.pm -= TWO_PI;
        R.ps += ss; if (R.ps > TWO_PI) R.ps -= TWO_PI;
        for (int k = 0; k < 4; k++) { R.sum[k] += p[k] - R.hist[k][R.idx]; R.hist[k][R.idx] = p[k]; }
        R.sx += v * v - R.hx[R.idx]; R.hx[R.idx] = v * v;
        if (++R.idx == SPB) R.idx = 0;
        if (++R.recalc == 8192) {                 // stop float drift in running sums
            R.recalc = 0;
            for (int k = 0; k < 4; k++) { R.sum[k] = 0; for (int j = 0; j < SPB; j++) R.sum[k] += R.hist[k][j]; }
            R.sx = 0; for (int j = 0; j < SPB; j++) R.sx += R.hx[j];
        }
        float em = R.sum[0] * R.sum[0] + R.sum[1] * R.sum[1];
        float es = R.sum[2] * R.sum[2] + R.sum[3] * R.sum[3];
        float norm = R.sx * SPB / 2.0f + 1e-9f;
        float q = (em + es) / norm;               // ~1 for a clean tone, ~0 for noise
        R.quality = R.quality * 0.995f + q * 0.005f;
        int bit = (q < 0.2f || R.sx < 1e-6f) ? 1 : (em > es);   // squelch -> idle (mark)
        got_bit(bit);
    }
}
