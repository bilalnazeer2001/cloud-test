#pragma once
#include <Arduino.h>
#define SPI_MODE0 0
#define SPI_MODE1 1
#define SPI_MODE2 2
#define SPI_MODE3 3
class SPISettings { public: SPISettings(uint32_t clock, uint8_t bitOrder, uint8_t dataMode); };
class SPIClass {
 public:
  bool begin(int8_t sck = -1, int8_t miso = -1, int8_t mosi = -1, int8_t ss = -1);
  void end();
  void beginTransaction(SPISettings settings);
  void endTransaction(void);
  uint8_t transfer(uint8_t data);
  uint16_t transfer16(uint16_t data);
};
extern SPIClass SPI;
