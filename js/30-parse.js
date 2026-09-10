/* ============================================================
 * 30-parse.js — raw dump → 前端視圖（純函數，唔掂 DOM，可喺 node 測試）
 * 契約：getCourseSheetRaw 回傳各分頁二維陣列（GAS getValues 計算值）。
 * ============================================================ */

/* 1-based 讀格 */
function shCell(arr, r, c) {
  if (!Array.isArray(arr)) return '';
  const row = arr[r - 1];
  if (!row) return '';
  const v = row[c - 1];
  return v == null ? '' : v;
}

/* 值正規化（草稿比對用） */
function normVal(v) {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v).trim();
  if (s === '') return '';
  const d = normDate(s);
  return d !== s ? d : s;
}

/* 日期正規化 → 'yyyy-mm-dd'；收 ISO datetime（GAS Date）/ yyyy-mm-dd / d/m/yyyy / yyyy年m月d日 */
function normDate(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return String(v); // 序號唔當日期
  const s = String(v).trim();
  if (s === '') return '';
  // ISO datetime（GAS Date serialize）→ 轉香港時區先攞日期（避免快/慢一日）
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    try {
      const d = new Date(s);
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_INFO.tz, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(d);
    } catch (e) { return s.slice(0, 10); }
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]); if (y < 100) y += 2000;
    return y + '-' + pad2(m[2]) + '-' + pad2(m[1]);
  }
  m = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
  return s;
}
function pad2(n) { return ('0' + String(n)).slice(-2); }

const CN_WEEK = ['日', '一', '二', '三', '四', '五', '六'];
/* 'yyyy-mm-dd' → '2026年10月17日（星期六）'（同 Sheets TEXT …"aaaa"） */
function fmtCNDate(ymd) {
  if (!ymd) return '';
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(ymd);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return m[1] + '年' + Number(m[2]) + '月' + Number(m[3]) + '日（星期' + CN_WEEK[d.getUTCDay()] + '）';
}
function fmtShortDate(ymd) {
  if (!ymd) return '';
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(ymd);
  return Number(m[3]) + '/' + Number(m[2]) + '/' + m[1];
}

/* ── 參數 W/X（區會常數） ── */
function parseParamsWX(pw) {
  const out = { portalUrl: '', fpsId: '', fpsName: '', districtWeb: '', approved: false, noticeUrl: '' };
  if (!Array.isArray(pw)) return out;
  for (let i = 0; i < pw.length; i++) {
    const row = pw[i] || [];
    const w = String(row[0] == null ? '' : row[0]).trim();
    const x = String(row[1] == null ? '' : row[1]).trim();
    if (w.indexOf('成員系統') >= 0) out.portalUrl = x;
    else if (w.indexOf('FPS 識別碼') >= 0) out.fpsId = x;
    else if (w.indexOf('FPS 戶口') >= 0) out.fpsName = x;
    else if (w.indexOf('區會網址') >= 0) out.districtWeb = x;
    /* 掛載流程狀態（區管理層喺區管理系統寫,APP 只讀） */
    else if (w.indexOf('區會批准') >= 0) out.approved = x === '✔' || x === '是' || x === 'TRUE';
    else if (w.indexOf('通告網址') >= 0 || w.indexOf('通告 URL') >= 0) out.noticeUrl = x;
  }
  return out;
}

