/*************************************************************
 * coursev5 · Summary 模組（getCourseSummary）
 * 區管理系統（scout-district-portal）批核用——管理層只睇最重要嘅資料，
 * 一個 call 攞齊：課程資料・節次・職員・預算 8 大類・通告要點
 * （檔案編號/訓練班電郵）・批准狀態・報名數。
 *
 * 安裝：
 *   1. GAS 專案新增檔案 Summary.gs，貼入本檔
 *   2. doPost 分發處（驗 apiKey 之後）加一行：
 *        case 'getCourseSummary': return doGetCourseSummary_(msg);
 *   3. 重新部署
 *
 * action: getCourseSummary { apiKey }
 * 純讀；唔驗 rev、唔 bump rev。
 * 座標同前端 js/00-config.js（v4.13.0 模版）完全一致。
 *************************************************************/

var SM5 = {
  IN1: 'Input01 預算', IN1_ALT: 'Input01 訓練班預算', IN2: 'Input02 班資料', IN2_ALT: 'Input02 訓練班資料', NOTICE: 'Print_通告', PARAM: '參數', RESP: '表格回應',
  IN1_NAME: [1, 2], IN1_EDITION: [4, 2], IN1_SECTION: [5, 2], IN1_BADGE: [6, 2],
  IN1_CUSTOM: [7, 2], IN1_TYPE1: [8, 2], IN1_TYPE2: [9, 2],
  IN1_INTAKE: [11, 2], IN1_FEE: [12, 2], IN1_STAFF: [13, 2],
  MEALS: { rows: [32, 33, 34, 35, 36, 37, 38, 39], per: [5, 6, 7, 8, 9], who: 10 },
  RENT: { rows: [47, 48, 49], qty: 6, price: 8 },
  RENT_EXTRA: { rows: [48, 49, 50], amount: 8 },
  CAMP_LODGE: { rows: [54, 55, 56, 62, 63, 64], nights: 6, people: 7, price: 8 },
  TRANSPORT: { rows: [69, 70, 71, 72, 73, 74], budget: 8 },
  QTY_PRICE: [
    { key: 'handouts', label: '4. 講義及快勞', rows: [79, 80, 81], mapTo: ['H'] },
    { key: 'programme', label: '5. 節目', rows: [85, 86, 87], mapTo: ['I'] },
    { key: 'admin', label: '6. 行政', rows: [91, 92, 93], mapTo: ['G'] },
    { key: 'souvenir', label: '7. 紀念品', rows: [97, 98], mapTo: ['I'] },
  ],
  QTY: 7, PRICE: 8,
  MISC: { rows: [102, 103, 104], amount: 5 },
  IN2_QUOTA: [4, 2], IN2_FEE: [5, 2],
  IN2_DEADLINE: [18, 2], IN2_PUBLISH: [19, 2],
  SESS: { rows: [9, 10, 11, 12, 13, 14, 15, 16], date: 2, time: 4, venue: 5, onNotice: 8 },
  STAFF: { rows: [23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42],
    role: 1, name: 2, title: 3, phone: 6, email: 7 },
  N_FILENO: [12, 7], N_ISSUE: [13, 7], N_ELIG: [23, 3], N_FEE: [24, 3], N_UNIFORM: [31, 3]
};

