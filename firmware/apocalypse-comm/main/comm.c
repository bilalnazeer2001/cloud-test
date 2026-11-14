#include <string.h>
#include <stdio.h>
#include "esp_log.h"
#include "esp_random.h"
#include "app.h"
#include "comm.h"
#include "store.h"
#include "leds.h"
#include "audio.h"
#include "links.h"

static const char *TAG = "comm";

typedef struct { uint8_t data[sizeof(pkt_t)]; uint8_t len; int8_t rssi; uint8_t via; } rx_item_t;

#define MAX_NODES 16
#define SEEN_MAX  256
#define MAX_TTL   6          // never relay more hops than we send ourselves (+1)

static QueueHandle_t s_q;
static SemaphoreHandle_t s_mx;
static node_t s_nodes[MAX_NODES];
static struct { uint32_t src, mid; } s_seen[SEEN_MAX];
static int s_seen_i;
static SemaphoreHandle_t s_seen_mx;
static uint32_t s_last_alarm, s_last_pong;
static volatile bool s_sos_new;
static char s_sos_who[NAME_LEN + 1], s_sos_text[MAX_TEXT + 1];
static uint32_t s_rx_count;

static bool seen(uint32_t src, uint32_t mid)
{
    bool found = false;
    xSemaphoreTake(s_seen_mx, portMAX_DELAY);      // called from comm, UI and web tasks
    for (int i = 0; i < SEEN_MAX && !found; i++) found = s_seen[i].src == src && s_seen[i].mid == mid;
    if (!found) {
        s_seen[s_seen_i].src = src;
        s_seen[s_seen_i].mid = mid;
        s_seen_i = (s_seen_i + 1) % SEEN_MAX;
    }
    xSemaphoreGive(s_seen_mx);
    return found;
}

// "SOS - NEED HELP (#3)" and "(#4)" are the same message repeated: compare without the counter.
static bool same_sos(const char *a, const char *b)
{
    const char *ma = strstr(a, " (#"), *mb = strstr(b, " (#");
    size_t la = ma ? (size_t)(ma - a) : strlen(a), lb = mb ? (size_t)(mb - b) : strlen(b);
    return la == lb && !memcmp(a, b, la);
}

static void node_update(const pkt_t *p, int rssi, uint8_t via)
{
    xSemaphoreTake(s_mx, portMAX_DELAY);
    int slot = -1, oldest = 0;
    for (int i = 0; i < MAX_NODES; i++) {
        if (s_nodes[i].id == p->src) { slot = i; break; }
        if (s_nodes[i].last_ms < s_nodes[oldest].last_ms) oldest = i;
    }
    if (slot < 0) slot = oldest;
    node_t *n = &s_nodes[slot];
    // Prefer direct info: don't let a relayed copy overwrite a fresh direct reading
    if (n->id == p->src && p->hops > n->hops && now_ms() - n->last_ms < 60000) {
        xSemaphoreGive(s_mx);
        return;
    }
    n->id = p->src;
    memcpy(n->name, p->name, NAME_LEN);
    n->name[NAME_LEN] = 0;
    n->rssi = rssi;
    n->via = via;
    n->hops = p->hops;
    n->last_ms = now_ms();
    xSemaphoreGive(s_mx);
}

static void fill(pkt_t *p, uint8_t type, const char *text)
{
    memset(p, 0, sizeof(*p));
    p->magic = PKT_MAGIC;
    p->ver = PKT_VERSION;
    p->type = type;
    p->ttl = (type == PKT_BEACON) ? 1 : 5;
    p->src = g_node_id;
    p->mid = esp_random();
    strncpy(p->name, g_set.name, NAME_LEN);
    if (text) {
        size_t l = strlen(text);
        if (l > MAX_TEXT) l = MAX_TEXT;
        memcpy(p->text, text, l);
        p->len = l;
    }
}

static uint8_t tx(const pkt_t *p, uint8_t via)
{
    int len = PKT_HDR_LEN + p->len;
    uint8_t used = 0;
    led_pulse(LED_BLUE, 80);
    if ((via & VIA_ESPNOW) && espnow_link_send((const uint8_t *)p, len)) used |= VIA_ESPNOW;
    if ((via & VIA_LORA) && lora_link_send((const uint8_t *)p, len)) used |= VIA_LORA;
    if (via & VIA_AFSK) { afsk_link_send((const uint8_t *)p, len); used |= VIA_AFSK; }
    return used;
}

uint8_t comm_send(const char *text, uint8_t type, uint8_t via, bool save)
{
    pkt_t p;
    fill(&p, type, text);
    seen(p.src, p.mid);
    uint8_t used = tx(&p, via & ~VIA_PHONE);
    if (save) {
        msg_t m = {.src = g_node_id, .type = type, .via = used | (via & VIA_PHONE), .out = true, .read = true};
        strncpy(m.name, g_set.name, NAME_LEN);
        strncpy(m.text, p.text, MAX_TEXT);
        store_add(&m);
    }
    return used;
}

