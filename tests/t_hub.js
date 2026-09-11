/* t_hub.js — 單一原點 GS（CourseHub）合約
 * 1. TemplateLayout（GAS 模版規格）同前端／mock 三方對帳
 * 2. mock hub 語義：單一 /exec＋登記表對應、班隔離、密碼按班、
 *    addReg by publicCourseId、舊班 importCourse proxy
 */
'use strict';
const { makeCtx, load, val, ok, eq, section, done } = require('./harness');
const ctx = makeCtx();
load(ctx, [
  'js/00-config.js', 'js/30-parse.js', 'js/15-mock.js',
  'apps-script/CourseHub.gs',   /* 單一檔案：〔一〕模版規格段係純數據；同 GAS setup 同源 */
]);
const G = val(ctx, '({ RESP_HEADERS, RC, TAB, MockAPI, MOCK_API_KEY, MockDemo, TPL_TABS, TPL_RESP_HEADERS, IN3_LAYOUT })');

function tpl(name) { return G.TPL_TABS.filter(t => t.name === name)[0] || null; }
function gridOf(cells, rows, cols) {
  const g = [];
  for (let i = 0; i < rows; i++) g.push(new Array(cols).fill(''));
  cells.forEach(c => { g[c[0] - 1][c[1] - 1] = c[2]; });
  return g;
}

