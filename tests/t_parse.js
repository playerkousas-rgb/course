/* t_parse.js — raw dump 解析 + 通告組版 */
'use strict';
const { makeCtx, load, val, ok, eq, section, done } = require('./harness');
const ctx = makeCtx();
load(ctx, ['js/00-config.js', 'js/30-parse.js']);
const { RESP_HEADERS, RC, TAB, normDate, fmtCNDate, parseAll, composeNoticeDoc, shCell } = val(ctx, '({ RESP_HEADERS, RC, TAB, normDate, fmtCNDate, parseAll, composeNoticeDoc, shCell })');

/* ── 日期工具 ── */
section('日期正規化');
eq(normDate('2026-10-04T16:00:00.000Z'), '2026-10-05', 'ISO datetime 轉香港時區（16:00Z=翌日 00:00 HKT）');
eq(normDate('2026-10-17'), '2026-10-17', 'yyyy-mm-dd 直通');
eq(normDate('17/10/2026'), '2026-10-17', 'd/m/yyyy');
eq(normDate('2026年10月17日（星期六）'), '2026-10-17', '中文日期');
eq(normDate(''), '', '空值');
eq(fmtCNDate('2026-10-05'), '2026年10月5日（星期一）', '中文組版含星期');

/* ── fixture ── */
const in1 = [];
in1[0] = ['活動/訓練班名稱', '測試攝影班'];
in1[3] = ['屆別', 2, '屆'];
in1[4] = ['支部', '童軍'];
in1[5] = ['專章', '興趣 - 攝影'];
in1[7] = ['形式-1', '訓練班'];
in1[10] = ['預計收生人數', 24, '名'];
in1[11] = ['預計收費', 60, '元'];
in1[12] = ['職員人數', 6, '人'];

const in2 = [];
in2[0] = ['活動/訓練班名稱', '測試攝影班'];
in2[3] = ['名額', 24, '名'];
in2[4] = ['預計收費', 60, '元'];
in2[5] = ['職員人數', 6, '人'];
in2[8] = ['', '2026-10-17', false, '1930 - 2130', '筲箕灣區總部', '', '2026年10月17日（星期六）', true, '2026年10月17日（星期六）', '下午7:30-9:30', '筲箕灣區總部'];
in2[9] = ['', '2026-10-24', false, '1930 - 2130', '筲箕灣區總部', '', '', false, '', '', ''];
in2[17] = ['截止報名日期', '2026-10-04T16:00:00.000Z'];
in2[18] = ['最遲公佈取錄名單日', '2026-10-08'];
in2[22] = ['班領導人', '陳大文', '先生', '筲箕灣區', '木章', '91234567', 'd@x.hk'];

const resp = [RESP_HEADERS.slice()];
{
  const r = new Array(44).fill('');
  r[RC['時間戳記'] - 1] = '2026-09-20T08:15:00.000Z';
  r[RC['中文姓名'] - 1] = '王小明';
  r[RC['旅團'] - 1] = '港島第82旅';
  r[RC['旅號'] - 1] = '82';   /* GAS dump 回公式計算值 */
  r[RC['已核對收款'] - 1] = '✔'; r[RC['核對人'] - 1] = '區會財務'; r[RC['核對時間'] - 1] = '2026-09-26T01:00:00.000Z';
  r[RC['已交表格正本（STA）'] - 1] = '✔'; r[RC['收表記錄'] - 1] = '陳大文 2026-10-17 19:35';
  r[RC['審批狀態'] - 1] = 'approved';
  r[RC['學員編號'] - 1] = 1;
  r[RC['分組'] - 1] = '第一組';
  resp.push(r);
  const r2 = new Array(44).fill('');
  r2[RC['時間戳記'] - 1] = '2026-09-21T09:00:00.000Z';
  r2[RC['中文姓名'] - 1] = '李嘉俊';
  r2[RC['旅團'] - 1] = '東九龍第54旅';
  r2[RC['接納'] - 1] = '';
  resp.push(r2);
}

