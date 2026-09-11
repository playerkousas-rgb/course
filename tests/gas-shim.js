/* gas-shim.js — 測試用最小 Apps Script 服務替身（只畀 tests/ 載入；
 * 令 CourseHub.gs 嘅 setup／設定／密匙函式可以喺 Node 直接測試） */
'use strict';
const nodeCrypto = require('crypto');

var Utilities = {
  Charset: { UTF_8: 'utf-8' },
  DigestAlgorithm: { SHA_256: 'sha256' },
  computeDigest(alg, input, charset) {
    const h = nodeCrypto.createHash('sha256').update(String(input == null ? '' : input)).digest('hex');
    const out = [];
    for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.substr(i, 2), 16) - 256);
    return out; /* GAS byte 簽名（負數）；hubSha256_ 會 +256 還原 */
  },
  getUuid() {
    return nodeCrypto.randomUUID();
  },
  newBlob() { return { setName() { return this; }, getBytes() { return []; } }; },
  base64Decode(s) { return Buffer.from(String(s), 'base64'); },
  sleep() {},
};

var __gasCache = new Map();
var CacheService = {
  getScriptCache() {
    return {
      get(k) { return __gasCache.has(k) ? __gasCache.get(k).v : null; },
      put(k, v, sec) { __gasCache.set(k, { v: String(v), until: Date.now() + (sec || 600) * 1000 }); },
      remove(k) { __gasCache.delete(k); },
    };
  },
};

var __activeSs = null;
var SpreadsheetApp = {
  ProtectionType: { SHEET: 'SHEET' },
  getActiveSpreadsheet() { return __activeSs; },
  __setActive(ss) { __activeSs = ss; },
  openById() { return __activeSs; },
};

var DriveApp = {
  getFolderById() { return driveStub; },
  getRootFolder() { return driveStub; },
  getFileById() { return fileStub; },
};
var driveStub = {
  createFolder() { return driveStub; },
  getFoldersByName() { return { hasNext: () => false, next: () => driveStub }; },
  createFile() { return fileStub; },
};
var fileStub = {
  makeCopy() { return fileStub; },
  getId() { return 'fake-file-id'; },
  getUrl() { return 'https://docs.google.com/spreadsheets/d/fake-file-id/edit'; },
  setName() { return fileStub; },
  addEditor() { return fileStub; },
  setTrashed() {},
};

var ScriptApp = { getService() { return { getUrl: () => 'https://script.example/exec' }; } };
var Session = { getEffectiveUser() { return { getEmail: () => 'training-system@example.org' }; } };
var UrlFetchApp = { fetch() { return { getContentText: () => '{"ok":true,"data":{}}' }; } };
var Logger = { log() {}, };

/* 簡易假 Sheet（2D grid）＋假 Spreadsheet，足夠 setup／config／auth 測試 */
function gasFakeSheet(name) {
  const grid = [[]];
  function ensure(r, c) {
    while (grid.length < r) grid.push([]);
    for (let i = 0; i < grid.length; i++) while (grid[i].length < c) grid[i].push('');
  }
  return {
    name: name, hidden: false,
    getLastRow() { let n = 0; grid.forEach((r, i) => { if (r.some(v => String(v) !== '')) n = i + 1; }); return n; },
    getLastColumn() { return grid.reduce((m, r) => Math.max(m, r.length), 0); },
    getMaxRows() { return grid.length; },
    getMaxColumns() { return grid.reduce((m, r) => Math.max(m, r.length), 0); },
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      return {
        getValue() { ensure(r, c); return grid[r - 1][c - 1]; },
        setValue(v) { ensure(r + nr - 1, c + nc - 1); grid[r - 1][c - 1] = v; return this; },
        getValues() { ensure(r + nr - 1, c + nc - 1); const o = []; for (let i = 0; i < nr; i++) o.push(grid[r - 1 + i].slice(c - 1, c - 1 + nc)); return o; },
        setValues(vals) {
          ensure(r + nr - 1, c + nc - 1);
          vals.forEach((rv, i) => rv.forEach((v, j) => { grid[r - 1 + i][c - 1 + j] = v; }));
          return this;
        },
        setFormula() { return this; },
        setFormulas() { return this; },
      };
    },
    getProtections() { return []; },
    hideSheet() { this.hidden = true; },
    showSheet() { this.hidden = false; },
    insertRowsAfter() {}, insertColumnsAfter() {},
    protect() { return { setWarningOnly() { return this; }, addEditor() { return this; } }; },
  };
}
function gasFakeSs(sheetNames) {
  const sheets = {};
  (sheetNames || []).forEach((n) => { sheets[n] = gasFakeSheet(n); });
  return {
    _sheets: sheets,
    getId() { return 'fake-ss-id'; },
    getName() { return '假原點'; },
    getSheetByName(n) { return sheets[n] || null; },
    insertSheet(n) { sheets[n] = gasFakeSheet(n); return sheets[n]; },
  };
}