uint8_t comm_send_text(const char *text, uint8_t type, uint8_t via)
{
    return comm_send(text, type, via, true);
}

void comm_ping(void)
{
    pkt_t p;
    fill(&p, PKT_PING, NULL);
    p.ttl = 3;
    seen(p.src, p.mid);
    tx(&p, VIA_RADIO);
}

void comm_rx(const uint8_t *data, int len, int rssi, uint8_t via)
{
    if (len < (int)PKT_HDR_LEN || len > (int)sizeof(pkt_t) || data[0] != PKT_MAGIC) return;
    rx_item_t it = {.len = len, .rssi = rssi, .via = via};
    memcpy(it.data, data, len);
    xQueueSend(s_q, &it, 0);
}

static void handle(rx_item_t *it)
{
    pkt_t p = {0};
    memcpy(&p, it->data, it->len);
    if (p.ver != PKT_VERSION || p.len > MAX_TEXT || it->len < (int)(PKT_HDR_LEN + p.len)) return;
    if (p.type < PKT_MSG || p.type > PKT_PONG) return;     // unknown packet type: ignore, never relay
    if (p.ttl > MAX_TTL) p.ttl = MAX_TTL;          // a hostile sender cannot make packets travel forever
    if (p.src == g_node_id) return;                // my own message echoed back
    if (seen(p.src, p.mid)) return;
    s_rx_count++;
    node_update(&p, it->rssi, it->via);
    led_pulse(LED_GREEN, 120);

    if (p.type == PKT_MSG || p.type == PKT_SOS) {
        msg_t m = {.src = p.src, .type = p.type, .via = it->via, .rssi = it->rssi, .hops = p.hops};
        memcpy(m.name, p.name, NAME_LEN);
        memcpy(m.text, p.text, p.len);
        msg_t last;
        bool repeat = p.type == PKT_SOS && store_get(0, &last) && last.type == PKT_SOS &&
                      last.src == p.src && same_sos(last.text, m.text);
        if (!repeat) store_add(&m);                // repeats of one SOS must not flood the inbox
        ESP_LOGI(TAG, "msg from %s via %s: %s", m.name, via_name(it->via), m.text);
        if (p.type == PKT_SOS) {
            if (!s_last_alarm || now_ms() - s_last_alarm > 10000) {    // limit alarm spam to 1 per 10 s
                s_last_alarm = now_ms() ? now_ms() : 1;
                strcpy(s_sos_who, m.name);
                strcpy(s_sos_text, m.text);
                s_sos_new = true;
                led_pulse(LED_RED, 3000);
                audio_alarm();
            }
        } else {
            audio_alert();
        }
    } else if (p.type == PKT_PING && (!s_last_pong || now_ms() - s_last_pong > 5000)) {   // anti-amplification
        s_last_pong = now_ms() ? now_ms() : 1;
        vTaskDelay(pdMS_TO_TICKS(50 + esp_random() % 400));   // avoid everyone answering at once
        pkt_t r;
        fill(&r, PKT_PONG, NULL);
        r.ttl = 3;
        seen(r.src, r.mid);
        tx(&r, VIA_RADIO);
    }

    // Mesh relay: repeat over radio links so messages hop node to node
    if (g_set.relay && p.ttl > 1 && p.type != PKT_BEACON) {
        p.ttl--;
        p.hops++;
        vTaskDelay(pdMS_TO_TICKS(20 + esp_random() % 200));
        tx(&p, VIA_RADIO);
    }
}

static void task(void *arg)
{
    rx_item_t it;
    uint32_t last_beacon = 0;
    for (;;) {
        if (xQueueReceive(s_q, &it, pdMS_TO_TICKS(1000))) handle(&it);
        if (g_set.beacon && now_ms() - last_beacon > 60000) {
            last_beacon = now_ms();
            pkt_t p;
            fill(&p, PKT_BEACON, NULL);
            tx(&p, VIA_RADIO);
        }
    }
}

int comm_nodes(node_t *out, int max)
{
    int n = 0;
    xSemaphoreTake(s_mx, portMAX_DELAY);
    for (int i = 0; i < MAX_NODES; i++) if (s_nodes[i].id) out[n++] = s_nodes[i];
    xSemaphoreGive(s_mx);
    for (int i = 0; i < n; i++)                      // sort newest first
        for (int j = i + 1; j < n; j++)
            if (out[j].last_ms > out[i].last_ms) { node_t t = out[i]; out[i] = out[j]; out[j] = t; }
    return n > max ? max : n;
}

bool comm_take_sos(char *who, char *text)
{
    if (!s_sos_new) return false;
    s_sos_new = false;
    strcpy(who, s_sos_who);
    strcpy(text, s_sos_text);
    return true;
}

uint32_t comm_rx_count(void) { return s_rx_count; }

void comm_init(void)
{
    s_q = xQueueCreate(16, sizeof(rx_item_t));
    s_mx = xSemaphoreCreateMutex();
    s_seen_mx = xSemaphoreCreateMutex();
    xTaskCreate(task, "comm", 6144, NULL, 8, NULL);
}
