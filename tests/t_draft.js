/* t_draft.js — 草稿引擎：加入/撤銷/合併/衝突/儲存 payload */
'use strict';
const { makeCtx, load, val, ok, eq, section, done } = require('./harness');
const ctx = makeCtx();
load(ctx, ['js/00-config.js', 'js/30-parse.js', 'js/20-store.js']);
const { RESP_HEADERS, RC, TAB, Store } = val(ctx, '({ RESP_HEADERS, RC, TAB, Store })');

const in1 = [];
in1[11] = ['預計收費', 60, '元'];

function respWith(group1) {
  const resp = [RESP_HEADERS.slice()];
  const r = new Array(44).fill('');
  r[RC['時間戳記'] - 1] = '2026-09-20T08:15:00.000Z';
  r[RC['中文姓名'] - 1] = '王小明';
  r[RC['旅團'] - 1] = '港島第82旅';
  r[RC['分組'] - 1] = group1 || '';
  resp.push(r);
  return resp;
}
const raw0 = { input01: in1, input02: [], input03: [], input04: [], resp: respWith(''), paramsWX: [], notice: [], rev: 3, revBy: '', revSavedAt: '' };

Store.init();
Store.addCourse({ exec: 'https://x/exec', key: 'k1', name: 'T' });
Store.config.activeId = Store.courses()[0].id; Store.saveConfig();   /* 同 UI 連線流程一致 */
Store.setActive(Store.config.activeId);
Store.applyRaw(raw0);

section('草稿基本');
eq(Store.snapshotCell(TAB.IN1, 12, 2), 60, '快照值');
Store.addCellDraft(TAB.IN1, 12, 2, 80, '預計收費');
eq(Store.draftCount(), 1, '1 項草稿');
eq(Store.effectiveCell(TAB.IN1, 12, 2), 80, '有效值=草稿');
Store.addCellDraft(TAB.IN1, 12, 2, 60, '預計收費');
eq(Store.draftCount(), 0, '改返原值=自動撤銷草稿');

const reg = Store.state.regs[0];
Store.addRegDraft(reg, '分組', '第一組', '王小明 分組');
eq(Store.draftCount(), 1, 'reg 草稿');
eq(Store.effectiveRegValue(reg, '分組'), '第一組', 'reg 有效值');

section('payload 對位');
const built = Store.buildCellsPayload(Store.drafts());
eq(built.cells.length, 1, '1 格');
eq(built.cells[0].tab, TAB.RESP, 'tab=表格回應');
eq(built.cells[0].row, 2, '行號=快照行（報名第 1 筆 → sheet 第 2 行）');
eq(built.cells[0].col, RC['分組'], '欄=分組欄（AJ）');

section('體檢：對方做咗同樣改動 → drop');
Store.applyRaw(Object.assign({}, raw0, { resp: respWith('第一組'), rev: 4 }));
const r1 = Store.resolveAgainstFresh();
eq(r1.drop.length, 1, '同值 → drop');
eq(r1.conflict.length, 0, '冇衝突');

section('體檢：對方改咗第個值 → conflict');
Store.applyRaw(Object.assign({}, raw0, { resp: respWith('第二組'), rev: 5 }));
const r2 = Store.resolveAgainstFresh();
eq(r2.conflict.length, 1, '撞格 → conflict');
eq(r2.keep.length, 0, '冇得 keep');
ok(String(r2.conflict[0].conflictInfo).indexOf('第二組') >= 0, '衝突訊息含對方值');

section('體檢：對方改咗其他嘢 → keep');
Store.applyRaw(Object.assign({}, raw0, { resp: respWith(''), rev: 6 }));
const r3 = Store.resolveAgainstFresh();
eq(r3.keep.length, 1, '快照未變 → keep');
const built2 = Store.buildCellsPayload(r3.keep);
eq(built2.cells[0].value, '第一組', 'keep 草稿照寫');

section('報名被刪 → conflict');
Store.applyRaw({ input01: in1, input02: [], input03: [], input04: [], resp: [RESP_HEADERS.slice()], paramsWX: [], notice: [], rev: 7 });
const r4 = Store.resolveAgainstFresh();
eq(r4.conflict.length, 1, '搵唔到報名 → conflict');

section('草稿持久化');
Store.loadDrafts();
ok(Store.draftCount() >= 1, 'reload 後草稿仲喺');
done();
