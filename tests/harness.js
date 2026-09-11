/* 測試工具：用 vm 將 DOM-free 嘅 js 檔載入同一個 context（同瀏覽器全域一樣） */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeCtx() {
  const storage = new Map();
  const ctx = {
    console,
    require,
    process,
    Buffer,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Number, String, Boolean, Array, Object, RegExp, Promise, Intl,
    navigator: {},
    location: { hash: '', search: '', origin: 'http://test', pathname: '/' },
    fetch: async () => { throw new Error('tests: no fetch'); },
  };
  vm.createContext(ctx);
  return ctx;
}

function load(ctx, files) {
  files.forEach((f) => {
    const code = fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  });
}

/* vm 頂層 const/let 唔會掛上 context object——要喺 context 入面 eval 先攞到 */
function val(ctx, expr) {
  return vm.runInContext(expr, ctx);
}

const counters = { passed: 0, failed: 0 };
function ok(cond, msg) {
  if (cond) { counters.passed++; console.log('  ✓ ' + msg); }
  else { counters.failed++; console.error('  ✗ FAIL: ' + msg); }
}
function eq(a, b, msg) {
  ok(JSON.stringify(a) === JSON.stringify(b), msg + '  (got ' + JSON.stringify(a) + ' / want ' + JSON.stringify(b) + ')');
}
function section(name) { console.log('\n== ' + name + ' =='); }
function done() {
  console.log('\n' + (counters.failed ? '❌ ' + counters.failed + ' FAILED — ' : '✅ ') + counters.passed + ' passed');
  process.exit(counters.failed ? 1 : 0);
}

module.exports = { makeCtx, load, val, ok, eq, section, done };
