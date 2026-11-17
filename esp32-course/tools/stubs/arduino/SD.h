#pragma once
#include <FS.h>
#include <SPI.h>
typedef enum { CARD_NONE, CARD_MMC, CARD_SD, CARD_SDHC, CARD_UNKNOWN } sdcard_type_t;
class SDFS : public fs::FS {
 public:
  bool begin(uint8_t ssPin = 5, SPIClass &spi = SPI, uint32_t frequency = 4000000);
  void end();
  sdcard_type_t cardType();
  uint64_t cardSize();
  uint64_t totalBytes();
  uint64_t usedBytes();
};
extern SDFS SD;
