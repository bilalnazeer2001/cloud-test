#include <string.h>
#include <stdio.h>
#include <time.h>
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_mac.h"
#include "esp_random.h"
#include "app.h"
#include "store.h"

settings_t g_set;
uint32_t   g_node_id;

static msg_t s_msgs[STORE_MAX];     // ring buffer
static int s_head, s_count;
static uint16_t s_boot;
static SemaphoreHandle_t s_mx;

const char *via_name(uint8_t via)
{
    if (via & VIA_PHONE)  return "phone";
    if (via & VIA_LORA)   return "LoRa";
    if (via & VIA_ESPNOW) return "radio";
    if (via & VIA_AFSK)   return "audio";
    return "?";
}

static void save_msgs(void)
{
    nvs_handle_t h;
    if (nvs_open("inbox", NVS_READWRITE, &h) != ESP_OK) return;
    nvs_set_blob(h, "msgs", s_msgs, sizeof(s_msgs));
    nvs_set_i32(h, "head", s_head);
    nvs_set_i32(h, "count", s_count);
    nvs_commit(h);
    nvs_close(h);
}

void settings_save(void)
{
    nvs_handle_t h;
    if (nvs_open("cfg", NVS_READWRITE, &h) != ESP_OK) return;
    nvs_set_blob(h, "set", &g_set, sizeof(g_set));
    nvs_commit(h);
    nvs_close(h);
}

// Never trust flash contents blindly: a wrong value here must not become loud noise or a crash.
static void sanitize(void)
{
    g_set.name[NAME_LEN - 1] = 0;
    g_set.ap_pass[sizeof(g_set.ap_pass) - 1] = 0;
    if (!g_set.name[0]) snprintf(g_set.name, NAME_LEN, "N%04X", (unsigned)(g_node_id & 0xFFFF));
    if (g_set.channel < 1 || g_set.channel > 13) g_set.channel = 1;
    if (g_set.volume > 10) g_set.volume = 10;
    if (g_set.wpm < 5 || g_set.wpm > 30) g_set.wpm = 12;
    if (g_set.tone_hz < 300 || g_set.tone_hz > 2000) g_set.tone_hz = 700;
    if (g_set.tz_min < -840 || g_set.tz_min > 840) g_set.tz_min = 0;
    uint8_t *b[] = {(uint8_t *)&g_set.relay, (uint8_t *)&g_set.long_range, (uint8_t *)&g_set.beacon,
                    (uint8_t *)&g_set.modem_listen, (uint8_t *)&g_set.power_saver};
    for (int i = 0; i < 5; i++) *b[i] = *b[i] != 0;
}

void settings_load(void)
{
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    g_node_id = ((uint32_t)mac[2] << 24) | (mac[3] << 16) | (mac[4] << 8) | mac[5];

    nvs_handle_t h;
    size_t sz = sizeof(g_set);
    bool ok = false;
    if (nvs_open("cfg", NVS_READONLY, &h) == ESP_OK) {
        ok = nvs_get_blob(h, "set", &g_set, &sz) == ESP_OK && sz == sizeof(g_set);
        nvs_close(h);
    }
    if (!ok) {
        memset(&g_set, 0, sizeof(g_set));
        snprintf(g_set.name, NAME_LEN, "N%04X", (unsigned)(g_node_id & 0xFFFF));
        g_set.channel = 1;
        g_set.volume = 6;
        g_set.wpm = 12;
        g_set.tone_hz = 700;
        g_set.relay = true;
        g_set.long_range = false;
        g_set.beacon = true;
        g_set.screen_s = 60;
        g_set.tz_min = 0;
        // The hotspot password is made the first time the hotspot starts (see portal.c),
        // because the hardware random generator is only fully random once Wi-Fi is running.
        settings_save();
    }
    sanitize();
}

