# ---- Safety check: stop the build if two parts are wired to the same GPIO, or a flash pin is used.
set(_pins PIN_I2C_SDA PIN_I2C_SCL PIN_BTN_LADDER PIN_BTN_UP PIN_BTN_DOWN PIN_BTN_LEFT PIN_BTN_RIGHT
          PIN_BTN_OK PIN_BTN_BACK PIN_BTN_MORSE PIN_LED_RED PIN_LED_GREEN PIN_LED_BLUE PIN_LED_WHITE
          PIN_SPK_BCLK PIN_SPK_WS PIN_SPK_DIN PIN_MIC_SD PIN_MIC_SCK PIN_MIC_WS PIN_BATTERY_ADC
          PIN_LORA_SCK PIN_LORA_MISO PIN_LORA_MOSI PIN_LORA_NSS PIN_LORA_RST PIN_LORA_BUSY
          PIN_LORA_DIO1 PIN_LORA_RXEN)
foreach(_v ${_pins})
    if(DEFINED CONFIG_${_v} AND CONFIG_${_v} GREATER_EQUAL 0)
        set(_n ${CONFIG_${_v}})
        if(DEFINED _owner_${_n} AND NOT "${_owner_${_n}}" STREQUAL "${_v}")
            message(FATAL_ERROR "PIN CONFLICT: GPIO${_n} is used by both ${_owner_${_n}} and ${_v}. Change one in 'idf.py menuconfig' > Apocalypse Communicator - Wiring.")
        endif()
        set(_owner_${_n} ${_v})
        if(CONFIG_IDF_TARGET_ESP32 AND _n GREATER_EQUAL 6 AND _n LESS_EQUAL 11)
            message(FATAL_ERROR "${_v} = GPIO${_n}: GPIO6-11 are connected to the flash chip on ESP32. Pick another pin.")
        endif()
        if(CONFIG_IDF_TARGET_ESP32S3 AND _n GREATER_EQUAL 26 AND _n LESS_EQUAL 32)
            message(FATAL_ERROR "${_v} = GPIO${_n}: GPIO26-32 are used by flash/PSRAM on ESP32-S3. Pick another pin.")
        endif()
    endif()
endforeach()

idf_component_register(
    SRCS "main.c" "display.c" "buttons.c" "leds.c" "audio.c" "morse.c" "afsk.c"
         "comm.c" "espnow_link.c" "lora_link.c" "store.c" "portal.c" "ui.c"
         "apps_msg.c" "apps_tools.c" "apps_audio.c" "calc.c" "power.c" "selftest.c"
    INCLUDE_DIRS "."
    REQUIRES driver esp_wifi esp_netif esp_event nvs_flash esp_http_server
             esp_timer esp_adc esp_pm
)
target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-format-truncation)
