#pragma once
#include <Arduino.h>
class TwoWire : public Stream {
 public:
  bool begin();
  bool begin(int sda, int scl, uint32_t frequency = 0);
  bool setClock(uint32_t frequency);
  void beginTransmission(uint16_t address);
  void beginTransmission(uint8_t address);
  void beginTransmission(int address);
  uint8_t endTransmission(bool sendStop);
  uint8_t endTransmission(void);
  uint8_t requestFrom(uint8_t address, uint8_t size);
  uint8_t requestFrom(int address, int size);
  size_t write(uint8_t c) override;
  size_t write(const uint8_t *buffer, size_t size) override;
  int available() override;
  int read() override;
};
extern TwoWire Wire;
