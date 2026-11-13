// ESP-NOW: connectionless Wi-Fi packets between ESP32s. No router, no internet.
// Range: ~200 m normal, up to ~1 km line-of-sight in Espressif Long Range mode.
#include <string.h>
#include "esp_wifi.h"
#include "esp_now.h"
#include "esp_netif.h"
#include "esp_event.h"
#include "esp_log.h"
#include "app.h"
#include "comm.h"
#include "links.h"

static const char *TAG = "espnow";
static const uint8_t BCAST[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
static bool s_ok;

static void on_recv(const esp_now_recv_info_t *info, const uint8_t *data, int len)
{
    comm_rx(data, len, info->rx_ctrl ? info->rx_ctrl->rssi : 0, VIA_ESPNOW);
}

void espnow_link_apply(void)
{
    if (!s_ok) return;
    esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N | WIFI_PROTOCOL_LR);
    esp_wifi_set_channel(g_set.channel, WIFI_SECOND_CHAN_NONE);
    esp_now_rate_config_t rc = {
        .phymode = g_set.long_range ? WIFI_PHY_MODE_LR : WIFI_PHY_MODE_11B,
        .rate = g_set.long_range ? WIFI_PHY_RATE_LORA_250K : WIFI_PHY_RATE_1M_L,
    };
    esp_err_t e = esp_now_set_peer_rate_config(BCAST, &rc);
    if (e != ESP_OK) ESP_LOGW(TAG, "rate config: %s", esp_err_to_name(e));
    esp_wifi_set_max_tx_power(80);         // 20 dBm, the legal max for 2.4 GHz in most places
}

void espnow_link_init(void)
{
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    esp_netif_create_default_wifi_ap();
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    esp_wifi_set_storage(WIFI_STORAGE_RAM);
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_start());
    esp_wifi_set_ps(WIFI_PS_NONE);         // always listening

    if (esp_now_init() != ESP_OK) { ESP_LOGE(TAG, "esp_now_init failed"); return; }
    esp_now_register_recv_cb(on_recv);
    esp_now_peer_info_t peer = {0};
    memcpy(peer.peer_addr, BCAST, 6);
    peer.channel = 0;                      // follow current channel
    peer.ifidx = WIFI_IF_STA;
    peer.encrypt = false;
    esp_now_add_peer(&peer);
    s_ok = true;
    espnow_link_apply();
    ESP_LOGI(TAG, "ready on channel %d", g_set.channel);
}

bool espnow_link_send(const uint8_t *data, int len)
{
    if (!s_ok) return false;
    return esp_now_send(BCAST, data, len) == ESP_OK;
}
