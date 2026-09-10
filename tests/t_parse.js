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

const raw = {
  input01: in1, input02: in2, input03: [], input04: [],
  resp: resp,
  paramsWX: [
    ['區會常數（唔好改名）', ''],
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
ok(doc.enquiry.indexOf('d@x.hk') >= 0 && doc.enquiry.indexOf('91234567') >= 0, '查詢行含電郵電話');

/* 空值防呆 */
section('空表防呆');
const empty = parseAll({});
eq(empty.regs.length, 0, '空 resp');
eq(empty.sessions.length, 0, '空節次');
eq(empty.stats.total, 0, '空統計');
done();
