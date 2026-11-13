// Phone link: the device makes its own Wi-Fi hotspot. Join it with any phone
// and open http://192.168.4.1 to chat with a full keyboard. No internet needed.
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/time.h>
#include <time.h>
#include "esp_wifi.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "app.h"
#include "comm.h"
#include "store.h"
#include "links.h"

static const char *TAG = "portal";
static httpd_handle_t s_http;

static const char PAGE[] =
"<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
"<title>Field Comm</title><style>"
"body{font-family:sans-serif;margin:0;background:#111;color:#eee}"
"header{background:#400;padding:10px;font-weight:bold;position:sticky;top:0}"
"#log{padding:8px 8px 70px}.m{background:#2a2a2a;border-radius:10px;padding:6px 10px;margin:6px 0;max-width:85%}"
".o{background:#1d4d33;margin-left:auto}.s{background:#900}small{color:#bbb}"
"form{display:flex;gap:4px;padding:8px;position:fixed;bottom:0;left:0;right:0;background:#111}"
"input{flex:1;padding:10px;font-size:16px;border-radius:6px;border:0}button{padding:10px 14px;border:0;border-radius:6px}"
"#sos{background:#d00;color:#fff;font-weight:bold}#nodes{font-weight:normal;font-size:13px;color:#fcc}"
"</style></head><body><header><span id=me>...</span><div id=nodes></div></header><div id=log></div>"
"<form id=f><input id=t maxlength=160 placeholder='Message to everyone' autocomplete=off>"
"<button>Send</button><button type=button id=sos>SOS</button></form><script>"
"const $=i=>document.getElementById(i);"
"const esc=x=>x.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));"
"let last='';"
"async function load(){try{const s=await(await fetch('/api/state')).json();"
"$('me').textContent='Node '+s.name;"
"$('nodes').textContent=s.nodes.length?'Heard: '+s.nodes.map(n=>n.n+' ('+n.i+')').join(', '):'No other nodes heard yet';"
"let h='';for(const m of s.msgs.slice().reverse())h+=`<div class='m ${m.o?'o':''} ${m.s?'s':''}'><small>${esc(m.n)} &middot; ${m.v} &middot; ${m.a}</small><br>${esc(m.t)}</div>`;"
"if(h!==last){$('log').innerHTML=h;last=h;scrollTo(0,document.body.scrollHeight);}}catch(e){}}"
"async function send(sos){let t=$('t').value.trim();if(sos&&!t)t='SOS - NEED HELP';if(!t)return;"
"await fetch('/api/send'+(sos?'?sos=1':''),{method:'POST',body:t});$('t').value='';load();}"
"$('f').onsubmit=e=>{e.preventDefault();send(0)};$('sos').onclick=()=>{if(confirm('Send SOS alarm to everyone?'))send(1)};"
"fetch('/api/time',{method:'POST',body:Math.floor(Date.now()/1000)+','+new Date().getTimezoneOffset()});"
"load();setInterval(load,3000);</script></body></html>";

static void json_str(httpd_req_t *r, const char *s)
{
    char out[2 * MAX_TEXT + 8];
    int n = 0;
    out[n++] = '"';
    for (; *s && n < (int)sizeof(out) - 8; s++) {
        unsigned char c = *s;
        if (c == '"' || c == '\\') { out[n++] = '\\'; out[n++] = c; }
        else if (c < 0x20) out[n++] = ' ';
        else out[n++] = c;
    }
    out[n++] = '"';
    out[n] = 0;
    httpd_resp_send_chunk(r, out, n);
}

static esp_err_t h_root(httpd_req_t *r)
{
    httpd_resp_set_type(r, "text/html");
    return httpd_resp_send(r, PAGE, sizeof(PAGE) - 1);
}

static esp_err_t h_state(httpd_req_t *r)
{
    char b[96];
    httpd_resp_set_type(r, "application/json");
    httpd_resp_sendstr_chunk(r, "{\"name\":");
    json_str(r, g_set.name);
    httpd_resp_sendstr_chunk(r, ",\"msgs\":[");
    int n = store_count();
    for (int i = 0; i < n; i++) {
        msg_t m;
        if (!store_get(i, &m)) break;
        char age[24];
        store_age(&m, age, sizeof(age));
        httpd_resp_sendstr_chunk(r, i ? ",{\"n\":" : "{\"n\":");
        json_str(r, m.name);
        httpd_resp_sendstr_chunk(r, ",\"t\":");
        json_str(r, m.text);
        snprintf(b, sizeof(b), ",\"o\":%d,\"s\":%d,\"v\":\"%s\",\"a\":\"%s\"}",
                 m.out, m.type == PKT_SOS, via_name(m.via), age);
        httpd_resp_sendstr_chunk(r, b);
    }
    httpd_resp_sendstr_chunk(r, "],\"nodes\":[");
    node_t nodes[16];
    int k = comm_nodes(nodes, 16);
    for (int i = 0; i < k; i++) {
        httpd_resp_sendstr_chunk(r, i ? ",{\"n\":" : "{\"n\":");
        json_str(r, nodes[i].name);
        if (nodes[i].hops) snprintf(b, sizeof(b), ",\"i\":\"%d hops\"}", nodes[i].hops);
        else snprintf(b, sizeof(b), ",\"i\":\"%ddBm\"}", nodes[i].rssi);
        httpd_resp_sendstr_chunk(r, b);
    }
    httpd_resp_sendstr_chunk(r, "]}");
    return httpd_resp_sendstr_chunk(r, NULL);
}

