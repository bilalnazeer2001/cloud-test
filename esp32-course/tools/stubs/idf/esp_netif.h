#pragma once
#include "esp_err.h"
typedef struct esp_netif_obj esp_netif_t;
typedef struct { uint32_t addr; } esp_ip4_addr_t;
typedef struct { esp_ip4_addr_t ip; esp_ip4_addr_t netmask; esp_ip4_addr_t gw; } esp_netif_ip_info_t;
typedef struct { esp_netif_t *esp_netif; esp_netif_ip_info_t ip_info; bool ip_changed; } ip_event_got_ip_t;
extern const char *const IP_EVENT;
typedef enum { IP_EVENT_STA_GOT_IP, IP_EVENT_STA_LOST_IP } ip_event_t;
#define IPSTR "%d.%d.%d.%d"
#define IP2STR(ipaddr) (int)((ipaddr)->addr & 0xff), (int)(((ipaddr)->addr >> 8) & 0xff), (int)(((ipaddr)->addr >> 16) & 0xff), (int)(((ipaddr)->addr >> 24) & 0xff)
esp_err_t esp_netif_init(void);
esp_netif_t *esp_netif_create_default_wifi_sta(void);