/* ── Input02 節次（列 9–16） ── */
function parseSessions(in2) {
  const out = [];
  if (!Array.isArray(in2)) return out;
  IN2_SESSIONS.rows.forEach((r, i) => {
    const date = normDate(shCell(in2, r, IN2_SESSIONS.date));
    if (!date) return;
    const dispDate = String(shCell(in2, r, IN2_SESSIONS.dispDate) || '').trim();
    out.push({
      idx: i, row: r,
      date,
      cross: shCell(in2, r, IN2_SESSIONS.cross) === true,
      time: String(shCell(in2, r, IN2_SESSIONS.time) || '').trim(),
      venue: String(shCell(in2, r, IN2_SESSIONS.venue) || '').trim(),
      autoCN: String(shCell(in2, r, IN2_SESSIONS.autoCN) || '').trim(),
      onNotice: shCell(in2, r, IN2_SESSIONS.onNotice) === true,
      dispDate, dispTime: String(shCell(in2, r, IN2_SESSIONS.dispTime) || '').trim(),
      dispVenue: String(shCell(in2, r, IN2_SESSIONS.dispVenue) || '').trim(),
    });
  });
  return out;
}

/* ── Input02 職員（列 23–42） ── */
function parseStaff(in2) {
  const out = [];
  if (!Array.isArray(in2)) return out;
  IN2_STAFF.rows.forEach((r) => {
    const role = String(shCell(in2, r, IN2_STAFF.role) || '').trim();
    const name = String(shCell(in2, r, IN2_STAFF.name) || '').trim();
    if (!role && !name) return;
    out.push({
      row: r, role, name,
      title: String(shCell(in2, r, IN2_STAFF.title) || '').trim(),
      unit: String(shCell(in2, r, IN2_STAFF.unit) || '').trim(),
      qual: String(shCell(in2, r, IN2_STAFF.qual) || '').trim(),
      phone: String(shCell(in2, r, IN2_STAFF.phone) || '').trim(),
      email: String(shCell(in2, r, IN2_STAFF.email) || '').trim(),
    });
  });
  return out;
}

/* ── 課程基本（Input02 優先，Input01 後備；黃格被覆蓋時以 Input02 為準） ── */
function parseCourseInfo(in1, in2) {
  const g = (tab, spec) => shCell(tab, spec.r, spec.c);
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && String(v).trim() !== '' ? n : ''; };
  return {
    name:      String(g(in2, IN2_CELLS.name) || g(in1, IN1_CELLS.name) || '').trim(),
    edition:   String(g(in1, IN1_CELLS.edition) || '').trim(),
    section:   String(g(in1, IN1_CELLS.section) || '').trim(),
    badge:     String(g(in1, IN1_CELLS.badge) || '').trim(),
    customName:String(g(in1, IN1_CELLS.customName) || '').trim(),
    type1:     String(g(in1, IN1_CELLS.type1) || '').trim(),
    type2:     String(g(in1, IN1_CELLS.type2) || '').trim(),
    intake:    num(g(in1, IN1_CELLS.intake)),
    fee:       num(g(in2, IN2_CELLS.fee) || g(in1, IN1_CELLS.fee)),
    staff:     num(g(in2, IN2_CELLS.staff) || g(in1, IN1_CELLS.staff)),
    quota:     num(g(in2, IN2_CELLS.quota)),
    deadline:  normDate(g(in2, IN2_DEADLINE)),
    publish:   normDate(g(in2, IN2_PUBLISH)),
    resident:  num(g(in2, IN2_RESIDENT)),
  };
}