const notice = [];
notice[11] = ['', '', '', '', '', '', '檔案編號: 2627'];
notice[14] = ['測試攝影班'];
notice[22] = ['', '參加資格：', '已宣誓成員'];
notice[23] = ['', '費 用：', 'HK$60'];
notice[30] = ['', '服 裝：', '整齊制服'];
notice[42] = ['', '', '', '', '陳大文'];

/* 出席表 grid（coursev5 數碼版式；2 節） */
const att = [];
att[3] = ['', '', '', '', '2026-10-17', '2026-10-24'];           /* R4 日期 */
att[4] = ['分組', '學員編號', '中文姓名', '英文姓名'];               /* R5 表頭 */
att[5] = ['第一組', 1, '王小明', 'Wong Siu Ming', '✔', '遲'];      /* R6 學員 */
att[27] = ['職員出席（服務時數自動計）'];                           /* R28 職員區標記 */
att[28] = ['職位', '姓名', '稱謂'];                                /* R29 表頭 */
att[29] = ['班領導人', '陳大文', '先生', '', '✔', ''];             /* R30 職員 */

/* 完成報告／領取證書 grid（coursev5 版式） */
const comp = [];
comp[8] = ['學員編號', '中文姓名', '旅號', '證書編號', '合格與否', '不合格原因'];   /* R9 表頭 */
comp[9] = [1, '王小明', '82', 'SPG-2026-001', '合格', ''];                     /* R10 */
comp[10] = [2, '李嘉俊', '54', '', '不合格', '出席率不足'];                    /* R11（未取錄→唔計） */

const certG = [];
certG[5] = ['', '學員編號', '中文姓名', '旅號', '證書編號', '領取日期', '簽收'];  /* R6 表頭 */
certG[6] = ['', 1, '王小明', '82', 'SPG-2026-001', '', ''];                   /* R7 未領取 */

/* Input03 時間表 grid（每節 10 行 block,R2 起） */
const in3 = [];
in3[1] = ['', '日期：', '2026-10-17', '', '地點：', '筲箕灣區總部'];
in3[2] = ['', '時間：', '1930 - 2130', '', '服裝：', '童軍制服'];
in3[4] = ['', '時 間', '需時（分鐘）', '項目', '負責人'];
in3[5] = ['', '1930', 5, '報到', '班務行政'];
in3[6] = ['', '1935', 45, '光圈實作', '陳大文'];
in3[11] = ['', '日期：', '2026-10-24', '', '地點：', '筲箕灣區總部'];

const raw = {
  input01: in1, input02: in2, input03: in3, input04: [],
  resp: resp, attend: att, completion: comp, cert: certG,
  paramsWX: [
    ['區會常數（唔好改名）', ''],
    ['區會批准', '✔'],
    ['訓練班電郵', 'course.test@skwscout.org.hk'],
    ['成員系統報名網址', 'https://portal.test/training'],
    ['FPS 識別碼', '102866183'],
    ['FPS 戶口名稱', 'SAHK SKW'],
    ['區會網址', 'www.skwscout.org.hk'],
  ],
  notice: notice,
  rev: 7, revBy: '陳大文', revSavedAt: '2026-09-25T10:00:00.000Z', pulledAt: '2026-09-26T10:00:00.000Z',
};

section('parseAll');
const p = parseAll(raw);
eq(p.info.name, '測試攝影班', '課程名');
eq(p.info.quota, 24, '名額');
eq(p.info.fee, 60, '收費');
eq(p.info.deadline, '2026-10-05', '截止日（ISO→HK）');
eq(p.sessions.length, 2, '節次數');
ok(p.sessions[0].onNotice === true, '節次1 ✓上通告');
ok(p.sessions[1].onNotice === false, '節次2 唔上通告');
eq(p.staff.length, 1, '職員數');
eq(p.leader.name, '陳大文', '班領導人');
eq(p.regs.length, 2, '報名數');
eq(p.regs[0].status, 'approved', '狀態=approved');
eq(p.regs[0].troopNo, '82', '旅號（公式值）');
ok(p.regs[0].pcheck, '已核對收款 ✔');
ok(p.regs[0].pcBy === '區會財務', '核對人');
ok(p.regs[0].sta, 'STA 正本已交');
ok(p.regs[1].pcheck === false, '第二筆未核對收款 → false');
section('掛載狀態 parseParamsWX');
ok(p.params.approved === true, '區會批准 ✔');
ok(p.params.courseEmail === 'course.test@skwscout.org.hk', '訓練班電郵（管理層告知）');