function doGetCourseSummary_(msg) {
  var ss = SpreadsheetApp.getActive();
  var in1 = ss.getSheetByName(SM5.IN1) || ss.getSheetByName(SM5.IN1_ALT);
  var in2 = ss.getSheetByName(SM5.IN2) || ss.getSheetByName(SM5.IN2_ALT);
  if (!in1 || !in2) return sm5Out_({ ok: false, error: '找不到 Input01/Input02 分頁' });

  var g1 = in1.getRange(1, 1, Math.max(in1.getLastRow(), 120), 10).getValues();
  var g2 = in2.getRange(1, 1, Math.max(in2.getLastRow(), 50), 11).getValues();
  var num = function (g, r, c) {
    var v = g[r - 1] ? g[r - 1][c - 1] : '';
    if (v instanceof Date) return 0;
    var n = Number(String(v == null ? '' : v).replace(/[$,]/g, ''));
    return isFinite(n) ? n : 0;
  };
  var txt = function (g, rc) { return String((g[rc[0] - 1] || [])[rc[1] - 1] || '').trim(); };

  /* 節次（Input02 列 9–16） */
  var sessions = [];
  SM5.SESS.rows.forEach(function (r) {
    var d = sm5NormDate_(g2[r - 1] ? g2[r - 1][SM5.SESS.date - 1] : '');
    var t = String((g2[r - 1] || [])[SM5.SESS.time - 1] || '').trim();
    if (!d && !t) return;
    sessions.push({
      date: d, time: t,
      venue: String((g2[r - 1] || [])[SM5.SESS.venue - 1] || '').trim(),
      onNotice: String((g2[r - 1] || [])[SM5.SESS.onNotice - 1] || '').trim() !== '',
    });
  });

  /* 職員表（列 23–42）；班領導人＝第一個 role「班領導人」 */
  var staff = [], leader = null;
  SM5.STAFF.rows.forEach(function (r) {
    var row = g2[r - 1] || [];
    var role = String(row[SM5.STAFF.role - 1] || '').trim();
    var name = String(row[SM5.STAFF.name - 1] || '').trim();
    if (!role || !name) return;
    var s = { role: role, name: name, title: String(row[SM5.STAFF.title - 1] || '').trim() };
    staff.push(s);
    if (!leader && role === '班領導人') {
      leader = { name: name, title: s.title,
        phone: String(row[SM5.STAFF.phone - 1] || '').trim(),
        email: String(row[SM5.STAFF.email - 1] || '').trim() };
    }
  });

  /* 預算 8 大類——同前端 budgetSummary（js/30-parse.js）完全等效 */
  var intakeN = num(g1, SM5.IN1_INTAKE[0], SM5.IN1_INTAKE[1]);
  var staffN = num(g1, SM5.IN1_STAFF[0], SM5.IN1_STAFF[1]);
  var sections = [], total = 0;
  var sec = function (key, label, mapTo, v) {
    sections.push({ key: key, label: label, mapTo: mapTo, budget: Math.round(v * 100) / 100 });
    total += v;
  };
  var v = 0;
  SM5.MEALS.rows.forEach(function (r) {
    var per = 0;
    SM5.MEALS.per.forEach(function (c) { per += num(g1, r, c); });
    if (!per) return;
    var who = String((g1[r - 1] || [])[SM5.MEALS.who - 1] || '');
    v += per * (who.indexOf('職員') >= 0 ? staffN : intakeN);
  });
  sec('meal', '1. 膳食', ['B', 'C', 'D'], v);

  v = 0;
  SM5.RENT.rows.forEach(function (r) {
    var q = num(g1, r, SM5.RENT.qty), p = num(g1, r, SM5.RENT.price);
    if (q && p) v += q * p;
  });
  SM5.RENT_EXTRA.rows.forEach(function (r) { if (!num(g1, r, SM5.RENT.qty)) v += num(g1, r, SM5.RENT_EXTRA.amount); });
  SM5.CAMP_LODGE.rows.forEach(function (r) {
    var n2 = num(g1, r, SM5.CAMP_LODGE.nights), pp = num(g1, r, SM5.CAMP_LODGE.people), pr = num(g1, r, SM5.CAMP_LODGE.price);
    if (n2 && pp && pr) v += n2 * pp * pr;
  });
  sec('rent', '2. 租金（場租＋露營＋住宿）', ['E'], v);

  v = 0;
  SM5.TRANSPORT.rows.forEach(function (r) { v += num(g1, r, SM5.TRANSPORT.budget); });
  sec('transport', '3. 交通', ['F'], v);

  SM5.QTY_PRICE.forEach(function (q) {
    v = 0;
    q.rows.forEach(function (r) { v += num(g1, r, SM5.QTY) * num(g1, r, SM5.PRICE); });
    sec(q.key, q.label, q.mapTo, v);
  });

  v = 0;
  SM5.MISC.rows.forEach(function (r) { v += num(g1, r, SM5.MISC.amount); });
  sec('misc', '8. 其他', ['I'], v);

  /* 通告要點 */
  var notice = { fileNo: '', issueDate: '', eligibility: '', feeNote: '', uniform: '' };
  var nsh = ss.getSheetByName(SM5.NOTICE);
  if (nsh) {
    var nv = nsh.getRange(SM5.N_FILENO[0], SM5.N_FILENO[1]).getValue();
    notice.fileNo = String(nv || '').trim();
    notice.issueDate = sm5NormDate_(nsh.getRange(SM5.N_ISSUE[0], SM5.N_ISSUE[1]).getValue());
    notice.eligibility = String(nsh.getRange(SM5.N_ELIG[0], SM5.N_ELIG[1]).getValue() || '').trim();
    notice.feeNote = String(nsh.getRange(SM5.N_FEE[0], SM5.N_FEE[1]).getValue() || '').trim();
    notice.uniform = String(nsh.getRange(SM5.N_UNIFORM[0], SM5.N_UNIFORM[1]).getValue() || '').trim();
  }

  /* 參數分頁（label 掃描——「區會批准」＋「訓練班電郵」） */
  var approved = false, courseEmail = '';
  var psh = ss.getSheetByName(SM5.PARAM);
  if (psh && psh.getLastRow() > 0) {
    psh.getRange(1, 1, psh.getLastRow(), 2).getValues().forEach(function (row) {
      var w = String(row[0] || '').trim(), x = String(row[1] || '').trim();
      if (w.indexOf('區會批准') >= 0) approved = (x === '✔' || x === '是' || x === 'TRUE');
      else if (w.indexOf('訓練班電郵') >= 0) courseEmail = x;
    });
  }

  /* 報名數（表格回應——掃第一欄有值嘅行，跳表頭；唔靠 getLastRow 免下方有統計公式） */
  var regCount = 0;
  var rsh = ss.getSheetByName(SM5.RESP);
  if (rsh && rsh.getLastRow() > 1) {
    rsh.getRange(2, 1, rsh.getLastRow() - 1, 1).getValues().forEach(function (c) {
      if (String(c[0] || '').trim() !== '') regCount++;
    });
  }

  return sm5Out_({
    ok: true, data: {
      courseName: txt(g1, SM5.IN1_NAME),
      edition: txt(g1, SM5.IN1_EDITION), section: txt(g1, SM5.IN1_SECTION),
      badge: txt(g1, SM5.IN1_BADGE), customName: txt(g1, SM5.IN1_CUSTOM),
      type1: txt(g1, SM5.IN1_TYPE1), type2: txt(g1, SM5.IN1_TYPE2),
      intake: num(g1, SM5.IN1_INTAKE[0], SM5.IN1_INTAKE[1]),
      fee: num(g2, SM5.IN2_FEE[0], SM5.IN2_FEE[1]) || num(g1, SM5.IN1_FEE[0], SM5.IN1_FEE[1]),
      quota: num(g2, SM5.IN2_QUOTA[0], SM5.IN2_QUOTA[1]),
      staffCount: staff.length,
      deadline: sm5NormDate_(txt(g2, SM5.IN2_DEADLINE)),
      publish: sm5NormDate_(txt(g2, SM5.IN2_PUBLISH)),
      sessions: sessions, leader: leader, staff: staff,
      budget: { sections: sections, total: Math.round(total * 100) / 100 },
      notice: notice, courseEmail: courseEmail, approved: approved, regCount: regCount,
      pulledAt: new Date().toISOString(),
    },
  });
}

function sm5Out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function sm5NormDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Hong_Kong', 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  var m = s.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  return s;
}