/* ── 表格回應 → 報名清單 ── */
function parseRegs(resp) {
  const out = [];
  if (!Array.isArray(resp) || !resp.length) return out;
  const headers = resp[0].map(x => String(x == null ? '' : x).trim());
  for (let i = 1; i < resp.length; i++) {
    const r = resp[i];
    if (!r || r.join('') === '') continue;
    const o = { __row: i + 1 };
    headers.forEach((hd, j) => { o[hd] = r[j] == null ? '' : r[j]; });
    o.id = String(o['時間戳記']).trim();           // 原樣回傳俾 setRegStatus 對行
    let status = String(o['審批狀態'] || '').trim().toLowerCase();
    if (!status) status = o['接納'] === '✔' ? 'approved' : (o['接納'] === '✗' ? 'rejected' : 'pending');
    o.status = STATUS_INFO[status] ? status : 'pending';
    o.studentNo = o['學員編號'];                    // 公式計算值
    o.troopNo = String(o['旅號'] || '').trim();
    o.group = String(o['分組'] || '').trim();
    o.receiptUrl = String(o['已繳付訓練班費用截圖'] || '').trim();
    o.formUrl = String(o['已填妥之表格截圖(上課時需交回正本)'] || '').trim();
    o.refCode = String(o['_ref'] || '').trim();
    o.nameZh = String(o['中文姓名'] || '').trim();
    o.nameEn = String(o['英文姓名'] || '').trim();
    o.submittedAt = String(o['時間戳記'] || '').trim();
    o.reviewer = String(o['批核人'] || '').trim();
    o.reviewedAt = String(o['批核時間'] || '').trim();
    o.pcheck = String(o['已核對收款'] || '').trim() === '✔';   // 區管理系統核對區帳戶後 tick
    o.pcBy = String(o['核對人'] || '').trim();
    o.pcAt = String(o['核對時間'] || '').trim();
    o.sta = String(o['已交表格正本（STA）'] || '').trim() === '✔';   // 職員收表（報名表正本）
    o.staNote = String(o['收表記錄'] || '').trim();
    out.push(o);
  }
  return out;
}

/* ── Print_通告 可編欄現值 ── */
function parseNoticeEdits(notice) {
  const out = {};
  Object.keys(NOTICE_EDIT).forEach((k) => {
    const spec = NOTICE_EDIT[k];
    let v = shCell(notice, spec.r, spec.c);
    if (spec.type === 'date') v = normDate(v);
    out[k] = String(v == null ? '' : v).trim();
  });
  return out;
}

/* ── 收生統計 ── */
function regStats(regs, quota) {
  const s = { total: regs.length, pending: 0, approved: 0, rejected: 0, cancelled: 0, needReceipt: 0 };
  s.groupsInUse = false;
  regs.forEach((r) => {
    if (s[r.status] != null) s[r.status]++;
    if (r.status === 'approved') {
      if (String(r['是否需要收據'] || '').trim() === '是') s.needReceipt++;
      if (!r.pcheck) s.approvedUnpaid = (s.approvedUnpaid || 0) + 1;
      if (!r.sta) s.approvedNoSta = (s.approvedNoSta || 0) + 1;
      if (r.group) s.groupsInUse = true;
      else s.ungrouped = (s.ungrouped || 0) + 1;
    }
    if (r.status === 'pending' && !r.pcheck) s.pendingUnpaid = (s.pendingUnpaid || 0) + 1;
  });
  s.quota = Number(quota) || 0;
  s.seatsLeft = s.quota ? Math.max(0, s.quota - s.approved) : '';
  if (!s.groupsInUse) s.ungrouped = 0;
  return s;
}

/* ============================================================
 * 通告文件組版（模仿 Print_通告 公式；get(tab,r,c) 會傳入草稿覆蓋版）
 * ============================================================ */
