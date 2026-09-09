/* run_all.js — 跑晒全部測試 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => /^t_.*\.js$/.test(f)).sort();
let failed = 0;
files.forEach((f) => {
  console.log('\n════════ ' + f + ' ════════');
  const r = spawnSync('node', [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
});
console.log('\n────────────────────────');
console.log(failed ? '❌ ' + failed + ' 個測試檔失敗' : '✅ 全部測試檔通過 (' + files.length + ')');
process.exit(failed ? 1 : 0);