void store_init(void)
{
    esp_err_t e = nvs_flash_init();
    if (e == ESP_ERR_NVS_NO_FREE_PAGES || e == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }
    s_mx = xSemaphoreCreateMutex();
    settings_load();

    nvs_handle_t h;
    if (nvs_open("inbox", NVS_READWRITE, &h) == ESP_OK) {
        size_t sz = sizeof(s_msgs);
        int32_t hd = 0, ct = 0;
        if (nvs_get_blob(h, "msgs", s_msgs, &sz) == ESP_OK && sz == sizeof(s_msgs) &&
            nvs_get_i32(h, "head", &hd) == ESP_OK && nvs_get_i32(h, "count", &ct) == ESP_OK &&
            hd >= 0 && hd < STORE_MAX && ct >= 0 && ct <= STORE_MAX) {
            s_head = hd; s_count = ct;
        } else {
            memset(s_msgs, 0, sizeof(s_msgs));
        }
        nvs_get_u16(h, "boot", &s_boot);
        s_boot++;
        nvs_set_u16(h, "boot", s_boot);
        nvs_commit(h);
        nvs_close(h);
    }
}

uint16_t store_boot(void) { return s_boot; }

void store_add(const msg_t *m)
{
    xSemaphoreTake(s_mx, portMAX_DELAY);
    msg_t *d = &s_msgs[s_head];
    *d = *m;
    d->boot = s_boot;
    d->up_s = now_ms() / 1000;
    time_t t = time(NULL);
    d->epoch = t > 1700000000 ? (uint32_t)t : 0;
    s_head = (s_head + 1) % STORE_MAX;
    if (s_count < STORE_MAX) s_count++;
    save_msgs();
    xSemaphoreGive(s_mx);
}

int store_count(void) { return s_count; }

static int idx(int i) { return (s_head - 1 - i + 2 * STORE_MAX) % STORE_MAX; }

bool store_get(int i, msg_t *m)
{
    if (i < 0 || i >= s_count) return false;
    xSemaphoreTake(s_mx, portMAX_DELAY);
    *m = s_msgs[idx(i)];
    xSemaphoreGive(s_mx);
    return true;
}

void store_mark_read(int i)
{
    if (i < 0 || i >= s_count) return;
    xSemaphoreTake(s_mx, portMAX_DELAY);
    if (!s_msgs[idx(i)].read) { s_msgs[idx(i)].read = true; save_msgs(); }
    xSemaphoreGive(s_mx);
}

int store_unread(void)
{
    int n = 0;
    for (int i = 0; i < s_count; i++) if (!s_msgs[idx(i)].read && !s_msgs[idx(i)].out) n++;
    return n;
}

void store_clear(void)
{
    xSemaphoreTake(s_mx, portMAX_DELAY);
    memset(s_msgs, 0, sizeof(s_msgs));
    s_head = s_count = 0;
    save_msgs();
    xSemaphoreGive(s_mx);
}

void store_age(const msg_t *m, char *out, int n)
{
    if (m->epoch) {
        time_t t = m->epoch;
        struct tm tm;
        localtime_r(&t, &tm);
        strftime(out, n, "%d/%m %H:%M", &tm);
    } else if (m->boot == s_boot) {
        uint32_t a = now_ms() / 1000 - m->up_s;
        if (a < 60) snprintf(out, n, "%lus ago", (unsigned long)a);
        else if (a < 3600) snprintf(out, n, "%lum ago", (unsigned long)(a / 60));
        else snprintf(out, n, "%luh ago", (unsigned long)(a / 3600));
    } else {
        snprintf(out, n, "earlier");
    }
}

bool note_get(int i, char *buf)
{
    nvs_handle_t h;
    buf[0] = 0;
    if (nvs_open("notes", NVS_READONLY, &h) != ESP_OK) return false;
    char key[8];
    snprintf(key, sizeof(key), "n%d", i);
    size_t sz = NOTE_LEN + 1;
    bool ok = nvs_get_str(h, key, buf, &sz) == ESP_OK;
    nvs_close(h);
    if (!ok) buf[0] = 0;
    return ok && buf[0];
}

void note_set(int i, const char *text)
{
    nvs_handle_t h;
    if (nvs_open("notes", NVS_READWRITE, &h) != ESP_OK) return;
    char key[8];
    snprintf(key, sizeof(key), "n%d", i);
    if (text && text[0]) nvs_set_str(h, key, text); else nvs_erase_key(h, key);
    nvs_commit(h);
    nvs_close(h);
}