function composeNoticeDoc(get, params) {
  const gv = (tab, r, c) => get(tab, r, c);
  const in1 = (spec) => String(gv(TAB.IN1, spec.r, spec.c) || '').trim();
  const in2 = (spec) => String(gv(TAB.IN2, spec.r, spec.c) || '').trim();

  const name = in2(IN2_CELLS.name) || in1(IN1_CELLS.name);
  const quota = in2(IN2_CELLS.quota);
  const deadline = normDate(gv(TAB.IN2, IN2_DEADLINE.r, IN2_DEADLINE.c));

  /* 節次（只取 ✓上通告＋有通告顯示日期，頭 4 節 — 跟通告 B18:D21） */
  const sessions = [];
  IN2_SESSIONS.rows.slice(0, 4).forEach((r) => {
    const on = gv(TAB.IN2, r, IN2_SESSIONS.onNotice) === true;
    const dispDate = String(gv(TAB.IN2, r, IN2_SESSIONS.dispDate) || '').trim();
    if (on && dispDate) {
      sessions.push({
        date: dispDate,
        time: String(gv(TAB.IN2, r, IN2_SESSIONS.dispTime) || '').trim(),
        venue: String(gv(TAB.IN2, r, IN2_SESSIONS.dispVenue) || '').trim(),
      });
    }
  });

  /* 班領導人（職位=班領導人 第一行；用 get 讀草稿版） */
  let leader = null;
  for (const r of IN2_STAFF.rows) {
    const role = String(gv(TAB.IN2, r, IN2_STAFF.role) || '').trim();
    if (role === '班領導人') {
      leader = {
        name: String(gv(TAB.IN2, r, IN2_STAFF.name) || '').trim(),
        title: String(gv(TAB.IN2, r, IN2_STAFF.title) || '').trim(),
        qual: String(gv(TAB.IN2, r, IN2_STAFF.qual) || '').trim(),
        phone: String(gv(TAB.IN2, r, IN2_STAFF.phone) || '').trim(),
        email: String(gv(TAB.IN2, r, IN2_STAFF.email) || '').trim(),
      };
      break;
    }
  }
  const leaderText = leader
    ? (leader.name + leader.title + (leader.qual ? '（' + leader.qual + '）' : ''))
    : '';

  /* 可編欄（Print_通告 格，經 get 攞草稿版） */
  const edits = {};
  Object.keys(NOTICE_EDIT).forEach((k) => {
    const spec = NOTICE_EDIT[k];
    edits[k] = String(gv(TAB.NOTICE, spec.r, spec.c) || '').trim();
  });

  const fpsId = params.fpsId || '（未設定）';
  const fpsName = params.fpsName || '';
  const portalUrl = params.portalUrl || '';

  return {
    title: name,
    fileNo: edits.fileNo,
    issueDate: edits.issueDate ? fmtCNDate(normDate(edits.issueDate)) : '',
    sessions, leader, leaderText,
    eligibility: edits.eligibility,
    feeNote: edits.feeNote,
    payText: '報名費用必須以轉數快繳付。帳戶識別碼 ' + fpsId + ' ' + fpsName +
      '（可掃瞄通告下方QR Code，備註欄請註明【' + name + '】及【參加者姓名】）。（如未能取錄，報名費用將會悉數退回）',
    quotaText: quota ? quota + '人' : '',
    deadlineText: deadline ? fmtCNDate(deadline) : '',
    signupText: '請於筲箕灣區成員系統訓練班版面填妥網上報名表（網址：' + portalUrl + '）',
    uniform: edits.uniform,
    remarks: [edits.remark1, edits.remark2, edits.remark3, edits.remark4, edits.remark5, edits.remark6].filter(x => x),
    enquiry: '如在' + (deadline ? fmtCNDate(deadline) : '截止日期') +
      '前尚未接獲通知者或有任何查詢，請電郵至 ' + (leader ? leader.email : '') +
      ' 或致電 ' + (leader ? leader.phone : '') + ' 與班領導人聯絡。',
    signer: edits.signer, deputy: edits.deputy,
  };
}

/* ── 整包 parse ── */

/* ── 出席表（Print_學員出席紀錄・coursev5 數碼版式） ──
 * 第4行 E起＝每節日期；第5行表頭；第6行起學員（分組/編號/中文名/英文名 + E起剔號）
 * 職員區：A 標記「職員出席」嗰行 +1 表頭（職位/姓名/稱謂）再 +1 起 ✔
 * 讀取按名/編號對返（唔靠行位），名單有出入 → stale=true（前端提示對齊） */