async function main() {
  /* ══ P0：模版規格三方對帳 ══ */
  section('TemplateLayout 結構');
  const needTabs = Object.keys(G.TAB).map(k => G.TAB[k]).concat(['_Sync']);
  needTabs.forEach(n => ok(!!tpl(n), '模版有分頁：' + n));

  section('TemplateLayout ↔ 前端座標');
  eq(G.TPL_RESP_HEADERS.length, G.RESP_HEADERS.length, '表格回應 53 欄');
  eq(G.TPL_RESP_HEADERS, G.RESP_HEADERS, '表格回應表頭完全一致（00-config RESP_HEADERS）');
  eq(tpl('表格回應').formulaCols.map(f => f.col), [30, 35], '公式欄 AD 旅號／AI 學員編號');

  /* Input02 職員表頭（行22）同前端一致 */
  const in2 = gridOf(tpl('Input02 訓練班資料').cells, 50, 12);
  eq([1, 2, 3, 4, 5, 6, 7].map(c => in2[21][c - 1]),
    ['職位', '姓名', '稱謂', '所屬單位 / 職銜', '資格標註', '電話', '電郵'], 'Input02 行22 職員表頭');
  eq(in2[22][0], '班領導人', 'Input02 A23 預設班領導人');
  /* 節次公式（G 欄 9-16） */
  const gFormulas = tpl('Input02 訓練班資料').formulas.filter(f => f[1] === 7 && f[0] >= 9 && f[0] <= 16);
  eq(gFormulas.length, 8, 'Input02 G9-G16 自動中文日期公式');

  /* Input03 block 結構同前端 IN3_LAYOUT 一致 */
  const in3 = gridOf(tpl('Input03 時間表').cells, 95, 8);
  for (let i = 0; i < G.IN3_LAYOUT.maxBlocks; i++) {
    const head = G.IN3_LAYOUT.firstHead + i * G.IN3_LAYOUT.blockRows;
    if (i === 0) ok(in3[head - 1][1] === '日期：' && in3[head - 1][4] === '地點：', 'Input03 block 頭（日期／地點）');
    if (i === G.IN3_LAYOUT.maxBlocks - 1) ok(in3[head + 2][1] === '時 間' && in3[head + 2][4] === '負責人', 'Input03 最後 block 表頭齊');
  }

  /* Input04 收據編號 1-35 */
  const in4 = gridOf(tpl('Input04_Print支出表').cells, 46, 11);
  eq(in4[7][0], 1, 'Input04 收據 1（R8）');
  eq(in4[41][0], 35, 'Input04 收據 35（R42）');
  eq(in4[5][0], '類別', 'Input04 行6 類別表頭');

  /* 參數分頁必要格 */
  const param = gridOf(tpl('參數').cells, 12, 2);
  const paramLabels = param.map(r => r[0]);
  ['區會批准', '訓練班電郵', '公開課程ID', '成員系統直接報名連結', 'FPS 識別碼'].forEach(l => {
    ok(paramLabels.indexOf(l) >= 0, '參數分頁有「' + l + '」');
  });
  ok(tpl('_Sync').hidden === true, '_Sync 隱藏');

  /* ══ mockBlankState ↔ 模版尺寸／共有格 ══ */
  section('mockBlankState ↔ 模版');
  const blank = val(ctx, 'mockBlankState("對帳測試班", { intake: 20, fee: 80, clName: "陳大文" }, { publicCourseId: "crs_test123" })');
  const dimChecks = [
    ['Input01 訓練班預算', 105, 13], ['Input02 訓練班資料', 50, 12],
    ['Input03 時間表', 95, 8], ['Input04_Print支出表', 46, 11],
    ['Print_通告', 48, 8], ['Print_學員出席紀錄', 64, 16],
    ['Print_訓練班完成報告', 46, 8], ['Print_領取證書紀錄', 44, 8],
  ];
  dimChecks.forEach(d => {
    const g = blank.sheets[d[0]];
    ok(g.length === d[1] && g[0].length === d[2], '尺寸 ' + d[0] + ' ' + d[1] + '×' + d[2]);
    const spec = tpl(d[0]);
    ok(spec && spec.rows === d[1] && spec.cols === d[2], '模版規格同尺寸 ' + d[0]);
  });
  eq(blank.sheets[G.TAB.RESP][0], G.RESP_HEADERS, '空白班 RESP 表頭齊');
  /* 模版共有格喺空白班一致（IN2 行22／IN4 表頭／IN3 block） */
  eq(blank.sheets[G.TAB.IN2][21].slice(0, 7), in2[21].slice(0, 7), '空白班 IN2 行22 同模版');
  eq(blank.sheets[G.TAB.IN4][5].slice(0, 11), in4[5].slice(0, 11), '空白班 IN4 行6 同模版');
  eq(blank.sheets[G.TAB.IN3][1][1], '日期：', '空白班 IN3 block 同模版');
  /* 參數：公開課程ID 跟 meta */
  ok(blank.sheets[G.TAB.PARAM].some(r => r[0] === '公開課程ID' && r[1] === 'crs_test123'), '空白班參數帶公開課程ID');
  ok(blank.sheets[G.TAB.PARAM].some(r => r[0] === '區會批准' && r[1] === ''), '空白班「區會批准」未 tick');

  /* ══ Hub 語義（單一 mock /exec＋登記表對應） ══ */
  section('hubInfo');
  const hi = await G.MockAPI.call('hubInfo', {});
  ok(hi.ok && /^6\.1\.0/.test(hi.data.hubVersion), 'hub 版本');
  ok(hi.data.ready === true && hi.data.courses.active >= 1, 'hub ready＋班數');
  ok(typeof hi.data.ownerEmail === 'string' && /.+@.+\..+/.test(hi.data.ownerEmail), 'ownerEmail（原點帳戶電郵：分享指引用）');

  section('新開班（三件套：內部課程ID／公開課程ID／API Key）');
  G.MockDemo.reset();
  const cc = await G.MockAPI.call('createCourse', { courseName: 'Hub 測試班 A', intake: 20, fee: 80, clName: '陳大文', sessions: [{ date: '2026-11-07', time: '1930 - 2130', venue: '區總部', onNotice: true }] });
  ok(cc.ok, '開班 ok');
  ok(/^ck_new_/.test(cc.data.apiKey), 'apiKey 格式');
  ok(/^crs_/.test(cc.data.publicCourseId) && /^crs_/.test(cc.data.courseId), '公開／內部課程ID 格式');
  ok(cc.data.publicCourseId !== cc.data.apiKey && cc.data.courseId !== cc.data.publicCourseId, '三件套互不相同');
  eq(cc.data.exec, 'mock', '回傳 exec＝hub（單一後端）');
  const KA = cc.data.apiKey, PIDA = cc.data.publicCourseId;
  const rawA = await G.MockAPI.call('getCourseSheetRaw', { apiKey: KA });
  ok(rawA.ok && String(rawA.data.input01[0][1]) === 'Hub 測試班 A', '路由：apiKey → 正確班');
  eq(rawA.data.input02[8][1], '2026-11-07', 'sessions 預填（Input02 B9）');
  eq(rawA.data.input02[8][7], true, 'sessions 預填（✓上通告）');

  section('路由防呆');
  const bad = await G.MockAPI.call('getCourseSheetRaw', { apiKey: 'ck_wrong' });
  ok(!bad.ok && /apiKey/.test(bad.error), '錯 key → Unauthorized');

  section('班隔離（獨立 rev／獨立密碼）');
  const cc2 = await G.MockAPI.call('createCourse', { courseName: 'Hub 測試班 B', clName: '李美芬' });
  const KB = cc2.data.apiKey, PIDB = cc2.data.publicCourseId;
  const svA = await G.MockAPI.call('saveCourseBatch', { apiKey: KA, cells: [{ tab: G.TAB.IN2, row: 4, col: 2, value: 22 }], by: '陳大文' });
  ok(svA.ok && svA.data.rev === 1, 'A 班 rev bump');
  const rawB = await G.MockAPI.call('getCourseSheetRaw', { apiKey: KB });
  eq(rawB.data.rev, 0, 'B 班 rev 唔受 A 班影響');
  const setPwA = await G.MockAPI.call('setPassword', { apiKey: KA, oldPassword: '1234', newPassword: 'classAAA' });
  ok(setPwA.ok, 'A 班改密碼');
  const authB = await G.MockAPI.call('auth', { apiKey: KB, password: '1234' });
  ok(authB.ok && authB.data.firstLogin === true, 'B 班仍然 1234／firstLogin（密碼按班）');

  section('addReg 只憑 publicCourseId（成員系統 direct link）');
  const nr = await G.MockAPI.call('addReg', { publicCourseId: PIDB, email: 'hubtest@example.hk', nameZh: '測試員', phone: '61234567', receiptDataUrl: 'data:image/png;base64,x' });
  ok(nr.ok && /^CRS-/.test(nr.refCode), '報名入咗 B 班');
  const rawB2 = await G.MockAPI.call('getCourseSheetRaw', { apiKey: KB });
  eq(rawB2.data.resp.length, 2, 'B 班 RESP 多咗一筆');
  eq(rawB2.data.resp[1][G.RC['_courseId'] - 1], PIDB, '_courseId＝B 班公開課程ID');
  const rawDemo = await G.MockAPI.call('getCourseSheetRaw', { apiKey: G.MOCK_API_KEY });
  eq(rawDemo.data.resp.length, 11, 'demo 班完全唔受影響');

  section('從登記表選班（輸入班密碼取回連線資料）');
  const lc = await G.MockAPI.call('listCourses', {});
  ok(lc.ok && lc.data.courses.length >= 3, '登記表列出所有班');
  ok(lc.data.courses.every(c => c.apiKey === '' && c.key === ''), '冇管理碼＝唔回 API Key（只公開班名）');
  ok(lc.data.courses.some(c => c.publicCourseId === PIDB && c.name === 'Hub 測試班 B'), '登記表有 B 班');
  const conn1 = await G.MockAPI.call('connectCourseByPassword', { publicCourseId: PIDB, password: 'wrongpw' });
  ok(!conn1.ok && /密碼錯誤/.test(conn1.error), '錯密碼 → 拒絕');
  const conn2 = await G.MockAPI.call('connectCourseByPassword', { publicCourseId: PIDB, password: '1234' });
  ok(conn2.ok && conn2.data.apiKey === KB && conn2.data.exec === 'mock', '啱密碼 → 自動取回 apiKey＋hub exec');
  ok(conn2.data.firstLogin === true, 'B 班首次登入提示');
  /* A 班已改密碼：要用新密碼 */
  const connA1 = await G.MockAPI.call('connectCourseByPassword', { publicCourseId: PIDA, password: '1234' });
  ok(!connA1.ok, 'A 班舊密碼失效');
  const connA2 = await G.MockAPI.call('connectCourseByPassword', { publicCourseId: PIDA, password: 'classAAA' });
  ok(connA2.ok && connA2.data.apiKey === KA && connA2.data.firstLogin === false, 'A 班新密碼 → 取回連線');

  section('防爆鎖按班獨立');
  for (let i = 0; i < 5; i++) await G.MockAPI.call('auth', { apiKey: KA, password: 'badbad' + i });
  const lockA = await G.MockAPI.call('auth', { apiKey: KA, password: 'classAAA' });
  ok(!lockA.ok && /嘗試次數太多/.test(lockA.error), 'A 班鎖咗');
  const stillB = await G.MockAPI.call('auth', { apiKey: KB, password: '1234' });
  ok(stillB.ok, 'B 班唔受 A 班鎖影響');

  section('後台（清理開錯班）');
  const al = await G.MockAPI.call('adminListCourses', { adminUser: 'sheep', adminPassword: '0728' });
  ok(al.ok && al.data.courses.some(c => c.publicCourseId === PIDB && c.apiKey === KB), '後台見到秘密資料');
  const del = await G.MockAPI.call('adminDeleteCourse', { adminUser: 'sheep', adminPassword: '0728', publicCourseId: PIDB, trashFile: true });
  ok(del.ok && del.data.deleted === true, '刪除開錯班');
  const gone = await G.MockAPI.call('getCourseSheetRaw', { apiKey: KB });
  ok(!gone.ok, '刪除後該班 key 失效');

  section('舊班遷移（importCourse → proxy 语义）');
  const imp = await G.MockAPI.call('importCourse', { adminUser: 'sheep', adminPassword: '0728', fileId: 'legacy-file-1', name: '舊制班', apiKey: 'ck_legacy_1', scriptExecUrl: 'https://legacy.example/exec' });
  ok(imp.ok && imp.data.imported === true, '舊班登記入原點');
  const connL = await G.MockAPI.call('connectCourseByPassword', { publicCourseId: imp.data.publicCourseId, password: '1234' });
  ok(connL.ok && connL.data.exec === 'https://legacy.example/exec', '舊班選班 → 回該班自己 /exec（前端照舊直連）');

  section('createCourse 選填 clEmail（自動分享班領導人）');
  const ccC = await G.MockAPI.call('createCourse', { courseName: '分享班 C', clName: '陳大文', clEmail: 'cl3@example.hk' });
  ok(ccC.ok, 'createCourse 帶 clEmail 照樣成功');
  const metaC = val(ctx, 'mockRegistry()')[ccC.data.apiKey];
  ok(metaC && metaC.clEmail === 'cl3@example.hk', '登記表 meta 記低 clEmail');
  ok(metaC && /^mock-/.test(metaC.fileId), '自動起嘅班都有檔案ID（供重複登記偵測）');

  section('registerCourse（登記表只係指針：Sheet 喺邊個帳戶開都得）');
  const rc = await G.MockAPI.call('registerCourse', {
    url: 'https://docs.google.com/spreadsheets/d/cl-own-sheet-1/edit?usp=drivesdk',
    courseName: 'CL 自開班', clName: '張小美', clEmail: 'cl4@example.hk', intake: 18, fee: 90,
    sessions: [{ date: '2026-12-05', time: '1930 - 2130', venue: '區總部', onNotice: true }],
  });
  ok(rc.ok, '網址入參 → 登記 ok');
  ok(rc.data.registered === true, 'registered:true');
  eq(rc.data.exec, 'mock', '登記班照樣用原點 /exec（單一後端）');
  ok(/^crs_/.test(rc.data.publicCourseId) && /^ck_reg_/.test(rc.data.apiKey), '登記班都自動產三件套');
  ok(/cl-own-sheet-1/.test(rc.data.url), '回傳該班 Sheet 自己嘅 url（擁有權留喺原帳戶）');
  /* 就地補齊模版結構＋預填（getCourseSheetRaw 驗證） */
  const rawR = await G.MockAPI.call('getCourseSheetRaw', { apiKey: rc.data.apiKey });
  ok(rawR.ok, '登記班即刻讀到');
  eq(rawR.data.resp[0], G.RESP_HEADERS, 'resp 頁頭齊（模版結構已就地補齊）');
  eq(rawR.data.rev, 0, '_Sync rev 0（新登記班由 0 開始）');
  ok(String(rawR.data.input01[0][1]) === 'CL 自開班', '預填班名');
  eq(rawR.data.input02[8][1], '2026-12-05', '登記帶 sessions 都預填（Input02 B9）');
  ok(rawR.data.paramsWX.some(r => r[0] === '公開課程ID' && r[1] === rc.data.publicCourseId), '參數分頁寫入公開課程ID');
  /* 重複登記＝拒絕 */
  const dup = await G.MockAPI.call('registerCourse', { fileId: 'cl-own-sheet-1' });
  ok(!dup.ok && /該 Sheet 已登記/.test(dup.error), '重複登記同一檔案 → 拒絕');
  const dup2 = await G.MockAPI.call('registerCourse', { url: 'https://docs.google.com/spreadsheets/d/cl-own-sheet-1/view' });
  ok(!dup2.ok && /已登記（CL 自開班）/.test(dup2.error), '經網址重複登記 → 拒絕（連班名）');
  /* 冇讀取權 → 提示分享 */
  const na = await G.MockAPI.call('registerCourse', { fileId: 'noaccess-sheet-9' });
  ok(!na.ok && /原點帳戶讀唔到.*分享（編輯者）/.test(na.error), '原點讀唔到 → 提示分享俾原點帳戶電郵');
  const noUrl = await G.MockAPI.call('registerCourse', {});
  ok(!noUrl.ok && /請貼該班 Sheet/.test(noUrl.error), '冇 url/fileId → 明確報錯');
  /* 登記班喺後台／選班流程零分別 */
  const al2 = await G.MockAPI.call('adminListCourses', { adminUser: 'sheep', adminPassword: '0728' });
  ok(al2.ok && al2.data.courses.some(c => c.publicCourseId === rc.data.publicCourseId && c.apiKey === rc.data.apiKey), 'adminList 見到登記班（含連線資料）');
  const connR = await G.MockAPI.call('connectCourseByPassword', { publicCourseId: rc.data.publicCourseId, password: '1234' });
  ok(connR.ok && connR.data.apiKey === rc.data.apiKey && connR.data.exec === 'mock', '選班 → 登記班照常取回連線');
  ok(connR.ok && connR.data.firstLogin === true, '登記班首次密碼 1234＋firstLogin');
  const rawR2 = await G.MockAPI.call('saveCourseBatch', { apiKey: rc.data.apiKey, cells: [{ tab: G.TAB.IN2, row: 4, col: 2, value: 20 }], by: '張小美' });
  ok(rawR2.ok && rawR2.data.rev === 1, '登記班寫入＋rev bump 照 coursev5 合約');

  section('hubRepairTemplate_（GAS 函式：只補缺、唔覆蓋既有內容）');
  function mkFakeSheet(name) {
    const grid = [];
    const ensure = (r, c) => { while (grid.length < r) grid.push([]); for (let i = 0; i < grid.length; i++) while (grid[i].length < c) grid[i].push(''); };
    return {
      name, hidden: false, grid,
      getRange(r, c, nr, nc) {
        nr = nr || 1; nc = nc || 1;
        const self = {
          getValue() { ensure(r, c); return grid[r - 1][c - 1]; },
          setValue(v) { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { ensure(r + nr, c + nc); grid[r - 1 + i][c - 1 + j] = v; } return self; },
          getValues() { ensure(r + nr, c + nc); const out = []; for (let i = 0; i < nr; i++) out.push(grid[r - 1 + i].slice(c - 1, c - 1 + nc)); return out; },
          setValues(vals) { vals.forEach((rv, i) => rv.forEach((v, j) => { ensure(r + nr, c + nc); grid[r - 1 + i][c - 1 + j] = v; })); return self; },
          setFormula() { return self; },
          setFormulas() { return self; },
        };
        return self;
      },
      hideSheet() { this.hidden = true; },
      getMaxRows() { return grid.length; },
      getMaxColumns() { return grid.reduce((x, r) => Math.max(x, r.length), 0); },
      insertRowsAfter() {}, insertColumnsAfter() {},
    };
  }
  const fakeSheets = {};
  const fakeSs = {
    getSheetByName: (n) => fakeSheets[n] || null,
    insertSheet: (n) => (fakeSheets[n] = mkFakeSheet(n)),
  };
  /* 模擬 CL 自己帳戶嘅 GS：得一張「表格回應」，表頭寫咗一半（仲改咗頭兩格名） */
  fakeSheets['表格回應'] = mkFakeSheet('表格回應');
  fakeSheets['表格回應'].getRange(1, 1, 1, 5).setValues([['我的時間', '我的電郵', '', '', '']]);
  const repair = val(ctx, 'hubRepairTemplate_');
  repair(fakeSs);
  const repHead = fakeSheets['表格回應'].getRange(1, 1, 1, 53).getValues()[0];
  eq(repHead[0], '我的時間', '已有內容嘅表頭格唔會被覆寫（col1 保留）');
  eq(repHead[1], '我的電郵', '已有內容嘅表頭格唔會被覆寫（col2 保留）');
  eq(repHead[2], '中文姓名', '空缺嘅表頭格先補返（col3）');
  ok(!!fakeSheets['Input01 訓練班預算'] && !!fakeSheets['參數'], '缺分頁補分頁（Input01／參數）');
  ok(!!fakeSheets['_Sync'] && String(fakeSheets['_Sync'].grid[0][0]) === '0' && fakeSheets['_Sync'].hidden === true, '_Sync 補建（rev 0＋隱藏）');

  G.MockDemo.reset();
  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