static int read_body(httpd_req_t *r, char *buf, int max)
{
    int len = r->content_len < max ? r->content_len : max, got = 0;
    while (got < len) {
        int k = httpd_req_recv(r, buf + got, len - got);
        if (k <= 0) return -1;
        got += k;
    }
    buf[got] = 0;
    return got;
}

static esp_err_t h_send(httpd_req_t *r)
{
    char text[MAX_TEXT + 1], q[16] = {0};
    if (read_body(r, text, MAX_TEXT) <= 0) return httpd_resp_send_err(r, HTTPD_400_BAD_REQUEST, "empty");
    httpd_req_get_url_query_str(r, q, sizeof(q));
    bool sos = strstr(q, "sos=1") != NULL;
    comm_send_text(text, sos ? PKT_SOS : PKT_MSG, VIA_RADIO | VIA_PHONE);
    return httpd_resp_sendstr(r, "ok");
}

void apply_timezone(void)
{
    char tz[24];
    int off = g_set.tz_min;                       // JS: minutes behind UTC, POSIX uses same sign
    snprintf(tz, sizeof(tz), "UTC%c%d:%02d", off < 0 ? '-' : '+', abs(off) / 60, abs(off) % 60);
    setenv("TZ", tz, 1);
    tzset();
}

static esp_err_t h_time(httpd_req_t *r)
{
    char b[40];
    if (read_body(r, b, sizeof(b) - 1) > 0) {
        long long epoch = atoll(b);
        char *c = strchr(b, ',');
        if (epoch > 1700000000LL) {
            struct timeval tv = {.tv_sec = (time_t)epoch};
            settimeofday(&tv, NULL);
            if (c) { g_set.tz_min = atoi(c + 1); settings_save(); apply_timezone(); }
            ESP_LOGI(TAG, "clock set from phone");
        }
    }
    return httpd_resp_sendstr(r, "ok");
}

void portal_start(void)
{
    if (s_http) return;
    wifi_config_t ap = {0};
    snprintf((char *)ap.ap.ssid, sizeof(ap.ap.ssid), "FIELDCOMM-%s", g_set.name);
    ap.ap.ssid_len = strlen((char *)ap.ap.ssid);
    strncpy((char *)ap.ap.password, g_set.ap_pass, sizeof(ap.ap.password));
    ap.ap.channel = g_set.channel;
    ap.ap.authmode = WIFI_AUTH_WPA2_PSK;
    ap.ap.max_connection = 4;
    esp_wifi_set_mode(WIFI_MODE_APSTA);
    esp_wifi_set_protocol(WIFI_IF_AP, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N);
    esp_wifi_set_config(WIFI_IF_AP, &ap);
    espnow_link_apply();

    httpd_config_t cfg = HTTPD_DEFAULT_CONFIG();
    cfg.stack_size = 6144;
    if (httpd_start(&s_http, &cfg) != ESP_OK) { s_http = NULL; return; }
    const httpd_uri_t uris[] = {
        {.uri = "/", .method = HTTP_GET, .handler = h_root},
        {.uri = "/api/state", .method = HTTP_GET, .handler = h_state},
        {.uri = "/api/send", .method = HTTP_POST, .handler = h_send},
        {.uri = "/api/time", .method = HTTP_POST, .handler = h_time},
    };
    for (int i = 0; i < 4; i++) httpd_register_uri_handler(s_http, &uris[i]);
    ESP_LOGI(TAG, "hotspot %s started", ap.ap.ssid);
}

void portal_stop(void)
{
    if (!s_http) return;
    httpd_stop(s_http);
    s_http = NULL;
    esp_wifi_set_mode(WIFI_MODE_STA);
    espnow_link_apply();
}

bool portal_running(void) { return s_http != NULL; }

int portal_clients(void)
{
    wifi_sta_list_t l;
    if (!s_http || esp_wifi_ap_get_sta_list(&l) != ESP_OK) return 0;
    return l.num;
}
