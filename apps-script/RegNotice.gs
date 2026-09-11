/*************************************************************
 * coursev5 · RegNotice 模組（v5.2.0）
 * CL 喺訓練班 App 發出「接納／不接納通知書」；區管理系統不接觸參加者。
 *
 * 安裝：
 *   1. GAS 專案新增檔案 RegNotice.gs，貼入本檔
 *   2. doPost 分發處（驗 apiKey 之後）加一行：
 *        case 'sendRegNotice': return doSendRegNotice_(msg);
 *   3. roster／intake 頁撳「發出接納及不接納通知書」
 *
 * action: sendRegNotice { apiKey, ids?:[時間戳記], by? }
 * - ids 留空＝全部已決定（approved/rejected）而未寄通知書嘅報名
 * - ReplyTo＝參數「訓練班電郵」；未填則 fallback 班領導人電郵
 * - 寄出後寫「表格回應」AZ/BA＝通知書／通知書寄出時間，避免重寄
 *************************************************************/

var RN5 = {
  RESP: '表格回應', IN2: 'Input02 班資料', IN2_ALT: 'Input02 訓練班資料', PARAM: '參數', ACCEPT: 'Print_接納通知書',
  COL_ID: 1, COL_EMAIL: 2, COL_NAME: 3, COL_ACCEPT: 29, COL_STATUS: 37,
  COL_NOTICE: 52, COL_NOTICE_AT: 53
};

function doSendRegNotice_(msg) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(RN5.RESP);
  if (!sh) return rn5Out_({ ok: false, error: '找不到「表格回應」分頁' });
  rn5EnsureHeaders_(sh);

  var info = rn5CourseInfo_(ss);
  var replyTo = rn5Param_(ss, '訓練班電郵') || (info.leader && info.leader.email) || '';
  if (!replyTo) return rn5Out_({ ok: false, error: '未設定訓練班電郵／班領導人電郵，未能寄出通知書' });

  var ids = {};
  if (msg && Array.isArray(msg.ids)) {
    msg.ids.forEach(function (x) { var s = String(x || '').trim(); if (s) ids[s] = true; });
  }
  var hasFilter = Object.keys(ids).length > 0;

  var last = sh.getLastRow();
  if (last < 2) return rn5Out_({ ok: true, data: { sent: 0, skipped: 0, failed: 0, results: [] } });
  var width = Math.max(sh.getLastColumn(), RN5.COL_NOTICE_AT);
  var values = sh.getRange(1, 1, last, width).getValues();
  var headers = values[0].map(function (x) { return String(x || '').trim(); });
  var hmap = rn5HeaderMap_(headers);

  var sent = 0, skipped = 0, failed = 0, results = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var id = String(row[RN5.COL_ID - 1] || '').trim();
    if (!id || (hasFilter && !ids[id])) continue;
    var name = rn5Cell_(row, hmap, '中文姓名') || String(row[RN5.COL_NAME - 1] || '').trim() || '申請人';
    var email = rn5Cell_(row, hmap, '電郵地址') || String(row[RN5.COL_EMAIL - 1] || '').trim();
    var status = rn5Status_(row);
    if (status !== 'approved' && status !== 'rejected') { skipped++; results.push({ id: id, skipped: true, reason: '未有接納／不接納決定' }); continue; }
    if (String(row[RN5.COL_NOTICE - 1] || '').trim()) { skipped++; results.push({ id: id, skipped: true, reason: '已寄過通知書' }); continue; }
    if (!email) { failed++; results.push({ id: id, ok: false, error: '沒有申請人電郵' }); continue; }

    var kind = status === 'approved' ? 'accepted' : 'rejected';
    var mail = rn5BuildMail_(kind, name, info, replyTo);
    try {
      MailApp.sendEmail({
        to: email,
        replyTo: replyTo,
        cc: info.leader && info.leader.email && info.leader.email !== replyTo ? info.leader.email : '',
        name: info.courseName || '筲箕灣區訓練班',
        subject: mail.subject,
        body: mail.body
      });
      var at = new Date();
      sh.getRange(i + 1, RN5.COL_NOTICE).setValue(kind);
      sh.getRange(i + 1, RN5.COL_NOTICE_AT).setValue(at);
      sent++;
      results.push({ id: id, ok: true, kind: kind });
    } catch (e) {
      failed++;
      results.push({ id: id, ok: false, error: String(e && e.message ? e.message : e) });
    }
  }
  return rn5Out_({ ok: failed === 0, data: { sent: sent, skipped: skipped, failed: failed, results: results } });
}

