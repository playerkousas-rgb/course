/* t_mock.js — mock 後端合約（照 Code.gs.course.js 語義） */
'use strict';
const { makeCtx, load, val, ok, eq, section, done } = require('./harness');
const ctx = makeCtx();
load(ctx, ['js/00-config.js', 'js/30-parse.js', 'js/15-mock.js']);
const { RESP_HEADERS, RC, TAB, MockAPI, MOCK_API_KEY, MockDemo } = val(ctx, '({ RESP_HEADERS, RC, TAB, MockAPI, MOCK_API_KEY, MockDemo })');

const KEY = MOCK_API_KEY;

async function main() {
  section('授權');
  const bad = await MockAPI.call('getCourseSheetRaw', { apiKey: 'wrong' });
  ok(bad.ok === false && /apiKey/.test(bad.error), '錯 key → Unauthorized');

  section('getCourseSheetRaw');
  const raw = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  ok(raw.ok === true, 'ok');
  eq(raw.data.rev, 0, '初始 rev 0');
  const resp = raw.data.resp;
  eq(resp.length, 11, '10 筆報名 + 表頭');
  const first = resp[1];
  eq(first[RC['旅號'] - 1], '82', '旅號公式值（港島第82旅→82）');
  eq(first[RC['學員編號'] - 1], 1, '學員編號 1（首個 ✔）');
  eq(resp[3][RC['學員編號'] - 1], 3, '學員編號 3');
  eq(resp[4][RC['學員編號'] - 1], '', 'pending 冇編號');
  ok(String(raw.data.input02[8][6]).indexOf('2026年10月17日') === 0, 'Input02 G 欄自動中文日期');

  section('listRegs');
  const lr = await MockAPI.call('listRegs', { apiKey: KEY });
  ok(lr.ok && lr.data.length === 10, '10 筆');
  eq(lr.data[0].status, 'pending', 'reverse 後最新先');

  section('setRegStatus（唔 bump rev）');
  const pendingId = resp[4][RC['時間戳記'] - 1];
  const st = await MockAPI.call('setRegStatus', { apiKey: KEY, id: pendingId, status: 'approved', reviewer: '陳大文' });
  ok(st.ok === true, '接納 ok');
  const raw2 = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  eq(raw2.data.rev, 0, 'rev 冇變（同 GAS 語義一致）');
  eq(raw2.data.resp[4][RC['學員編號'] - 1], 4, '新接納學員編號 4');
  eq(raw2.data.resp[4][RC['接納'] - 1], '✔', '接納欄 ✔');
  eq(raw2.data.resp[4][RC['批核人'] - 1], '陳大文', '批核人記錄');
  const badStatus = await MockAPI.call('setRegStatus', { apiKey: KEY, id: pendingId, status: 'wat' });
  ok(badStatus.ok === false, '非法狀態拒絕');
  const notFound = await MockAPI.call('setRegStatus', { apiKey: KEY, id: 'nope', status: 'approved' });
  ok(notFound.ok === false && /找不到/.test(notFound.error), '搵唔到報名');

  section('saveCourseBatch — baseRev 樂觀鎖');
  const cells = [{ tab: TAB.IN2, row: 4, col: 2, value: 30 }];
  const stale = await MockAPI.call('saveCourseBatch', { apiKey: KEY, cells: cells, baseRev: 99, by: '阿明' });
  ok(stale.ok === false && stale.conflict === true, '舊 rev → conflict（乜都冇寫）');
  const good = await MockAPI.call('saveCourseBatch', { apiKey: KEY, cells: cells, baseRev: raw2.data.rev, by: '阿明' });
  ok(good.ok === true, '正確 rev → 儲存');
  eq(good.data.rev, 1, 'rev bump 到 1');
  const raw3 = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  eq(raw3.data.input02[3][1], 30, '名額已寫 30');
  eq(raw3.data.revBy, '阿明', 'revBy 記錄邊個職員');

  section('saveCourseBatch — 唔帶 baseRev 照寫（GAS 相容）');
  const noRev = await MockAPI.call('saveCourseBatch', { apiKey: KEY, cells: [{ tab: TAB.IN2, row: 5, col: 2, value: 55 }], by: '阿明' });
  ok(noRev.ok === true, '唔帶 rev → 照寫');

  section('saveCourseBatch — 座標驗證');
  const badCell = await MockAPI.call('saveCourseBatch', { apiKey: KEY, cells: [{ tab: TAB.IN2, row: 999, col: 2, value: 1 }] });
  ok(badCell.ok === false && /座標/.test(badCell.error), '超出行數 → 成批拒絕');
  const skip = await MockAPI.call('saveCourseBatch', { apiKey: KEY, cells: [{ tab: '唔存在', row: 1, col: 1, value: 1 }], by: 'x' });
  ok(skip.ok === true && skip.data.skippedTabs[0] === '唔存在', '唔識嘅頁 skip 唔當錯');

  section('addReg（成員系統轉發）');
  const dupe = await MockAPI.call('addReg', { apiKey: KEY, email: 'siuming@example.hk', nameZh: '重覆人', phone: '1', receiptDataUrl: 'data:image/png;base64,x' });
  ok(dupe.ok === false && /重複/.test(dupe.error), '同電郵防重複');
  const nr = await MockAPI.call('addReg', { apiKey: KEY, email: 'new@example.hk', nameZh: '馮樂瑤', phone: '61000000', receiptDataUrl: 'data:image/png;base64,x', troop: '港島第82旅' });
  ok(nr.ok === true && /^CRS-/.test(nr.refCode), '新報名 + refCode');
  const raw4 = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  eq(raw4.data.resp.length, 12, '11 筆報名');

  section('addExpenseRow（append-only）');
  const ex = await MockAPI.call('addExpenseRow', { apiKey: KEY, amounts: { B: 50 }, note: '測試茶點' });
  ok(ex.ok === true, '入帳 ok');
  eq(ex.data.receiptNo, '2', '收據編號 2');
  const raw5 = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  eq(raw5.data.input04[8][1], 50, '支出寫入 B 欄');
  const exEmpty = await MockAPI.call('addExpenseRow', { apiKey: KEY, amounts: {} });
  ok(exEmpty.ok === false, '空支出拒絕');

  section('未知 action');
  const unk = await MockAPI.call('whatever', { apiKey: KEY });
  ok(unk.ok === false && /未知的 action/.test(unk.error), '未知 action');

  /* ══ coursev5 密碼系統 ══ */
  section('auth 密碼系統（coursev5）');
  MockDemo.resetPw();

  let a = await MockAPI.call('auth', { apiKey: KEY, password: '1234' });
  ok(a.ok && a.data.firstLogin === true && a.data.role === 'staff', '預設 1234 → firstLogin（提示改密碼）');
  ok(a.ok && a.data.v === '5.0.0', '回應帶版本 v5.0.0');

  a = await MockAPI.call('auth', { apiKey: KEY, password: '0000' });
  ok(!a.ok && /密碼錯誤/.test(a.error), '錯密碼 → 拒絕');

  a = await MockAPI.call('setPassword', { apiKey: KEY, oldPassword: '0000', newPassword: 'abcd1234' });
  ok(!a.ok, '舊密碼錯 → 唔俾改');

  a = await MockAPI.call('setPassword', { apiKey: KEY, oldPassword: '1234', newPassword: '1234' });
  ok(!a.ok, '新密碼唔可以係 1234');

  a = await MockAPI.call('setPassword', { apiKey: KEY, oldPassword: '1234', newPassword: 'ab' });
  ok(!a.ok, '新密碼太短（≥4）');

  a = await MockAPI.call('setPassword', { apiKey: KEY, oldPassword: '1234', newPassword: 'hk2026' });
  ok(a.ok, '改密碼 ok');

  a = await MockAPI.call('auth', { apiKey: KEY, password: 'hk2026' });
  ok(a.ok && a.data.firstLogin === false, '新密碼登入 → firstLogin=false');

  a = await MockAPI.call('auth', { apiKey: KEY, password: '1234' });
  ok(!a.ok, '舊密碼已失效');

  MockDemo.setAdmin('tester', 'testpw');   /* mock 管理員（真後備帳號只寫喺 GS Auth.gs） */
  a = await MockAPI.call('auth', { apiKey: KEY, password: 'tester:testpw' });
  ok(a.ok && a.data.role === 'admin' && a.data.firstLogin === false, '「帳號:密碼」→ 管理員登入');

  a = await MockAPI.call('setPassword', { apiKey: KEY, oldPassword: 'tester:testpw', newPassword: 'hk2027' });
  ok(a.ok, '管理員可以重設密碼');
  a = await MockAPI.call('auth', { apiKey: KEY, password: 'hk2027' });
  ok(a.ok, '管理員重設後新密碼生效');

  for (let i = 0; i < 5; i++) await MockAPI.call('auth', { apiKey: KEY, password: 'wrong' + i });
  a = await MockAPI.call('auth', { apiKey: KEY, password: 'hk2027' });
  ok(!a.ok && /嘗試次數太多/.test(a.error), '錯 5 次 → 鎖 10 分鐘（啱密碼都暫時入唔到）');

  MockDemo.resetPw();
  a = await MockAPI.call('auth', { apiKey: KEY, password: '1234' });
  ok(a.ok && a.data.firstLogin === true, 'resetPw → 回復預設 1234');

  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
