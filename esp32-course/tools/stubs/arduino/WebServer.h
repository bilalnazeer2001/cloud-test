#pragma once
#include <WiFi.h>
typedef enum { HTTP_GET = 1, HTTP_POST = 2, HTTP_ANY = 255 } HTTPMethod;
class WebServer {
 public:
  WebServer(int port = 80);
  void begin();
  void handleClient();
  void on(const char *uri, void (*handler)(void));
  void on(const char *uri, HTTPMethod method, void (*handler)(void));
  void onNotFound(void (*handler)(void));
  void send(int code, const char *content_type, const String &content);
  void send(int code, const char *content_type, const char *content);
  void sendHeader(const String &name, const String &value, bool first = false);
  String arg(const String &name);
  bool hasArg(const String &name);
  String uri();
};
