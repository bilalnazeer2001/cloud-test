#pragma once
#include <Arduino.h>
#define FILE_READ "r"
#define FILE_WRITE "w"
#define FILE_APPEND "a"
class File : public Stream {
 public:
  operator bool() const;
  void close();
  size_t size() const;
  const char *name() const;
  bool isDirectory();
  File openNextFile(const char *mode = FILE_READ);
};
namespace fs { class FS {
 public:
  File open(const char *path, const char *mode = FILE_READ, const bool create = false);
  File open(const String &path, const char *mode = FILE_READ, const bool create = false);
  bool exists(const char *path);
  bool remove(const char *path);
  bool mkdir(const char *path);
}; }
