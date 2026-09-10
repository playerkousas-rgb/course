/* ============================================================
 * 65-attend.js — 簽到/點名（數碼化・唔使紙）
 * 學員：每節 ✔出席 ✗缺席 遲 假（草稿→💾，rev 防撞）
 * 職員：每節 tick ✔ → 服務時數照 Input02 每節時間自動計
 * 存儲：Print_學員出席紀錄（coursev5 版式：R4 日期/R6 起學員/職員區）
 * ============================================================ */

let _attendSess = 1;      /* 而家點緊第幾節（1 起） */
let _attendView = 'stu';  /* stu | staff | all */

/* 版式常數 */
const ATT_STU_ROW = 6;                       /* 學員第一行 */
const ATT_COL_BASE = 5;                      /* E 起＝第 1 節 */
const ATT_STU_MIN_ROWS = 21;                 /* 學員區至少 21 行（6-26） */
const ATT_STU_MARKS = ['✔', '✗', '遲', '假'];
const ATT_MARK_LABEL = { '✔': '出席', '✗': '缺席', '遲': '遲到', '假': '請假' };

function attendApproved(st) {
  return st.regs.filter(r => r.status === 'approved').sort((a, b) => {
    const na = Number(a.studentNo), nb = Number(b.studentNo);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return a.__row - b.__row;
  });
}
function attendStaffRow(nStu) { return ATT_STU_ROW + Math.max(ATT_STU_MIN_ROWS, nStu) + 1; }
function attendSessCol(j) { return ATT_COL_BASE + j - 1; }

/* 每節時數（照 Input02 時間欄；"1930 - 2130" → 2h；完 ≤ 起 → 過夜 +24h） */
function attendSessHours(s) {
  const m = String(s.time || '').match(/(\d{1,2})\s*[:時]?\s*(\d{2})?\s*[-–~至]\s*(\d{1,2})\s*[:時]?\s*(\d{2})?/);
  if (!m) return 0;
  const toMin = (h, mm) => Number(h) * 60 + Number(mm || 0);
  let diff = toMin(m[3], m[4]) - toMin(m[1], m[2]);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 2) / 2;
}

/* 而家嘅剔號（快照＋草稿） */
function attendMark(st, stuIdx, j) {
  const v = Store.effectiveCell(TAB.ATTEND, ATT_STU_ROW + stuIdx, attendSessCol(j));
  return String(v == null ? '' : v).trim();
}
function attendStaffMark(st, staffIdx, nStu, j) {
  const v = Store.effectiveCell(TAB.ATTEND, attendStaffRow(nStu) + 2 + staffIdx, attendSessCol(j));
  return String(v == null ? '' : v).trim();
}

/* 對齊名單：重寫日期行＋學員區＋職員區（剔號會照有效值搬位），一次過 batch 寫入 */
async function attendAlign(st) {
  const approved = attendApproved(st);
  if (!approved.length) { toast('未有取錄學員，冇嘢對齊', 'warn'); return; }
  const nS = st.sessions.length, nStu = approved.length;
  const go = await confirmDlg('📋 對齊出席表名單',
    '會重寫「Print_學員出席紀錄」嘅名單區：\n' +
    '・第 4 行每節日期（' + nS + ' 節）\n' +
    '・第 6 行起 ' + nStu + ' 位學員（分組/編號/姓名）\n' +
    '・職員區 ' + st.staff.length + ' 人\n\n' +
    '已有嘅剔號會跟住搬去啱嘅位（內容不變）；其他職員同時改嘅話會偵測到衝突。', { okText: '對齊' });
  if (!go) return;

  const cells = [];
  const push = (row, col, value) => cells.push({ tab: TAB.ATTEND, row: row, col: col, value: value });
  /* 日期行 + 學員表頭 */
  for (let j = 1; j <= nS; j++) push(4, attendSessCol(j), st.sessions[j - 1].date);
  push(5, 1, '分組'); push(5, 2, '學員編號'); push(5, 3, '中文姓名'); push(5, 4, '英文姓名');
  /* 學員區（現有剔號照抄落新位） */
  const old = st.attend || { byStudent: {}, byStaff: {} };
  approved.forEach((r, i) => {
    const row = ATT_STU_ROW + i;
    push(row, 1, r.group || '');
    push(row, 2, r.studentNo == '' ? '' : String(r.studentNo));
    push(row, 3, r.nameZh);
    push(row, 4, r.nameEn || '');
    for (let j = 1; j <= nS; j++) push(row, attendSessCol(j), (old.byStudent[r.id] || [])[j - 1] || '');
  });
  /* 職員區 */
  const sr = attendStaffRow(nStu);
  push(sr, 1, '職員出席（服務時數自動計）');
  push(sr + 1, 1, '職位'); push(sr + 1, 2, '姓名'); push(sr + 1, 3, '稱謂');
  st.staff.forEach((s, i) => {
    const row = sr + 2 + i;
    push(row, 1, s.role); push(row, 2, s.name); push(row, 3, s.title || '');
    for (let j = 1; j <= nS; j++) push(row, attendSessCol(j), (old.byStaff[s.name] || [])[j - 1] || '');
  });

  toast('對齊中…');
  const res = await api.batch(cells, st.rev, Store.staffName() || '');
  if (res && res.ok) {
    Store.pushLog('attend', '出席表對齊名單（' + cells.length + ' 格）');
    toast('✅ 出席表已對齊（rev ' + res.data.rev + '）', 'ok');
    await Sync.refresh('silent');
  } else if (res && res.conflict) {
    await Sync.refresh('silent');
    toast('有人同時改緊——已幫你重讀最新，再撳一次「對齊名單」', 'warn');
  } else {
    toast('❌ ' + ((res && res.error) || '失敗'), 'err');
  }
}