function parseAttend(attend, sessions, regs, staff) {
  const out = { initialized: false, stale: false, byStudent: {}, byStaff: {}, sessions: (sessions || []).length };
  if (!Array.isArray(attend) || attend.length < 6 || !out.sessions) return out;
  const approved = regs.filter(r => r.status === 'approved');
  if (!approved.length) return out;
  const get = (r, c) => String((r && r[c - 1]) != null ? r[c - 1] : '').trim();
  /* 學員區：第 6 行起掃 40 行 */
  let onSheet = 0;
  for (let i = 0; i < 40; i++) {
    const r = attend[6 + i - 1];   /* 1-based 行 6+i → 0-based 索引 5+i */
    if (!r) break;
    if (get(r, 1).indexOf('職員出席') === 0) break;   /* 到職員區，學員掃描完 */
    const no = get(r, 2), name = get(r, 3);
    if (!no && !name) continue;
    onSheet++;
    let reg = no ? approved.filter(g => String(g.studentNo) === no)[0] : null;
    if (!reg) reg = approved.filter(g => g.nameZh === name)[0] || null;
    if (!reg) { out.stale = true; continue; }
    const marks = [];
    for (let j = 1; j <= out.sessions; j++) marks.push(get(r, 4 + j));
    out.byStudent[reg.id] = marks;
  }
  if (onSheet > 0) out.initialized = true;
  if (onSheet < approved.length) out.stale = true;
  /* 職員區：搵標記行 */
  for (let row = 6; row <= attend.length; row++) {
    if (get(attend[row - 1], 1).indexOf('職員出席') === 0) {
      for (let k = 0; k < 40; k++) {
        const r = attend[row + 1 + k];   /* 表頭 +1 起係資料 */
        if (!r) break;
        const nm = get(r, 2);
        if (!nm) continue;
        const s2 = (staff || []).filter(x => x.name === nm)[0];
        if (!s2) continue;
        const marks = [];
        for (let j = 1; j <= out.sessions; j++) marks.push(get(r, 4 + j));
        out.byStaff[nm] = marks;
      }
      break;
    }
  }
  return out;
}


/* ── 完成報告（Print_訓練班完成報告 R10 起：A學員編號 B姓名 C旅號 D證書編號 E合格與否 F原因） ── */
function parseCompletion(grid, regs) {
  const out = { byStudent: {}, decided: 0 };
  if (!Array.isArray(grid)) return out;
  const get = (r, c) => String((r && r[c - 1]) != null ? r[c - 1] : '').trim();
  const approved = regs.filter(r => r.status === 'approved');
  for (let i = 9; i < grid.length && i < 50; i++) {
    const r = grid[i];
    const no = get(r, 1), name = get(r, 2);
    if (!no && !name) continue;
    const v = get(r, 5);
    if (!v) continue;                      /* 未評核嘅行唔計 */
    let reg = no ? approved.filter(g => String(g.studentNo) === no)[0] : null;
    if (!reg) reg = approved.filter(g => g.nameZh === name)[0] || null;
    if (!reg) continue;
    const pass = v === '合格' || v === '✔';
    out.byStudent[reg.id] = { pass: pass, certNo: get(r, 4), failReason: get(r, 6), row: i + 1 };
    out.decided++;
  }
  return out;
}

/* ── 掛載流程狀態 ──
   本機草稿(mock 未交區) → 生成 GS 交區(submitted) → 區會批准(params.approved)
   → 通告上網+貼 URL(noticeUrl) → 正式掛載成員系統報名(mounted)
   真班(非 mock)一律當已交區;批准/通告網址係區管理層喺區管理系統寫,APP 只讀 ── */
function mountStatus(st) {
  st = st || Store.state;
  const course = Store.activeCourse();
  const isMockDraft = !!(course && course.mock);
  const sub = (st && st.raw && st.raw.submitted) || null;
  const submitted = !isMockDraft || !!(sub && sub.url);
  const approved = !!(st && st.params && st.params.approved);
  const noticeUrl = (st && st.params && st.params.noticeUrl) || '';
  const phase = !submitted ? 'draft' : (!approved ? 'submitted' : (!noticeUrl ? 'approved' : 'mounted'));
  return {
    phase: phase, submitted: submitted, approved: approved, noticeUrl: noticeUrl,
    isMockDraft: isMockDraft, gsUrl: sub ? sub.url : '',
    portalUrl: (st && st.params && st.params.portalUrl) || '',
  };
}