section('時間表 parseInput03');
eq(p.input03.blocks.length, 2, '兩個有料 block');
eq(p.input03.blocks[0].date, '2026-10-17', 'block1 日期');
eq(p.input03.blocks[0].time, '1930 - 2130', 'block1 時間');
eq(p.input03.blocks[0].dress, '童軍制服', 'block1 服裝');
eq(p.input03.blocks[0].items.length, 2, 'block1 兩個項目');
eq(p.input03.blocks[0].items[1].mins, 45, 'block1 項目2 需時');
eq(p.input03.blocks[1].date, '2026-10-24', 'block2 日期');
eq(p.input03.blocks[1].items.length, 0, 'block2 冇項目');

section('完成報告 parseCompletion');
eq(p.completion.decided, 1, '已評核 1（李嘉俊未取錄唔計）');
ok(p.completion.byStudent[p.regs[0].id].pass === true, '王小明合格');
eq(p.completion.byStudent[p.regs[0].id].certNo, 'SPG-2026-001', '證書編號');
eq(p.completion.byStudent[p.regs[0].id].row, 10, '行號 R10');
ok(!p.completion.byStudent[p.regs[1].id], '李嘉俊未有評核');
section('領取證書 parseCert');
eq(p.cert.byStudent[p.regs[0].id].certNo, 'SPG-2026-001', '證書編號');
eq(p.cert.byStudent[p.regs[0].id].pickupDate, '', '未領取');
eq(p.cert.byStudent[p.regs[0].id].row, 7, '行號 R7');

section('出席表 parseAttend');
ok(p.attend.initialized, '出席表已初始化');
ok(p.attend.stale === false, '名單齊（唔 stale）');
eq(p.attend.byStudent[p.regs[0].id], ['✔', '遲'], '王小明兩節剔號');
eq(p.attend.byStaff['陳大文'], ['✔', ''], '陳大文第1節簽到');
eq(p.regs[1].status, 'pending', '無狀態→pending');
eq(p.stats.pending, 1, '統計：待批 1');
eq(p.rev, 7, 'rev');

section('通告組版');
const doc = composeNoticeDoc((tab, r, c) => shCell(tab === TAB.IN1 ? in1 : tab === TAB.IN2 ? in2 : notice, r, c), p.params);
eq(doc.title, '測試攝影班', '標題');
eq(doc.quotaText, '24人', '名額');
eq(doc.deadlineText, '2026年10月5日（星期一）', '截止中文');
eq(doc.sessions.length, 1, '通告只列 ✓上通告 嘅節次');
eq(doc.sessions[0].date, '2026年10月17日（星期六）', '通告顯示日期');
ok(doc.payText.indexOf('102866183') >= 0, 'FPS 識別碼入文');
ok(doc.signupText.indexOf('https://portal.test/training') >= 0, '成員系統網址入文');
eq(doc.leaderText, '陳大文先生（木章）', '班領導人行');
ok(doc.enquiry.indexOf('course.test@skwscout.org.hk') >= 0, '查詢行用訓練班電郵（管理層告知）優先');
ok(doc.enquiry.indexOf('d@x.hk') < 0, '有訓練班電郵就唔用班領導人電郵');
ok(doc.enquiry.indexOf('91234567') >= 0, '查詢行含電話');
/* 冇訓練班電郵 → fallback 班領導人電郵 */
const pNoEmail = JSON.parse(JSON.stringify(p));
pNoEmail.params.courseEmail = '';
const doc2 = composeNoticeDoc((tab, r, c) => shCell(tab === TAB.IN1 ? in1 : tab === TAB.IN2 ? in2 : notice, r, c), pNoEmail.params);
ok(doc2.enquiry.indexOf('d@x.hk') >= 0, '冇訓練班電郵 → 用班領導人電郵');

/* 空值防呆 */
section('空表防呆');
const empty = parseAll({});
eq(empty.regs.length, 0, '空 resp');
eq(empty.sessions.length, 0, '空節次');
eq(empty.stats.total, 0, '空統計');
done();