regPage('attend', function (root) {
  const st = Store.state;
  if (!st) { root.appendChild(h('div', { class: 'card' }, '載入中…')); return; }
  if (!st.sessions.length) {
    root.appendChild(h('div', { class: 'card empty' }, '未填節次——先去「開班文件 → Input02」填好每節日期時間'));
    return;
  }
  const approved = attendApproved(st);
  if (!approved.length) {
    root.appendChild(h('div', { class: 'card empty' }, '未有取錄學員——去「收生」做接納，之後先可以點名'));
    return;
  }
  const nStu = approved.length;
  const nS = st.sessions.length;
  if (_attendSess > nS) _attendSess = nS;
  const noAttend = !st.attend || !st.attend.initialized;

  /* 頂部：節次揀選 + 狀態 */
  const head = h('div', { class: 'page-head no-print' });
  head.appendChild(h('div', { class: 'card-title' }, '✍️ 簽到／點名'));
  head.appendChild(h('div', { class: 'row-sub' }, ' tick 一下即刻做草稿（記你個名＋時間），撳右上角 💾 先寫入——多人同時點都唔會撞'));
  if (noAttend) {
    head.appendChild(h('div', { class: 'form-msg warn' },
      '出席表仲未對齊名單（要寫入「Print_學員出席紀錄」先可以開始記錄）。',
      h('button', { class: 'btn btn-sm btn-primary', style: { marginLeft: '8px' }, onclick: () => attendAlign(st) }, '📋 對齊名單')));
  } else if (st.attend.stale) {
    head.appendChild(h('div', { class: 'form-msg warn' },
      '⚠️ 名單同出席表有出入（新取錄／取消過學員）——撳「對齊名單」更新（剔號會保留）。',
      h('button', { class: 'btn btn-sm', style: { marginLeft: '8px' }, onclick: () => attendAlign(st) }, '📋 對齊名單')));
  }
  const chips = h('div', { class: 'chip-row' });
  st.sessions.forEach((s, i) => {
    let done = 0;
    approved.forEach((r, k) => { if (attendMark(st, k, i + 1)) done++; });
    chips.appendChild(h('button', {
      class: 'fchip' + (_attendSess === i + 1 ? ' active' : '') + (done < nStu ? ' pulse' : ''),
      onclick: () => { _attendSess = i + 1; UI.rerenderPage(); },
    }, '第' + (i + 1) + '節 ' + fmtShortDate(s.date) + '（' + done + '/' + nStu + '）'));
  });
  head.appendChild(chips);
  root.appendChild(head);

  /* 檢視切換 */
  const seg = h('div', { class: 'seg-row no-print' });
  [['stu', '👦 學員點名'], ['staff', '🧑‍🏫 職員簽到'], ['all', '📊 出席總覽']].forEach(([k, label]) => {
    seg.appendChild(h('button', { class: 'seg-btn' + (_attendView === k ? ' active' : ''), onclick: () => { _attendView = k; UI.rerenderPage(); } }, label));
  });
  root.appendChild(seg);

  const j = _attendSess;

  /* ── 學員點名 ── */
  if (_attendView === 'stu') {
    let done = 0;
    approved.forEach((r, k) => { if (attendMark(st, k, j)) done++; });
    const bar = h('div', { class: 'card' });
    bar.appendChild(h('div', { class: 'card-title' }, '第 ' + j + ' 節・' + fmtCNDate(st.sessions[j - 1].date) + '（' + st.sessions[j - 1].time + '）— 已點 ' + done + '/' + nStu));
    bar.appendChild(h('div', { class: 'progress-track' }, h('div', { class: 'progress-fill', style: { width: Math.round(done / nStu * 100) + '%' } })));
    const actions = h('div', { class: 'btn-row', style: { marginTop: '10px' } });
    actions.appendChild(h('button', { class: 'btn btn-sm', onclick: () => {
      let n = 0;
      approved.forEach((r, k) => {
        if (!attendMark(st, k, j)) { Store.addCellDraft(TAB.ATTEND, ATT_STU_ROW + k, attendSessCol(j), '✔', r.nameZh + ' 第' + j + '節 出席'); n++; }
      });
      toast(n ? '✏️ 已為 ' + n + ' 位未有記錄嘅學員產生「出席」草稿——撳💾寫入' : '全部已有記錄 ✅', n ? 'ok' : '');
      UI.rerenderPage();
    } }, '✔ 全部出席（補未有記錄嘅）'));
    bar.appendChild(actions);
    root.appendChild(bar);

    const list = h('div', { class: 'reg-list' });
    approved.forEach((r, k) => {
      const cur = attendMark(st, k, j);
      const row = h('div', { class: 'card mk-row' + (cur ? '' : ' mk-pending') });
      const info = h('div', { class: 'mk-info' });
      info.appendChild(h('div', { class: 'reg-name' }, esc(r.studentNo !== '' ? '#' + r.studentNo + ' ' : ''), esc(r.nameZh)));
      info.appendChild(h('div', { class: 'row-sub dim' }, (r.group ? esc(r.group) + '・' : '') + esc(r['旅團'] || '—')));
      row.appendChild(info);
      const btns = h('div', { class: 'mk-btns no-print' });
      ATT_STU_MARKS.forEach((mk) => {
        const b = h('button', { class: 'mk-btn mk-' + mk + (cur === mk ? ' on' : '') }, mk === '✔' ? '✔ 到' : mk === '✗' ? '✗ 缺' : mk);
        b.addEventListener('click', () => {
          const next = cur === mk ? '' : mk;
          Store.addCellDraft(TAB.ATTEND, ATT_STU_ROW + k, attendSessCol(j), next,
            r.nameZh + ' 第' + j + '節 ' + (next ? ATT_MARK_LABEL[next] : '（清空）'));
          UI.rerenderPage(true);
        });
        btns.appendChild(b);
      });
      row.appendChild(btns);
      list.appendChild(row);
    });
    root.appendChild(list);
  }

  /* ── 職員簽到（服務時數自動計） ── */
  if (_attendView === 'staff') {
    const sRow = attendStaffRow(nStu);
    const info = h('div', { class: 'card' });
    info.appendChild(h('div', { class: 'card-title' }, '🧑‍🏫 職員簽到 — 第 ' + j + ' 節・' + attendSessHours(st.sessions[j - 1]) + ' 小時'));
    info.appendChild(h('div', { class: 'row-sub' }, 'tick ✔ 該節有到；服務時數＝有到嘅節嘅時數總和（照 Input02 時間自動計，唔使簽到簽退）'));
    root.appendChild(info);

    const list = h('div', { class: 'reg-list' });
    st.staff.forEach((s, i) => {
      const cur = attendStaffMark(st, i, nStu, j);
      let hours = 0;
      for (let jj = 1; jj <= nS; jj++) if (attendStaffMark(st, i, nStu, jj) === '✔') hours += attendSessHours(st.sessions[jj - 1]);
      const row = h('div', { class: 'card mk-row' });
      const info2 = h('div', { class: 'mk-info' });
      info2.appendChild(h('div', { class: 'reg-name' }, esc(s.name)));
      info2.appendChild(h('div', { class: 'row-sub dim' }, esc(s.role) + (s.title ? '・' + esc(s.title) : '') + '・服務時數 ' + (Math.round(hours * 10) / 10) + 'h'));
      row.appendChild(info2);
      const btns = h('div', { class: 'mk-btns no-print' });
      const b = h('button', { class: 'mk-btn mk-✔' + (cur === '✔' ? ' on' : '') }, '✔ 到');
      b.addEventListener('click', () => {
        Store.addCellDraft(TAB.ATTEND, sRow + 2 + i, attendSessCol(j), cur === '✔' ? '' : '✔',
          s.name + ' 第' + j + '節 ' + (cur === '✔' ? '（清空）' : '簽到'));
        UI.rerenderPage(true);
      });
      btns.appendChild(b);
      row.appendChild(btns);
      list.appendChild(row);
    });
    root.appendChild(list);
  }

  /* ── 出席總覽 ── */
  if (_attendView === 'all') {
    const grid = h('div', { class: 'card' });
    grid.appendChild(h('div', { class: 'card-title' }, '📊 學員出席總覽'));
    const wrap = h('div', { class: 'table-scroll' });
    const tbl = h('table', { class: 'data-table att-table' });
    const thead = h('thead', null, h('tr', null,
      h('th', null, '編號'), h('th', null, '姓名'),
      st.sessions.map((s, i) => h('th', { class: 'th-sess' }, '第' + (i + 1) + '節' + fmtShortDate(s.date))),
      h('th', null, '出席率')));
    const tbody = h('tbody', null);
    approved.forEach((r, k) => {
      const tr = h('tr', null);
      tr.appendChild(h('td', { class: 'td-idx' }, esc(r.studentNo)));
      tr.appendChild(h('td', { class: 'td-strong' }, esc(r.nameZh)));
      let att = 0, marked = 0;
      st.sessions.forEach((s, i) => {
        const mk = attendMark(st, k, i + 1);
        if (mk) marked++;
        if (mk === '✔' || mk === '遲') att++;
        tr.appendChild(h('td', { class: 'att-cell att-' + (mk || 'none') }, mk));
      });
      const rate = marked ? Math.round(att / marked * 100) : null;
      tr.appendChild(h('td', { class: 'td-strong' + (rate != null && rate < 70 ? ' text-red' : '') }, rate == null ? '—' : rate + '%'));
      tbody.appendChild(tr);
    });
    tbl.appendChild(thead); tbl.appendChild(tbody);
    wrap.appendChild(tbl);
    grid.appendChild(wrap);
    grid.appendChild(h('div', { class: 'row-sub' }, '出席率＝（✔＋遲）÷ 已點節數；低過 70% 會紅字——完成報告/證書跟呢個數'));
    root.appendChild(grid);

    /* 職員時數表 */
    const sRow = attendStaffRow(nStu);
    const sh = h('div', { class: 'card' });
    sh.appendChild(h('div', { class: 'card-title' }, '🧑‍🏫 職員服務時數'));
    const sw = h('div', { class: 'table-scroll' });
    const stbl = h('table', { class: 'data-table' });
    stbl.appendChild(h('thead', null, h('tr', null,
      h('th', null, '職位'), h('th', null, '姓名'),
      st.sessions.map((s, i) => h('th', { class: 'th-sess' }, '第' + (i + 1) + '節')),
      h('th', null, '時數'))));
    const stb = h('tbody', null);
    let totalHours = 0;
    st.staff.forEach((s, i) => {
      const tr = h('tr', null);
      tr.appendChild(h('td', null, esc(s.role)));
      tr.appendChild(h('td', { class: 'td-strong' }, esc(s.name)));
      let hours = 0;
      st.sessions.forEach((ss, i2) => {
        const mk = attendStaffMark(st, i, nStu, i2 + 1);
        if (mk === '✔') hours += attendSessHours(ss);
        tr.appendChild(h('td', { class: 'att-cell att-' + (mk || 'none') }, mk));
      });
      totalHours += hours;
      tr.appendChild(h('td', { class: 'td-strong' }, (Math.round(hours * 10) / 10) + 'h'));
      stb.appendChild(tr);
    });
    const ttr = h('tr', null, h('td', { colspan: 2 + nS, class: 'td-total' }, '合計'), h('td', { class: 'td-strong' }, (Math.round(totalHours * 10) / 10) + 'h'));
    stb.appendChild(ttr);
    stbl.appendChild(stb);
    sw.appendChild(stbl);
    sh.appendChild(sw);
    root.appendChild(sh);
  }
});