function rn5EnsureHeaders_(sh) {
  if (String(sh.getRange(1, 50).getDisplayValue() || '').trim() === '') {
    sh.getRange(1, 50, 1, 4).setValues([['已退款', '退款核對人', '通知書', '通知書寄出時間']]);
  } else {
    if (String(sh.getRange(1, RN5.COL_NOTICE).getDisplayValue() || '').trim() === '') sh.getRange(1, RN5.COL_NOTICE).setValue('通知書');
    if (String(sh.getRange(1, RN5.COL_NOTICE_AT).getDisplayValue() || '').trim() === '') sh.getRange(1, RN5.COL_NOTICE_AT).setValue('通知書寄出時間');
  }
}

function rn5HeaderMap_(headers) {
  var m = {};
  headers.forEach(function (h, i) { if (h) m[h] = i; });
  return m;
}
function rn5Cell_(row, hmap, h) {
  return hmap[h] == null ? '' : String(row[hmap[h]] || '').trim();
}
function rn5Status_(row) {
  var s = String(row[RN5.COL_STATUS - 1] || '').trim().toLowerCase();
  if (!s) s = row[RN5.COL_ACCEPT - 1] === '✔' ? 'approved' : (row[RN5.COL_ACCEPT - 1] === '✗' ? 'rejected' : 'pending');
  return s;
}
function rn5Param_(ss, label) {
  var sh = ss.getSheetByName(RN5.PARAM);
  if (!sh || sh.getLastRow() < 1) return '';
  var vals = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim().indexOf(label) >= 0) return String(vals[i][1] || '').trim();
  }
  return '';
}
function rn5CourseInfo_(ss) {
  var sh = ss.getSheetByName(RN5.IN2) || ss.getSheetByName(RN5.IN2_ALT);
  var out = { courseName: '', sessions: [], report: '', bring: '', other: '', remarks: '', leader: null };
  if (!sh) return out;
  out.courseName = String(sh.getRange(1, 2).getDisplayValue() || '').trim();
  var vals = sh.getRange(9, 1, 34, 11).getDisplayValues();
  for (var i = 0; i < 8; i++) {
    var r = vals[i];
    var on = String(r[7] || '').toUpperCase();
    if (on !== 'TRUE' && on !== '✔' && on !== '✓') continue;
    out.sessions.push({ date: r[8] || r[6] || r[1], time: r[9] || r[3], venue: r[10] || r[4] });
  }
  var ash = ss.getSheetByName(RN5.ACCEPT);
  if (ash) {
    out.report = String(ash.getRange(23, 2).getDisplayValue() || '').trim();
    out.bring = String(ash.getRange(30, 2).getDisplayValue() || '').trim();
    out.other = String(ash.getRange(32, 2).getDisplayValue() || '').trim();
    out.remarks = String(ash.getRange(34, 2).getDisplayValue() || '').trim();
  }
  for (var r0 = 23; r0 <= 42; r0++) {
    var role = String(sh.getRange(r0, 1).getDisplayValue() || '').trim();
    var name = String(sh.getRange(r0, 2).getDisplayValue() || '').trim();
    if (role === '班領導人' || (!out.leader && name)) {
      out.leader = {
        role: role, name: name,
        title: String(sh.getRange(r0, 3).getDisplayValue() || '').trim(),
        phone: String(sh.getRange(r0, 6).getDisplayValue() || '').trim(),
        email: String(sh.getRange(r0, 7).getDisplayValue() || '').trim()
      };
      if (role === '班領導人') break;
    }
  }
  return out;
}
function rn5BuildMail_(kind, name, info, replyTo) {
  var title = info.courseName || '訓練班';
  var leaderName = info.leader ? (info.leader.name + (info.leader.title || '')) : '班領導人';
  if (kind === 'accepted') {
    var lines = [];
    lines.push(name + '：');
    lines.push('');
    lines.push('閣下報名參加「' + title + '」已獲接納。');
    lines.push('');
    if (info.sessions.length) {
      lines.push('訓練班資料：');
      info.sessions.forEach(function (s, i) { lines.push((i + 1) + '. ' + [s.date, s.time, s.venue].filter(Boolean).join('　')); });
      lines.push('');
    }
    if (info.report) lines.push('報到安排：' + info.report);
    if (info.bring) lines.push('攜帶物品：' + info.bring);
    if (info.other) lines.push('其他事項：' + info.other);
    if (info.remarks) lines.push('備註：' + info.remarks);
    lines.push('');
    lines.push('如有查詢，請直接回覆本電郵（' + replyTo + '）。');
    lines.push('');
    lines.push(leaderName);
    return { subject: '【接納通知】' + title, body: lines.join('\n') };
  }
  return {
    subject: '【不接納通知】' + title,
    body: [
      name + '：', '',
      '多謝閣下報名參加「' + title + '」。因名額所限／訓練班安排所需，閣下今次未能獲接納。', '',
      '如已繳交訓練班費用，區會將按既定程序辦理退款。歡迎日後再次報名參加本區訓練班。', '',
      '如有查詢，請直接回覆本電郵（' + replyTo + '）。', '',
      leaderName
    ].join('\n')
  };
}
function rn5Out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
