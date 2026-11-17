// STUB of the Arduino-ESP32 core (v3.x API) used ONLY for syntax checking on a PC.
// It declares the functions the course uses; it does not implement them.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>
#include <string>

typedef uint8_t byte;
typedef bool boolean;
#define HIGH 1
#define LOW 0
#define INPUT 0x01
#define OUTPUT 0x03
#define INPUT_PULLUP 0x05
#define INPUT_PULLDOWN 0x09
#define RISING 1
#define FALLING 2
#define CHANGE 3
#define PI 3.1415926535897932384626433832795
#define DEG_TO_RAD 0.017453292519943295769236907684886
#define RAD_TO_DEG 57.295779513082320876798154814105
#define LED_BUILTIN 2
#define MSBFIRST 1
#define LSBFIRST 0
#define DEC 10
#define HEX 16
#define BIN 2
#define SERIAL_8N1 0x800001c
#define IRAM_ATTR
#define RTC_DATA_ATTR
#define F(x) (x)

typedef enum { GPIO_NUM_0 = 0, GPIO_NUM_2 = 2, GPIO_NUM_4 = 4, GPIO_NUM_12 = 12, GPIO_NUM_13 = 13,
  GPIO_NUM_14 = 14, GPIO_NUM_15 = 15, GPIO_NUM_25 = 25, GPIO_NUM_26 = 26, GPIO_NUM_27 = 27,
  GPIO_NUM_32 = 32, GPIO_NUM_33 = 33, GPIO_NUM_34 = 34, GPIO_NUM_35 = 35, GPIO_NUM_36 = 36, GPIO_NUM_39 = 39 } gpio_num_t;
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1

class String {
 public:
  String();
  String(const char *s);
  String(const String &s);
  String(char c);
  String(int v, unsigned char base = 10);
  String(unsigned int v, unsigned char base = 10);
  String(long v, unsigned char base = 10);
  String(unsigned long v, unsigned char base = 10);
  String(float v, unsigned int decimals = 2);
  String(double v, unsigned int decimals = 2);
  String &operator=(const String &rhs);
  String &operator=(const char *rhs);
  String &operator+=(const String &rhs);
  String &operator+=(const char *rhs);
  String &operator+=(char c);
  String &operator+=(int v);
  bool operator==(const String &rhs) const;
  bool operator==(const char *rhs) const;
  bool operator!=(const String &rhs) const;
  bool operator!=(const char *rhs) const;
  char operator[](unsigned int i) const;
  unsigned int length() const;
  const char *c_str() const;
  long toInt() const;
  float toFloat() const;
  void trim();
  void toUpperCase();
  void toLowerCase();
  char charAt(unsigned int i) const;
  int indexOf(char c, unsigned int from = 0) const;
  int indexOf(const String &s, unsigned int from = 0) const;
  String substring(unsigned int from) const;
  String substring(unsigned int from, unsigned int to) const;
  bool startsWith(const String &s) const;
  bool endsWith(const String &s) const;
  bool equals(const String &s) const;
  bool equalsIgnoreCase(const String &s) const;
  void toCharArray(char *buf, unsigned int size) const;
  bool isEmpty() const;
};
String operator+(const String &a, const String &b);
String operator+(const String &a, const char *b);
String operator+(const char *a, const String &b);
String operator+(const String &a, char b);
String operator+(const String &a, int b);
String operator+(const String &a, unsigned int b);
String operator+(const String &a, long b);
String operator+(const String &a, unsigned long b);
String operator+(const String &a, float b);
String operator+(const String &a, double b);

class Printable;
class Print {
 public:
  virtual size_t write(uint8_t c);
  virtual size_t write(const uint8_t *buffer, size_t size);
  size_t write(const char *s);
  size_t print(const String &s);
  size_t print(const char *s);
  size_t print(char c);
  size_t print(unsigned char v, int base = DEC);
  size_t print(int v, int base = DEC);
  size_t print(unsigned int v, int base = DEC);
  size_t print(long v, int base = DEC);
  size_t print(unsigned long v, int base = DEC);
  size_t print(long long v, int base = DEC);
  size_t print(unsigned long long v, int base = DEC);
  size_t print(double v, int digits = 2);
  size_t print(const Printable &p);
  size_t println(const String &s);
  size_t println(const char *s);
  size_t println(char c);
  size_t println(unsigned char v, int base = DEC);
  size_t println(int v, int base = DEC);
  size_t println(unsigned int v, int base = DEC);
  size_t println(long v, int base = DEC);
  size_t println(unsigned long v, int base = DEC);
  size_t println(long long v, int base = DEC);
  size_t println(unsigned long long v, int base = DEC);
  size_t println(double v, int digits = 2);
  size_t println(const Printable &p);
  size_t println(void);
  size_t printf(const char *format, ...) __attribute__((format(printf, 2, 3)));
};
class Printable { public: virtual size_t printTo(Print &p) const = 0; };
class Stream : public Print {
 public:
  virtual int available();
  virtual int read();
  virtual int peek();
  void flush();
  void setTimeout(unsigned long ms);
  String readString();
  String readStringUntil(char terminator);
  size_t readBytes(uint8_t *buffer, size_t length);
  long parseInt();
  float parseFloat();
};
class HardwareSerial : public Stream {
 public:
  void begin(unsigned long baud, uint32_t config = SERIAL_8N1, int8_t rxPin = -1, int8_t txPin = -1);
  void end();
  operator bool() const;
};
extern HardwareSerial Serial;
extern HardwareSerial Serial1;
extern HardwareSerial Serial2;

void pinMode(uint8_t pin, uint8_t mode);
void digitalWrite(uint8_t pin, uint8_t val);
int digitalRead(uint8_t pin);
void attachInterrupt(uint8_t pin, void (*isr)(void), int mode);
void detachInterrupt(uint8_t pin);
unsigned long millis();
unsigned long micros();
void delay(uint32_t ms);
void delayMicroseconds(uint32_t us);
void yield();
long random(long max);
long random(long min, long max);
void randomSeed(unsigned long seed);
long map(long x, long in_min, long in_max, long out_min, long out_max);
#define constrain(amt, low, high) ((amt) < (low) ? (low) : ((amt) > (high) ? (high) : (amt)))
#ifndef min
#define min(a, b) ((a) < (b) ? (a) : (b))
#define max(a, b) ((a) > (b) ? (a) : (b))
#endif

// ADC
typedef enum { ADC_0db, ADC_2_5db, ADC_6db, ADC_11db, ADC_ATTENDB_MAX } adc_attenuation_t;
uint16_t analogRead(uint8_t pin);
uint32_t analogReadMilliVolts(uint8_t pin);
void analogReadResolution(uint8_t bits);
void analogSetAttenuation(adc_attenuation_t attenuation);
void analogSetPinAttenuation(uint8_t pin, adc_attenuation_t attenuation);

// LEDC (PWM), core 3.x API
bool ledcAttach(uint8_t pin, uint32_t freq, uint8_t resolution);
bool ledcWrite(uint8_t pin, uint32_t duty);
uint32_t ledcWriteTone(uint8_t pin, uint32_t freq);
bool ledcDetach(uint8_t pin);

// Time helpers provided by the core
void configTime(long gmtOffset_sec, int daylightOffset_sec, const char *server1, const char *server2 = nullptr, const char *server3 = nullptr);
bool getLocalTime(struct tm *info, uint32_t ms = 5000);

class EspClass {
 public:
  void restart();
  uint32_t getFreeHeap();
  uint64_t getEfuseMac();
  const char *getChipModel();
};
extern EspClass ESP;