/* ── Input03 時間表（每節 10 行 block;R(head) 日期/地點、R(head+1) 時間/服裝、head+4 起 rundown） ── */
function parseInput03(grid) {
  const out = { blocks: [] };
  if (!Array.isArray(grid)) return out;
  const get = (r, c) => String((grid[r - 1] && grid[r - 1][c - 1]) != null ? grid[r - 1][c - 1] : '').trim();
  for (let i = 0; i < IN3_LAYOUT.maxBlocks; i++) {
    const head = IN3_LAYOUT.firstHead + i * IN3_LAYOUT.blockRows;
    if (head > grid.length) break;
    const date = normDate(get(head, IN3_LAYOUT.date.c));
    const venue = get(head, IN3_LAYOUT.venue.c);
    const time = get(head + IN3_LAYOUT.time.dr, IN3_LAYOUT.time.c);
    const dress = get(head + IN3_LAYOUT.dress.dr, IN3_LAYOUT.dress.c);
    const items = [];
    for (let k = 0; k < IN3_LAYOUT.items; k++) {
      const r = head + 4 + k;
      const name = get(r, IN3_LAYOUT.item.name);
      const mins = get(r, IN3_LAYOUT.item.mins);
      if (!name && !mins) continue;
      items.push({ start: get(r, IN3_LAYOUT.item.start), mins: Number(mins) || 0, name: name, owner: get(r, IN3_LAYOUT.item.owner) });
    }
    if (!date && !venue && !time && !items.length) continue;
    out.blocks.push({ date: date, venue: venue, time: time, dress: dress, items: items });
  }
  return out;
}

/* ── 領取證書（Print_領取證書紀錄 R7 起：B學員編號 C姓名 D旅號 E證書編號 F領取日期 G簽收） ── */
function parseCert(grid, regs) {
  const out = { byStudent: {} };
  if (!Array.isArray(grid)) return out;
  const get = (r, c) => String((r && r[c - 1]) != null ? r[c - 1] : '').trim();
  const approved = regs.filter(r => r.status === 'approved');
  for (let i = 6; i < grid.length && i < 50; i++) {
    const r = grid[i];
    const no = get(r, 2), name = get(r, 3);
    if (!no && !name) continue;
    let reg = no ? approved.filter(g => String(g.studentNo) === no)[0] : null;
    if (!reg) reg = approved.filter(g => g.nameZh === name)[0] || null;
    if (!reg) continue;
    out.byStudent[reg.id] = { certNo: get(r, 5), pickupDate: get(r, 6), signed: get(r, 7), row: i + 1 };
  }
  return out;
}

function parseAll(raw) {
  raw = raw || {};
  const info = parseCourseInfo(raw.input01, raw.input02);
  const sessions = parseSessions(raw.input02);
  const staff = parseStaff(raw.input02);
  const params = parseParamsWX(raw.paramsWX);
  const regs = parseRegs(raw.resp);
  const attend = parseAttend(raw.attend, sessions, regs, staff);
  const completion = parseCompletion(raw.completion, regs);
  const cert = parseCert(raw.cert, regs);
  const input03 = parseInput03(raw.input03);
  const noticeEdits = parseNoticeEdits(raw.notice);
  const leader = staff.filter(s => s.role === '班領導人')[0] || null;
  return {
    raw, info, sessions, staff, params, regs, noticeEdits, leader, attend, completion, cert, input03,
    stats: regStats(regs, info.quota),
    rev: raw.rev || 0, revBy: raw.revBy || '', revSavedAt: raw.revSavedAt || '',
    pulledAt: raw.pulledAt || '',
  };
}
