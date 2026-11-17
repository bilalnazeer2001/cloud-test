#pragma once
#include <Arduino.h>
class Adafruit_GFX : public Print {
 public:
  void setCursor(int16_t x, int16_t y);
  void setTextSize(uint8_t s);
  void setTextColor(uint16_t c);
  void setTextWrap(bool w);
  void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color);
  void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
  void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
  int16_t width() const;
  int16_t height() const;
};
