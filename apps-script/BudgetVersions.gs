/*************************************************************
 * coursev5 · BudgetVersions 模組（v5.2.0）
 * 同一張訓練班 Sheet 內做 Budget V1/V2 版本與批核。
 *
 * 原則：
 * - V1：CL 開班填完初版 Budget，管理層可直接批。
 * - V2+：正常係收生後因實際人數太多／太少而再提交。
 * - 收支表／正式執行預算以「最新已批准版本」為準。
 * - 管理層 approve 後會把該版本 snapshot 寫回 Input01，令 Print_財政預算／收支表自動更新。
 *
 * 安裝路由：
 *   case 'submitBudgetVersion':  return doSubmitBudgetVersion_(msg);
 *   case 'listBudgetVersions':    return doListBudgetVersions_(msg);
 *   case 'approveBudgetVersion':  return doApproveBudgetVersion_(msg);
 *************************************************************/

var BV5 = {
  SHEET: '_BudgetVersions', IN1: 'Input01 預算', PARAM: '參數',
  HEAD: ['version', 'status', 'createdAt', 'submittedAt', 'submittedBy', 'approvedAt', 'approvedBy', 'reason', 'snapshot']
};

function doSubmitBudgetVersion_(msg) {
  var ss = SpreadsheetApp.getActive();
  var in1 = ss.getSheetByName(BV5.IN1) || ss.getSheetByName('Input01 訓練班預算');
  if (!in1) return bv5Out_({ ok: false, error: '找不到 Input01 預算分頁' });
  var sh = bv5Sheet_(ss);
  var rows = bv5Rows_(sh);
  var maxV = 0;
  rows.forEach(function (r) { maxV = Math.max(maxV, Number(r.version) || 0); });
  var v = maxV + 1;
  var snap = bv5Snapshot_(in1, v, msg && msg.reason);
  sh.appendRow([v, 'pending', new Date(), new Date(), String((msg && msg.by) || ''), '', '', String((msg && msg.reason) || ''), JSON.stringify(snap)]);
  return bv5Out_({ ok: true, data: { version: v, status: 'pending', snapshot: snap } });
}

function doListBudgetVersions_(msg) {
  var ss = SpreadsheetApp.getActive();
  var sh = bv5Sheet_(ss);
  return bv5Out_({ ok: true, data: { versions: bv5Rows_(sh), currentApproved: bv5CurrentApproved_(sh) } });
}

function doApproveBudgetVersion_(msg) {
  var ss = SpreadsheetApp.getActive();
  var sh = bv5Sheet_(ss);
  var version = Number(msg && msg.version);
  if (!version) return bv5Out_({ ok: false, error: 'missing version' });
  var last = sh.getLastRow();
  if (last < 2) return bv5Out_({ ok: false, error: '未有 Budget 版本' });
  var vals = sh.getRange(2, 1, last - 1, BV5.HEAD.length).getValues();
  var targetIdx = -1, targetSnap = null;
  for (var i = 0; i < vals.length; i++) {
    if (Number(vals[i][0]) === version) {
      targetIdx = i;
      try { targetSnap = JSON.parse(vals[i][8] || '{}'); } catch (e) { targetSnap = null; }
      break;
    }
  }
  if (targetIdx < 0 || !targetSnap || !targetSnap.values) return bv5Out_({ ok: false, error: '找不到 Budget V' + version + ' snapshot' });

  var now = new Date();
  var by = String((msg && msg.by) || '');
  for (var j = 0; j < vals.length; j++) {
    var rowNo = j + 2;
    var v = Number(vals[j][0]);
    if (v === version) {
      sh.getRange(rowNo, 2).setValue('approved');
      sh.getRange(rowNo, 6).setValue(now);
      sh.getRange(rowNo, 7).setValue(by);
    } else if (String(vals[j][1]).trim() === 'approved') {
      sh.getRange(rowNo, 2).setValue('superseded');
    }
  }

  var in1 = ss.getSheetByName(BV5.IN1) || ss.getSheetByName('Input01 訓練班預算');
  if (!in1) return bv5Out_({ ok: false, error: '找不到 Input01 預算分頁' });
  var values = targetSnap.values;
  in1.getRange(1, 1, values.length, values[0].length).setValues(values);
  bv5SetParam_(ss, '目前批准Budget版本', 'V' + version);
  bv5SetParam_(ss, 'Budget批准時間', now);
  bv5SetParam_(ss, 'Budget批准人', by);
  return bv5Out_({ ok: true, data: { approved: true, version: version, appliedToInput01: true } });
}

function bv5Sheet_(ss) {
  var sh = ss.getSheetByName(BV5.SHEET);
  if (!sh) {
    sh = ss.insertSheet(BV5.SHEET);
    sh.hideSheet();
  }
  if (sh.getLastRow() < 1 || String(sh.getRange(1, 1).getDisplayValue() || '').trim() !== BV5.HEAD[0]) {
    sh.getRange(1, 1, 1, BV5.HEAD.length).setValues([BV5.HEAD]);
  }
  return sh;
}
function bv5Rows_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, BV5.HEAD.length).getValues();
  return vals.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    var snap = {};
    try { snap = JSON.parse(r[8] || '{}'); } catch (e) { snap = {}; }
    return { version: Number(r[0]), status: String(r[1] || ''), createdAt: r[2], submittedAt: r[3], submittedBy: r[4], approvedAt: r[5], approvedBy: r[6], reason: r[7], snapshot: snap };
  });
}
function bv5CurrentApproved_(sh) {
  var rows = bv5Rows_(sh).filter(function (r) { return r.status === 'approved'; });
  rows.sort(function (a, b) { return b.version - a.version; });
  return rows[0] || null;
}
function bv5Snapshot_(in1, version, reason) {
  var values = in1.getRange(1, 1, 110, 10).getValues();
  return { version: version, reason: String(reason || ''), capturedAt: new Date().toISOString(), range: 'A1:J110', values: values };
}
function bv5SetParam_(ss, label, value) {
  var sh = ss.getSheetByName(BV5.PARAM);
  if (!sh) return;
  var last = Math.max(1, sh.getLastRow());
  var vals = sh.getRange(1, 1, last, 2).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() === label) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.getRange(last + 1, 1, 1, 2).setValues([[label, value]]);
}
function bv5Out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
