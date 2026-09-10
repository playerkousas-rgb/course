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

  /* ══ setPaymentCheck（區管理系統核對收款） ══ */
  section('setPaymentCheck 收款核對');
  MockDemo.reset();
  let pcRaw = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  let pcRow = pcRaw.data.resp[1];
  const pcId = pcRow[RC['時間戳記'] - 1];
  let pc = await MockAPI.call('setPaymentCheck', { apiKey: KEY, id: pcId, by: '區會財務' });
  ok(pc.ok && pc.data.verified === true, '核對收款 ok（identity 定位）');
  pcRaw = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  pcRow = pcRaw.data.resp[1];
  ok(pcRow[RC['已核對收款'] - 1] === '✔' && pcRow[RC['核對人'] - 1] === '區會財務', 'AS/AT 已寫');
  const pcRev = pcRaw.data.rev;
  pc = await MockAPI.call('setPaymentCheck', { apiKey: KEY, id: 'not-exist', by: 'x' });
  ok(!pc.ok, '搵唔到報名 → 拒絕');
  pcRaw = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  ok(pcRaw.data.rev === pcRev, 'setPaymentCheck 唔 bump rev（同 GAS 語義一致）');

  /* ══ setCompletionRow / setCertRow（完成評核＋領取證書） ══ */
  section('setCompletionRow 完成評核');
  MockDemo.reset();
  let crRaw = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  const crRev0 = crRaw.data.rev;
  let cr = await MockAPI.call('setCompletionRow', { apiKey: KEY, name: '李嘉俊', pass: true, certNo: 'SPG-2026-002', by: '陳大文' });
  ok(cr.ok && cr.data.updated === true, '李嘉俊評合格 ok');
  crRaw = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  let crRow = crRaw.data.completion[10];                       /* R11 */
  ok(String(crRow[0]) === '2' && crRow[1] === '李嘉俊' && crRow[4] === '合格' && crRow[3] === 'SPG-2026-002', 'R11 已寫（編號/姓名/證書編號/合格）');
  ok(crRaw.data.rev === crRev0 + 1, 'bump rev');
  /* 再評同一人 → 同一行更新，唔會開新行 */
  cr = await MockAPI.call('setCompletionRow', { apiKey: KEY, name: '李嘉俊', pass: false, failReason: '缺席兩節', by: '陳大文' });
  crRaw = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  crRow = crRaw.data.completion[10];
  ok(crRow[4] === '不合格' && crRow[5] === '缺席兩節' && String(crRow[3]) === 'SPG-2026-002', '同一行改為不合格＋原因');
  ok(crRaw.data.completion.filter((r) => String(r[1] || '') === '李嘉俊').length === 1, '冇重複行');
  cr = await MockAPI.call('setCompletionRow', { apiKey: KEY, name: '無人', pass: true });
  ok(!cr.ok, '搵唔到學員 → 拒絕');
  cr = await MockAPI.call('setCompletionRow', { apiKey: KEY, name: '李嘉俊', pass: true, baseRev: 0 });
  ok(!cr.ok && cr.conflict === true, '帶舊 baseRev → conflict（今次冇寫入）');

  section('setCertRow 領取證書');
  const ct = await MockAPI.call('setCertRow', { apiKey: KEY, name: '王小明', pickupDate: '2026-12-01', signed: '✔', by: '陳大文' });
  ok(ct.ok && ct.data.row === 7, '王小明 R7 登記領取');
  const ctRaw = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  const ctRow = ctRaw.data.cert[6];                            /* R7 */
  ok(String(ctRow[1]) === '1' && ctRow[5] === '2026-12-01' && ctRow[6] === '✔', 'R7 領取日期＋簽收已寫');
  const ct2 = await MockAPI.call('setCertRow', { apiKey: KEY, name: '陳美琪', pickupDate: '2026-12-02', signed: '✔' });
  ok(ct2.ok && ct2.data.row > 7, '陳美琪開新行');

  /* ══ 掛載流程（即刻起 GS 有 URL → 區會批准格 → 報名流入=掛載信號） ══ */
  section('掛載流程 區會批准/報名流入');
  MockDemo.reset();
  const fc = await MockAPI.call('createCourse', { courseName: '遠足專章訓練班', clName: '陳大文' });
  const FK = fc.data.apiKey;
  ok(fc.ok && /docs\.google\.com/.test(fc.data.url || ''), '即刻起表回傳 GS URL（交區管理系統連結批核）');
  /* CL 填寫中——參數分頁批准格未 tick */
  let fRaw = (await MockAPI.call('getCourseSheetRaw', { apiKey: FK })).data;
  ok(fRaw.paramsWX.some((r) => r[0] === '區會批准' && r[1] === ''), '新班「區會批准」未 tick');
  /* 區管理層 tick 批准（寫參數分頁,APP 只讀） */
  MockDemo.approveCourse(FK);
  fRaw = (await MockAPI.call('getCourseSheetRaw', { apiKey: FK })).data;
  ok(fRaw.paramsWX.some((r) => r[0] === '區會批准' && r[1] === '✔'), '參數分頁「區會批准」✔');
  /* 模擬掛載:成員系統報名流入新班(RESP 多一行) */
  const nr2 = MockDemo.newReg(FK);
  fRaw = (await MockAPI.call('getCourseSheetRaw', { apiKey: FK })).data;
  ok(fRaw.resp.length === 2 && fRaw.resp[1][RC['中文姓名'] - 1] === nr2.name, '報名流入（掛載信號）: ' + nr2.name);
  MockDemo.reset();

  /* ══ createCourse（CL 起表:新空白模版班,唔影響原有班） ══ */
  section('createCourse CL 起表');
  MockDemo.reset();
  let badCr = await MockAPI.call('createCourse', { courseName: '' });
  ok(!badCr.ok, '冇課程名 → 拒絕');
  const cc = await MockAPI.call('createCourse', { courseName: '遠足專科徽章訓練班', edition: 1, section: '童軍', badge: '興趣 - 遠足', intake: 20, fee: 80, clName: '陳大文' });
  ok(cc.ok && /^ck_new_/.test(cc.data.apiKey), '起表 ok（新 apiKey）');
  const NK = cc.data.apiKey;
  const nRaw = await MockAPI.call('getCourseSheetRaw', { apiKey: KEY });
  /* KEY 係 demo——先驗新班 */
  const nDump = (await MockAPI.call('getCourseSheetRaw', { apiKey: NK })).data;
  ok(String(nDump.input01[0][1]) === '遠足專科徽章訓練班', '新班課程名已入 Input01');
  ok(Array.isArray(nDump.resp) && nDump.resp[0].length === RESP_HEADERS.length, '新班 RESP 表頭齊');
  ok(String(nDump.input04[5][0]) === '類別', '新班 Input04 支出表頭齊');
  ok(nDump.rev === 0, '新班 rev 0');
  const au2 = await MockAPI.call('auth', { apiKey: NK, password: '1234' });
  ok(au2.ok && au2.data.firstLogin === true, '新班首次 1234（firstLogin）');
  /* 新班寫入 → 自己 rev bump */
  const sv2 = await MockAPI.call('saveCourseBatch', { apiKey: NK, cells: [{ tab: TAB.IN1, row: 11, col: 2, value: 24 }], by: '陳大文' });
  ok(sv2.ok && sv2.data.rev === 1, '新班寫入 bump rev');
  /* demo 班完全冇受影響 */
  const dRaw = (await MockAPI.call('getCourseSheetRaw', { apiKey: KEY })).data;
  ok(String(dRaw.input01[0][1]) === '攝影專科徽章訓練班', 'demo 班冇被影響');
  ok(dRaw.rev === 0, 'demo rev 冇被影響');
  /* 唔存在嘅 key → Unauthorized */
  const un = await MockAPI.call('getCourseSheetRaw', { apiKey: 'ck_no_such' });
  ok(!un.ok && /Unauthorized/.test(un.error), '唔存在嘅 key → Unauthorized');
  MockDemo.reset();

  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
