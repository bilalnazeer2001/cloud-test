#pragma once
#include <Arduino.h>
#include <SPI.h>
class LoRaClass : public Stream {
 public:
  int begin(long frequency);
  void end();
  int beginPacket(int implicitHeader = false);
  int endPacket(bool async = false);
  int parsePacket(int size = 0);
  int packetRssi();
  float packetSnr();
  size_t write(uint8_t byte) override;
  size_t write(const uint8_t *buffer, size_t size) override;
  int available() override;
  int read() override;
  void onReceive(void (*callback)(int));
  void receive(int size = 0);
  void idle();
  void sleep();
  void setTxPower(int level, int outputPin = 1);
  void setSpreadingFactor(int sf);
  void setSignalBandwidth(long sbw);
  void setCodingRate4(int denominator);
  void setSyncWord(int sw);
  void enableCrc();
  void setPins(int ss = 10, int reset = 9, int dio0 = 2);
};
extern LoRaClass LoRa;
