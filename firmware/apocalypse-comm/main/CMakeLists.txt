idf_component_register(
    SRCS "main.c" "display.c" "buttons.c" "leds.c" "audio.c" "morse.c" "afsk.c"
         "comm.c" "espnow_link.c" "lora_link.c" "store.c" "portal.c" "ui.c"
         "apps_msg.c" "apps_tools.c" "apps_audio.c" "calc.c" "power.c"
    INCLUDE_DIRS "."
    REQUIRES driver esp_wifi esp_netif esp_event nvs_flash esp_http_server
             esp_timer esp_adc
)
target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-format-truncation)
