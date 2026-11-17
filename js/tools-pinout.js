'use strict';
/* ESP32 / ESP32-S3 / XIAO pinout viewers. Pin format: 'LABEL|type|functions|note'.
   Types: pwr, gnd, io (free GPIO), in (input only), strap (strapping pin), care (usable with a catch),
   avoid (wired to flash — do not use), ctl (reset/enable). Lists run top to bottom as seen from above. */
(() => {
  const NO_PULL = 'Input only: cannot drive outputs and has no internal pull-up or pull-down — add an external resistor for buttons.';
  const ADC2 = 'ADC2 cannot be read while Wi-Fi is on. Use an ADC1 pin for analog readings in Wi-Fi projects.';
  const FLASH = 'Wired to the module’s SPI flash chip. Using it will crash the board.';
  const PSRAM16 = 'On WROVER modules (with PSRAM) this pin is used by the PSRAM — leave it free there. Free to use on WROOM modules.';

  const BOARDS = {
    esp32: {
      tab: 'ESP32 DevKit', title: 'ESP32 DevKitC (38-pin)', usb: 'bottom', chip: 'ESP32-WROOM',
      sub: 'Classic ESP32 DevKitC V4 layout, antenna at the top. 30-pin boards drop the six flash pins at the bottom and use the same GPIO numbers — always check the labels printed on your board.',
      left: [
        '3V3|pwr|3.3 V out|Output of the board’s 3.3 V regulator. Shared with the ESP32 itself — keep extra load to a couple of hundred mA.',
        'EN|ctl|Reset / enable|Pulling it LOW resets the chip. Wired to the EN (reset) button.',
        'GPIO36|in|SENSOR_VP · ADC1_CH0|' + NO_PULL,
        'GPIO39|in|SENSOR_VN · ADC1_CH3|' + NO_PULL,
        'GPIO34|in|ADC1_CH6|' + NO_PULL,
        'GPIO35|in|ADC1_CH7|' + NO_PULL,
        'GPIO32|io|ADC1_CH4 · TOUCH9 · 32k crystal|Good general pin; analog input works with Wi-Fi on.',
        'GPIO33|io|ADC1_CH5 · TOUCH8 · 32k crystal|Good general pin; analog input works with Wi-Fi on.',
        'GPIO25|io|ADC2_CH8 · DAC1|Has a real analog output (8-bit DAC). ' + ADC2,
        'GPIO26|io|ADC2_CH9 · DAC2|Has a real analog output (8-bit DAC). ' + ADC2,
        'GPIO27|io|ADC2_CH7 · TOUCH7|Free to use. ' + ADC2,
        'GPIO14|io|ADC2_CH6 · TOUCH6 · HSPI SCK|Outputs a short PWM signal during boot — avoid driving a relay or motor directly from it. ' + ADC2,
        'GPIO12|strap|ADC2_CH5 · TOUCH5 · HSPI MISO · MTDI|Strapping pin: if HIGH at power-up the chip picks 1.8 V flash and fails to boot on most modules. Do not pull it up at boot.',
        'GND|gnd|Ground|',
        'GPIO13|io|ADC2_CH4 · TOUCH4 · HSPI MOSI|Free to use. ' + ADC2,
        'GPIO9|avoid|SD2 · flash|' + FLASH,
        'GPIO10|avoid|SD3 · flash|' + FLASH,
        'GPIO11|avoid|CMD · flash|' + FLASH,
        '5V|pwr|5 V (USB)|Connected to USB 5 V through a diode. Can power the board from a 5 V supply; do not connect USB and an external 5 V at once without checking your board.',
      ],
      right: [
        'GND|gnd|Ground|',
        'GPIO23|io|VSPI MOSI|Default SPI data out. Free to use.',
        'GPIO22|io|I²C SCL (default)|Default I²C clock in Arduino.',
        'GPIO1|care|TX0 · UART0|USB-serial transmit: used for uploading and the Serial Monitor, and prints boot messages. Avoid for other things.',
        'GPIO3|care|RX0 · UART0|USB-serial receive: used for uploading. Goes HIGH at boot. Avoid for other things.',
        'GPIO21|io|I²C SDA (default)|Default I²C data in Arduino.',
        'GND|gnd|Ground|',
        'GPIO19|io|VSPI MISO|Default SPI data in. Free to use.',
        'GPIO18|io|VSPI SCK|Default SPI clock. Free to use.',
        'GPIO5|strap|VSPI CS|Strapping pin (SDIO timing). Has a pull-up and outputs PWM at boot. Fine as SPI chip-select; keep it HIGH at power-up.',
        'GPIO17|io|UART2 TX|' + PSRAM16,
        'GPIO16|io|UART2 RX|' + PSRAM16,
        'GPIO4|io|ADC2_CH0 · TOUCH0|Free to use. ' + ADC2,
        'GPIO0|strap|ADC2_CH1 · TOUCH1 · BOOT|Strapping pin wired to the BOOT button. LOW at power-up enters flashing mode. Usable after boot, but nothing may hold it LOW when the board starts.',
        'GPIO2|strap|ADC2_CH2 · TOUCH2 · LED|Strapping pin, on-board blue LED on many boards. Must be LOW or floating to upload code — don’t attach a pull-up.',
        'GPIO15|strap|ADC2_CH3 · TOUCH3 · HSPI CS · MTDO|Strapping pin with a pull-up. LOW at boot silences the boot messages. Outputs PWM at boot.',
        'GPIO8|avoid|SD1 · flash|' + FLASH,
        'GPIO7|avoid|SD0 · flash|' + FLASH,
        'GPIO6|avoid|CLK · flash|' + FLASH,
      ],
      straps: [
        ['GPIO0', 'Pull-up', 'LOW at reset → download (flashing) mode. Leave HIGH for normal start.'],
        ['GPIO2', 'Pull-down', 'Must be LOW or floating to enter download mode.'],
        ['GPIO5', 'Pull-up', 'SDIO slave timing. Keep HIGH at boot.'],
        ['GPIO12', 'Pull-down', 'Flash voltage. HIGH → 1.8 V and most modules won’t boot. Keep LOW (or fix with “espefuse.py set_flash_voltage 3.3V”).'],
        ['GPIO15', 'Pull-up', 'LOW silences boot log on UART0; also SDIO timing.'],
      ],
      tips: [
        'Safest everyday pins: 4, 13, 16–19, 21–23, 25–27, 32, 33.',
        'GPIO 34, 35, 36, 39 are inputs only with no pull-ups.',
        'Pins 6–11 connect to flash. Never use them.',
        'For analog with Wi-Fi on, use ADC1 pins: 32–39. ADC2 pins stop working while Wi-Fi runs.',
        'Pins are 3.3 V only and not 5 V tolerant. Keep current at 20 mA or less per pin.',
        'Any output pin can do PWM (LEDC) and most can be re-mapped for UART, I²C or SPI.',
      ],
    },
    s3: {
      tab: 'ESP32-S3 DevKit', title: 'ESP32-S3-DevKitC-1 (44-pin)', usb: 'bottom', chip: 'ESP32-S3',
      sub: 'Espressif’s ESP32-S3-DevKitC-1, antenna at the top. Many S3 clones copy this layout — check the labels on your board.',
      left: [
        '3V3|pwr|3.3 V out|Output of the board’s 3.3 V regulator.',
        '3V3|pwr|3.3 V out|Output of the board’s 3.3 V regulator.',
        'RST|ctl|Reset (EN)|Pulling it LOW resets the chip. Wired to the RST button.',
        'GPIO4|io|ADC1_CH3 · TOUCH4|Free to use; analog works with Wi-Fi on.',
        'GPIO5|io|ADC1_CH4 · TOUCH5|Free to use; analog works with Wi-Fi on.',
        'GPIO6|io|ADC1_CH5 · TOUCH6|Free to use; analog works with Wi-Fi on.',
        'GPIO7|io|ADC1_CH6 · TOUCH7|Free to use; analog works with Wi-Fi on.',
        'GPIO15|io|ADC2_CH4 · 32k crystal|Free to use. ' + ADC2,
        'GPIO16|io|ADC2_CH5 · 32k crystal|Free to use. ' + ADC2,
        'GPIO17|io|ADC2_CH6 · UART1 TX|Free to use. ' + ADC2,
        'GPIO18|io|ADC2_CH7 · UART1 RX|Free to use. ' + ADC2,
        'GPIO8|io|ADC1_CH7 · TOUCH8 · I²C SDA (default)|Default I²C data in Arduino.',
        'GPIO3|strap|ADC1_CH2 · TOUCH3|Strapping pin for JTAG source, but only matters if special eFuses are burned. Normally free to use — just don’t force a level at boot.',
        'GPIO46|strap|Boot mode · ROM log|Strapping pin with a pull-down. Must be LOW at reset to enter download mode. Avoid anything that pulls it HIGH at power-up.',
        'GPIO9|io|ADC1_CH8 · TOUCH9 · I²C SCL (default)|Default I²C clock in Arduino.',
        'GPIO10|io|ADC1_CH9 · TOUCH10 · SPI CS|Default SPI chip-select in Arduino.',
        'GPIO11|io|ADC2_CH0 · TOUCH11 · SPI MOSI|Default SPI data out in Arduino. ' + ADC2,
        'GPIO12|io|ADC2_CH1 · TOUCH12 · SPI SCK|Default SPI clock in Arduino. ' + ADC2,
        'GPIO13|io|ADC2_CH2 · TOUCH13 · SPI MISO|Default SPI data in in Arduino. ' + ADC2,
        'GPIO14|io|ADC2_CH3 · TOUCH14|Free to use. ' + ADC2,
        '5V|pwr|5 V (USB)|5 V from USB. Can power the board from a 5 V supply.',
        'GND|gnd|Ground|',
      ],
      right: [
        'GND|gnd|Ground|',
        'GPIO43|care|TX0 · UART0|Serial transmit to the “UART” USB port; prints boot messages. Avoid for other uses.',
        'GPIO44|care|RX0 · UART0|Serial receive from the “UART” USB port. Avoid for other uses.',
        'GPIO1|io|ADC1_CH0 · TOUCH1|Free to use; analog works with Wi-Fi on.',
        'GPIO2|io|ADC1_CH1 · TOUCH2|Free to use; analog works with Wi-Fi on.',
        'GPIO42|io|JTAG MTMS|Free to use unless you debug over external JTAG.',
        'GPIO41|io|JTAG MTDI|Free to use unless you debug over external JTAG.',
        'GPIO40|io|JTAG MTDO|Free to use unless you debug over external JTAG.',
        'GPIO39|io|JTAG MTCK|Free to use unless you debug over external JTAG.',
        'GPIO38|io|RGB LED (v1.1)|Drives the on-board RGB LED on board version 1.1.',
        'GPIO37|care|Octal PSRAM|On modules with 8 MB octal PSRAM (N8R8, N16R8…) this pin is used by the PSRAM — don’t use it there.',
        'GPIO36|care|Octal PSRAM|On modules with octal PSRAM (N8R8, N16R8…) this pin is used by the PSRAM — don’t use it there.',
        'GPIO35|care|Octal PSRAM|On modules with octal PSRAM (N8R8, N16R8…) this pin is used by the PSRAM — don’t use it there.',
        'GPIO0|strap|BOOT button|Strapping pin wired to the BOOT button. LOW at reset enters download mode. Usable after boot if nothing holds it LOW at power-up.',
        'GPIO45|strap|Flash voltage|Strapping pin with a pull-down: HIGH at boot selects 1.8 V flash and most modules won’t boot. Keep it LOW at power-up.',
        'GPIO48|io|RGB LED (v1.0)|Drives the on-board RGB LED on board version 1.0.',
        'GPIO47|io|—|Free to use. On 1.8 V-flash modules (R16V) pins 47 and 48 run at 1.8 V.',
        'GPIO21|io|—|Free to use.',
        'GPIO20|care|USB D+ · ADC2_CH9|Native USB (the “USB” port). Using it as a GPIO disables USB uploads and serial on that port.',
        'GPIO19|care|USB D− · ADC2_CH8|Native USB (the “USB” port). Using it as a GPIO disables USB uploads and serial on that port.',
        'GND|gnd|Ground|',
        'GND|gnd|Ground|',
      ],
      straps: [
        ['GPIO0', 'Pull-up', 'LOW at reset (with GPIO46 LOW) → download mode. BOOT button.'],
        ['GPIO3', 'Floating', 'JTAG signal source — only used when certain eFuses are burned.'],
        ['GPIO45', 'Pull-down', 'Flash voltage (VDD_SPI). HIGH → 1.8 V. Keep LOW at boot.'],
        ['GPIO46', 'Pull-down', 'Boot mode and ROM log. Must be LOW for download mode.'],
      ],
      tips: [
        'Safest everyday pins: 1, 2, 4–18, 21, 38–42, 47, 48.',
        'GPIO 26–32 are used by the flash chip and aren’t broken out.',
        'If your module has octal PSRAM (name ends in R8 or R16), leave GPIO 35, 36, 37 alone.',
        'GPIO 19 and 20 are the native USB port. Leave them alone if you upload over that port.',
        'Use ADC1 pins (1–10) for analog when Wi-Fi is on.',
        'Pins are 3.3 V only and not 5 V tolerant.',
      ],
    },
    xs3: {
      tab: 'XIAO ESP32-S3', title: 'Seeed XIAO ESP32-S3', usb: 'top', chip: 'XIAO S3',
      sub: 'Top view, USB-C at the top. D-numbers are what you write in Arduino; the GPIO number is what the chip uses. Same layout on the S3 Sense.',
      left: [
        'D0|io|GPIO1 · A0 · TOUCH1|Analog A0 (ADC1). Free to use.',
        'D1|io|GPIO2 · A1 · TOUCH2|Analog A1 (ADC1). Free to use.',
        'D2|strap|GPIO3 · A2 · TOUCH3|Strapping pin for JTAG source — only matters if special eFuses are burned. Normally free to use.',
        'D3|io|GPIO4 · A3 · TOUCH4|Analog A3 (ADC1). Free to use.',
        'D4|io|GPIO5 · A4 · SDA|Default I²C data.',
        'D5|io|GPIO6 · A5 · SCL|Default I²C clock.',
        'D6|io|GPIO43 · TX|Hardware serial TX (Serial1 / Serial0). Free when not using that serial port.',
      ],
      right: [
        '5V|pwr|5 V (USB)|5 V from USB-C. Can power the board from 5 V. For a LiPo, use the battery pads underneath.',
        'GND|gnd|Ground|',
        '3V3|pwr|3.3 V out|Regulator output, up to about 700 mA shared with the board.',
        'D10|io|GPIO9 · A10 · MOSI|Default SPI data out. On the Sense, shared with the microSD card slot.',
        'D9|io|GPIO8 · A9 · MISO|Default SPI data in. On the Sense, shared with the microSD card slot.',
        'D8|io|GPIO7 · A8 · SCK|Default SPI clock. On the Sense, shared with the microSD card slot.',
        'D7|io|GPIO44 · RX|Hardware serial RX. Free when not using that serial port.',
      ],
      straps: [
        ['GPIO0', 'Pull-up', 'BOOT button on the board, not on the header. Hold it while plugging in USB to force download mode.'],
        ['GPIO3 (D2)', 'Floating', 'JTAG signal source — only used when certain eFuses are burned. Safe in normal use.'],
        ['GPIO45/46', '—', 'Not on the header, so you can’t accidentally upset them.'],
      ],
      tips: [
        'All pins except D6/D7 can read analog, and all of them use ADC1, so analog works with Wi-Fi on.',
        'User LED is on GPIO21 (lit when LOW).',
        'On the Sense, the camera uses many internal pins and the SD card shares D8–D10 (CS on GPIO21).',
        'Pins are 3.3 V only — never connect 5 V signals directly.',
        'If uploads stop working, hold BOOT, press RESET, release BOOT, then upload again.',
      ],
    },
    xc3: {
      tab: 'XIAO ESP32-C3', title: 'Seeed XIAO ESP32-C3', usb: 'top', chip: 'XIAO C3',
      sub: 'Top view, USB-C at the top. D-numbers are what you write in Arduino; the GPIO number is what the chip uses. The C3 has three strapping pins on the header, so take care.',
      left: [
        'D0|strap|GPIO2 · A0|Strapping pin: must be HIGH at power-up for the chip to boot. Avoid circuits that pull it LOW at reset.',
        'D1|io|GPIO3 · A1|Analog A1 (ADC1). Free to use.',
        'D2|io|GPIO4 · A2|Analog A2 (ADC1). Free to use.',
        'D3|io|GPIO5 · A3|Analog A3 is on ADC2, which is unreliable — prefer A0–A2 for analog.',
        'D4|io|GPIO6 · SDA|Default I²C data.',
        'D5|io|GPIO7 · SCL|Default I²C clock.',
        'D6|care|GPIO21 · TX|UART0 TX — prints boot messages at start-up. Fine for serial, careful with other uses.',
      ],
      right: [
        '5V|pwr|5 V (USB)|5 V from USB-C. Can power the board from 5 V. For a LiPo, use the battery pads underneath.',
        'GND|gnd|Ground|',
        '3V3|pwr|3.3 V out|Regulator output.',
        'D10|io|GPIO10 · MOSI|Default SPI data out. Free to use.',
        'D9|strap|GPIO9 · MISO · BOOT|Strapping pin wired to the BOOT button: LOW at reset enters download mode. Usable after boot if nothing holds it LOW at power-up.',
        'D8|strap|GPIO8 · SCK|Strapping pin: must be HIGH at reset when entering download mode. Avoid pulling it LOW at power-up.',
        'D7|care|GPIO20 · RX|UART0 RX. Fine for serial, careful with other uses.',
      ],
      straps: [
        ['GPIO2 (D0)', '—', 'Must be HIGH at boot.'],
        ['GPIO8 (D8)', '—', 'Must be HIGH for download mode; also controls the ROM log.'],
        ['GPIO9 (D9)', 'Pull-up', 'LOW at reset → download mode. BOOT button.'],
      ],
      tips: [
        'Safest everyday pins: D1, D2, D3, D4, D5, D10.',
        'Use A0–A2 for analog — A3 is on ADC2 and can misread.',
        'The C3 has no user LED on the XIAO board.',
        'Native USB uses internal GPIO18/19, so uploads keep working whatever you do with the header pins.',
        'Pins are 3.3 V only and not 5 V tolerant.',
      ],
    },
  };

  const TYPE = { pwr: 'Power', gnd: 'Ground', io: 'Free GPIO', in: 'Input only', strap: 'Strapping pin', care: 'Usable with care', avoid: 'Do not use', ctl: 'Reset / enable' };
  const FILTERS = [
    ['all', 'All', () => true],
    ['safe', 'Safe GPIO', p => p.t === 'io'],
    ['strap', 'Strapping', p => p.t === 'strap'],
    ['adc', 'Analog', p => /ADC|A\d/.test(p.fn)],
    ['touch', 'Touch', p => /TOUCH/.test(p.fn)],
    ['bus', 'I²C / SPI / UART', p => /I²C|SPI|MOSI|MISO|SCK|SDA|SCL|TX|RX/.test(p.fn)],
    ['avoid', 'Avoid', p => p.t === 'avoid' || p.t === 'care' || p.t === 'in'],
  ];
  const parse = s => { const [n, t, fn, note] = s.split('|'); return { n, t, fn, note }; };

  BT.add({
    id: 'pinout', cat: 'Microcontrollers', title: 'ESP32 pinouts & strapping pins',
    desc: 'ESP32, ESP32-S3, XIAO S3 and XIAO C3 — tap a pin for notes.',
    keys: 'gpio pin map esp32-s3 xiao seeed c3 boot strapping adc touch i2c spi uart devkit wroom header which pin',
    render(root) {
      let board = BT.store.get('pin:board', 'esp32'), filter = 'all', selected = null;
      if (!BOARDS[board]) board = 'esp32';
      const boardChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Board' });
      const filterChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Highlight' });
      const sub = h('p', { class: 'hint' }), grid = h('div', { class: 'board' }), info = h('div', { class: 'pin-info', hidden: true, 'aria-live': 'polite' });
      const extra = h('div');
      const legend = h('div', { class: 'legend' }, Object.entries(TYPE).map(([k, l]) => h('span', null, h('i', { class: 'key t-' + k }), l)));

      const show = p => {
        selected = p;
        grid.querySelectorAll('.pin').forEach(b => b.classList.toggle('sel', b._p === p));
        info.hidden = false;
        info.replaceChildren(h('div', null, h('b', null, p.n), ' — ', TYPE[p.t]), h('div', { class: 'fnl' }, p.fn), p.note && h('p', null, p.note));
      };
      const draw = () => {
        const B = BOARDS[board], f = FILTERS.find(x => x[0] === filter)[2];
        boardChips.replaceChildren(...Object.entries(BOARDS).map(([k, b]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(k === board),
          onclick: () => { board = k; selected = null; info.hidden = true; BT.store.set('pin:board', k); draw(); } }, b.tab)));
        filterChips.replaceChildren(...FILTERS.map(([k, l]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(k === filter),
          onclick: () => { filter = k; draw(); } }, l)));
        sub.textContent = B.sub;
        const L = B.left.map(parse), R = B.right.map(parse), rows = Math.max(L.length, R.length);
        const pin = (p, side, r) => {
          const b = h('button', { type: 'button', class: `pin ${side} t-${p.t}${f(p) ? '' : ' dim'}${selected && selected.n === p.n && selected.fn === p.fn ? ' sel' : ''}`,
            style: `grid-row:${r + 1}`, 'aria-label': `${p.n}, ${TYPE[p.t]}, ${p.fn}`, onclick: () => show(p) },
            side === 'L' ? [h('span', { class: 'fn' }, p.fn), h('span', { class: 'nm' }, p.n)] : [h('span', { class: 'nm' }, p.n), h('span', { class: 'fn' }, p.fn)]);
          b._p = p;
          return b;
        };
        grid.replaceChildren(
          h('div', { class: 'pcb' + (B.usb === 'top' ? ' usb-top' : ''), style: `grid-row:1 / span ${rows}`, 'aria-hidden': 'true' },
            h('span', { class: 'mod' }, B.chip), h('span', { class: 'usb' }, 'USB')),
          ...L.map((p, i) => pin(p, 'L', i)), ...R.map((p, i) => pin(p, 'R', i)));
        extra.replaceChildren(
          h('h2', { class: 'sec' }, 'Strapping pins'),
          h('p', { class: 'hint', style: 'margin-bottom:6px' }, 'The chip reads these pins at the moment it powers up or resets, to decide how to start. Anything you connect must not force the wrong level at that moment — afterwards they work as normal pins.'),
          h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Pin'), h('th', null, 'Default'), h('th', null, 'What it decides'))),
            h('tbody', null, B.straps.map(s => h('tr', null, s.map(c => h('td', null, c)))))),
          h('h2', { class: 'sec' }, 'Good to know'),
          h('ul', { class: 'bullets' }, B.tips.map(t => h('li', null, t))));
      };
      root.append(boardChips, sub, h('div', { style: 'height:8px' }), filterChips, legend, grid, info, extra);
      draw();
    },
  });
})();
