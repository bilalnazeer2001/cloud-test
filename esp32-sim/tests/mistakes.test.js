// Run with:  node tests/mistakes.test.js
// Common beginner mistakes must give a clear message, not a crash.
const path = require('path');
for (const f of ['interpreter', 'board', 'lessons']) require(path.join(__dirname, '..', 'js', f + '.js'));
const S = globalThis.ESP32Sim;
const L = (id) => S.LESSONS.find((l) => l.id === id);
const cases = [
  ['blink', 'void setup(){pinMode(2,OUTPUT);}\nvoid loop(){digitalWrite(2,HIGH);delay(1000);digitalWrite(2,LOW);}'],
  ['blink', 'void setup(){}\nvoid loop(){digitalWrite(2,HIGH);delay(1000);digitalWrite(2,LOW);delay(1000);}'],
  ['button', '#define RED 25\nvoid setup(){pinMode(RED,OUTPUT);pinMode(18,INPUT);}\nvoid loop(){digitalWrite(RED, digitalRead(18)==LOW);}'],
  ['counter', 'void setup(){Serial.begin(115200);pinMode(2,OUTPUT);}\nvoid loop(){int count=0;digitalWrite(2,HIGH);delay(500);digitalWrite(2,LOW);delay(500);count++;Serial.println(count);}'],
  ['toggle', '#define GREEN 27\nbool on=false;\nvoid setup(){pinMode(GREEN,OUTPUT);pinMode(18,INPUT_PULLUP);}\nvoid loop(){if(digitalRead(18)==LOW){on=!on;delay(300);}digitalWrite(GREEN,on);}'],
  ['millis', 'void setup(){pinMode(25,OUTPUT);}\nvoid loop(){digitalWrite(25,HIGH);delay(500);digitalWrite(25,LOW);delay(500);}'],
  ['hello', 'void setup(){Serial.println("Hello ESP32");}\nvoid loop(){}'],
  ['hello', 'void setup(){\n Serial.begin(115200)\n}\nvoid loop(){}'],
  ['hello', 'void setup(){ Serial.begin(115200); Serial.Println("hi"); }\nvoid loop(){}'],
  ['hello', 'void setup(){ int x = 5 / 0; }\nvoid loop(){}'],
  ['hello', 'void setup() {\n  for (;;) { }\n}\nvoid loop(){}'],
  ['hello', 'void setup(){ int a[3]; a[3] = 1; }\nvoid loop(){}'],
  ['hello', 'void setup(){ x = 1; }\nvoid loop(){}'],
  ['hello', 'void setup(){ if (1) { }\nvoid loop(){}'],
  ['hello', 'void f(){ f(); }\nvoid setup(){ f(); }\nvoid loop(){}'],
];
for (const [id, src] of cases) {
  const g = S.grade(L(id), src);
  const msg = g.compileError ? 'compile line ' + g.compileError.line + ': ' + g.compileError.message : (g.results.find((r) => !r.ok) || { msg: '(passed)' }).msg;
  console.log('[' + id + '] ' + msg);
}
