// Run with:  node tests/lessons.test.js
// Every lesson's solution must pass all checks; every starter must fail.
const path = require('path');
for (const f of ['interpreter', 'board', 'lessons']) require(path.join(__dirname, '..', 'js', f + '.js'));
const S = globalThis.ESP32Sim;
let bad = 0;
const t0 = Date.now();
for (const L of S.LESSONS) {
  const sol = S.grade(L, L.solution);
  const st = S.grade(L, L.starter);
  const okSol = sol.passed, okStart = !st.passed && !st.compileError;
  if (!okSol || !okStart) bad++;
  console.log((okSol && okStart ? 'ok  ' : 'FAIL') + ' ' + L.id.padEnd(12) + ' checks=' + L.checks.length + ' hints=' + L.hints.length);
  if (!okSol) console.log('   solution:', sol.compileError ? sol.compileError.message : sol.results.filter(r => !r.ok));
  if (!okStart) console.log('   starter:', st.compileError ? st.compileError.message : 'passed unexpectedly');
}
console.log(S.LESSONS.length + ' lessons, ' + (Date.now() - t0) + ' ms');
process.exit(bad ? 1 : 0);
