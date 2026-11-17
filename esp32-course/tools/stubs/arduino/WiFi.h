#pragma once
#include <Arduino.h>
typedef enum { WL_NO_SHIELD = 255, WL_IDLE_STATUS = 0, WL_NO_SSID_AVAIL = 1, WL_SCAN_COMPLETED = 2, WL_CONNECTED = 3, WL_CONNECT_FAILED = 4, WL_CONNECTION_LOST = 5, WL_DISCONNECTED = 6 } wl_status_t;
typedef enum { WIFI_OFF = 0, WIFI_STA = 1, WIFI_AP = 2, WIFI_AP_STA = 3 } wifi_mode_t;
class IPAddress : public Printable {
 public:
  IPAddress();
  IPAddress(uint8_t a, uint8_t b, uint8_t c, uint8_t d);
  String toString() const;
  size_t printTo(Print &p) const override;
};
class WiFiClass {
 public:
  bool mode(wifi_mode_t m);
  wl_status_t begin(const char *ssid, const char *passphrase = nullptr);
  wl_status_t status();
  bool disconnect(bool wifioff = false, bool eraseap = false);
  bool reconnect();
  bool isConnected();
  bool setSleep(bool enabled);
  bool setAutoReconnect(bool on);
  IPAddress localIP();
  String macAddress();
  int8_t RSSI();
  uint8_t channel();
  String SSID();
  bool softAP(const char *ssid, const char *passphrase = nullptr, int channel = 1);
  IPAddress softAPIP();
  int16_t scanNetworks();
  String SSID(uint8_t i);
  int32_t RSSI(uint8_t i);
};
extern WiFiClass WiFi;
