#pragma once
#include "esp_err.h"
#include "esp_event.h"
typedef struct { int dummy; } wifi_init_config_t;
#define WIFI_INIT_CONFIG_DEFAULT() { 0 }
typedef enum { WIFI_MODE_NULL, WIFI_MODE_STA, WIFI_MODE_AP, WIFI_MODE_APSTA } wifi_mode_t;
typedef enum { WIFI_IF_STA, WIFI_IF_AP } wifi_interface_t;
typedef struct { uint8_t ssid[32]; uint8_t password[64]; } wifi_sta_config_t;
typedef struct { uint8_t ssid[32]; uint8_t password[64]; } wifi_ap_config_t;
typedef union { wifi_ap_config_t ap; wifi_sta_config_t sta; } wifi_config_t;
extern const char *const WIFI_EVENT;
typedef enum { WIFI_EVENT_WIFI_READY, WIFI_EVENT_SCAN_DONE, WIFI_EVENT_STA_START, WIFI_EVENT_STA_STOP, WIFI_EVENT_STA_CONNECTED, WIFI_EVENT_STA_DISCONNECTED } wifi_event_t;
esp_err_t esp_wifi_init(const wifi_init_config_t *config);
esp_err_t esp_wifi_set_mode(wifi_mode_t mode);
esp_err_t esp_wifi_set_config(wifi_interface_t interface, wifi_config_t *conf);
esp_err_t esp_wifi_start(void);
esp_err_t esp_wifi_connect(void);
