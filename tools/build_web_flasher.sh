#!/usr/bin/env bash
# Rebuilds the three flash images used by the Chrome flasher page (docs/).
# Needs ESP-IDF v5.3 activated (". $IDF_PATH/export.sh").
set -euo pipefail
cd "$(dirname "$0")/../firmware/apocalypse-comm"
OUT=../../docs/firmware
mkdir -p "$OUT"
build() {   # name target extra-defaults
  local n=$1 t=$2 extra=$3 defs="sdkconfig.defaults"
  [ "$t" = esp32s3 ] && defs="$defs;sdkconfig.defaults.esp32s3"
  [ -n "$extra" ] && { printf "$extra" > "b-$n.defaults"; defs="$defs;b-$n.defaults"; }
  rm -rf "b-$n"
  idf.py -B "b-$n" -D IDF_TARGET="$t" -D SDKCONFIG="b-$n/sdkconfig" -D "SDKCONFIG_DEFAULTS=$defs" build
  (cd "b-$n" && python -m esptool --chip "$t" merge_bin -o "../$OUT/fieldcomm-$n.bin" @flash_args)
  rm -rf "b-$n" "b-$n.defaults"
}
build xiao     esp32s3 ""
build s3devkit esp32s3 "CONFIG_BOARD_DEVKIT=y\n"
build esp32    esp32   ""
echo "Done. Commit docs/firmware/*.bin"
