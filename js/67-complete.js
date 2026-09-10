/**
 * 67-complete.js — 完成模組
 * 評核（合格判定）→ 合格名單 → 列印證書 → 完成報告 → 領取證書紀錄
 * 讀 Print_訓練班完成報告（TAB.COMPLETE）＋ Print_領取證書紀錄（TAB.CERT）
 */
'use strict';

const HOME_DISTRICT = '筲箕灣';
const COMP_ROW_BASE = 10;   /* 完成報告第 10 行起係學員 */
const CERT_ROW_BASE = 7;    /* 領取證書第 7 行起 */

let _compView = 'assess';   /* assess|list|cert|report|pickup */
let _compThreshold = 70;    /* 合格出席率門檻（%） */
let _compBusy = false;

/* 學員出席率（同 65 出席總覽公式：✔＋遲 ÷ 已點節數） */
function compRate(st, regId) {
  const marks = (st.attend && st.attend.byStudent && st.attend.byStudent[regId]) || [];
  let hit = 0, marked = 0;
  marks.forEach(function (m) { if (m) { marked++; if (m === '✔' || m === '遲') hit++; } });
  return { hit: hit, marked: marked, rate: marked ? hit / marked : 0 };
}

/* 建議合格與否：出席率達標（未有出席記錄＝唔建議） */
function compSuggest(st, regId) {
  const r = compRate(st, regId);
  if (!r.marked) return { suggest: false, attended: false, rate: r };
  return { suggest: r.rate * 100 >= _compThreshold, attended: true, rate: r };
}

/* 合格名單（以完成報告評核為準；fallback 未評＝唔入圍） */
function compPassList(st, approved) {
  return approved.filter(function (r) {
    return st.completion && st.completion.byStudent[r.id] && st.completion.byStudent[r.id].pass;
  });
}

/* 完成報告統計 */
function compStats(st, approved) {
  const all = st.regs || [];
  const home = function (r) { return String(r['所屬童軍區'] || '').indexOf(HOME_DISTRICT) >= 0; };
  let appliedHome = 0, appliedAway = 0, okHome = 0, okAway = 0, done = 0, pass = 0;
  all.forEach(function (r) { if (home(r)) appliedHome++; else appliedAway++; });
  approved.forEach(function (r) {
    if (home(r)) okHome++; else okAway++;
    const marks = (st.attend && st.attend.byStudent && st.attend.byStudent[r.id]) || [];
    if (marks.some(function (m) { return !!m; })) done++;
    const c = st.completion && st.completion.byStudent[r.id];
    if (c && c.pass) pass++;
  });
  return { appliedHome: appliedHome, appliedAway: appliedAway, okHome: okHome, okAway: okAway, done: done, pass: pass };
}

/* ── 評核一行寫入 ── */
async function compSaveRow(st, r, data, btn) {
  if (_compBusy) return;
  _compBusy = true;
  const old = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const res = await apiCall('setCompletionRow', {
    code: r.studentNo || undefined,
    name: r.nameZh,
    pass: !!data.pass,
    certNo: data.certNo || '',
    failReason: data.pass ? '' : (data.failReason || ''),
    by: Store.staffName() || '',
  });
  _compBusy = false;
  if (btn) { btn.disabled = false; btn.textContent = old; }
  if (res && res.ok) {
    toast('✅ ' + r.nameZh + ' 已評' + (data.pass ? '合格' : '不合格'), 'ok');
    Store.pushLog('complete', '評核：' + r.nameZh + ' ' + (data.pass ? '合格' : '不合格（' + (data.failReason || '') + '）'));
    await Sync.refresh('silent');
  } else if (res && res.conflict) {
    await Sync.refresh('silent');
    toast('有人同時改緊——已重讀最新，請再撳一次', 'warn');
  } else {
    toast('❌ ' + ((res && res.error) || '失敗'), 'err');
  }
}

regPage('complete', function (root) {
  const st = Store.state;
  if (!st) { root.appendChild(h('div', { class: 'card' }, '載入中…')); return; }
  const approved = attendApproved(st);
  if (!approved.length) {
    root.appendChild(h('div', { class: 'card empty' }, '未有取錄學員——完成評核要先用「收生」接納學員'));
    return;
  }

  const stats = compStats(st, approved);
  const passList = compPassList(st, approved);

  /* 頂部 */
  const head = h('div', { class: 'page-head no-print' });
  head.appendChild(h('div', { class: 'card-title' }, '🎓 完成模組'));
  head.appendChild(h('div', { class: 'row-sub' },
    '評核（出席率 ' + _compThreshold + '% 達標建議合格）→ 合格名單 → 列印證書 → 完成報告 → 領取證書紀錄'));
  root.appendChild(head);

  /* 統計卡 */
  const cards = h('div', { class: 'stat-row no-print' });
  cards.appendChild(h('div', { class: 'stat-card' },
    h('div', { class: 'stat-num' }, String(stats.pass)), h('div', { class: 'stat-label' }, '合格')));
  cards.appendChild(h('div', { class: 'stat-card' },
    h('div', { class: 'stat-num' }, String((st.completion && st.completion.decided) || 0) + '／' + approved.length),
    h('div', { class: 'stat-label' }, '已評核')));
  cards.appendChild(h('div', { class: 'stat-card' },
    h('div', { class: 'stat-num' }, String(stats.done)), h('div', { class: 'stat-label' }, '有出席記錄')));
  const certTaken = passList.filter(function (r) { const c = st.cert && st.cert.byStudent[r.id]; return c && c.pickupDate; }).length;
  cards.appendChild(h('div', { class: 'stat-card' },
    h('div', { class: 'stat-num' }, certTaken + '／' + passList.length), h('div', { class: 'stat-label' }, '已領證書')));
  root.appendChild(cards);

  /* 檢視切換 */
  const seg = h('div', { class: 'seg-row no-print' });
  [['assess', '🧮 評核'], ['list', '🏆 合格名單'], ['cert', '🖨 證書'], ['report', '📄 完成報告'], ['pickup', '📋 領取證書']].forEach(function (x) {
    seg.appendChild(h('button', {
      class: 'seg-btn' + (_compView === x[0] ? ' active' : ''),
      onclick: function () { _compView = x[0]; UI.rerenderPage(); },
    }, x[1]));
  });
  root.appendChild(seg);

  /* ══ 評核 ══ */
  if (_compView === 'assess') {
    const bar = h('div', { class: 'card no-print' });
    const thRow = h('div', { class: 'form-row', style: { alignItems: 'center', gap: '10px', flexWrap: 'wrap' } });
    thRow.appendChild(h('label', { class: 'form-label', style: { margin: 0 } }, '合格出席率門檻 ≥'));
    const thIn = h('input', { type: 'number', min: '0', max: '100', value: String(_compThreshold), style: { width: '70px' } });
    thRow.appendChild(thIn);
    thRow.appendChild(h('span', null, '%'));
    thRow.appendChild(h('button', { class: 'btn btn-sm', onclick: function () {
      const v = Number(thIn.value);
      if (Number.isFinite(v) && v >= 0 && v <= 100) { _compThreshold = Math.round(v); UI.rerenderPage(); }
      else toast('門檻要 0–100', 'err');
    } }, '套用'));
    thRow.appendChild(h('span', { class: 'dim', style: { fontSize: '12px' } }, '出席率＝（出席＋遲到）÷ 已點節數'));
    bar.appendChild(thRow);
    const seqRow = h('div', { class: 'form-row', style: { alignItems: 'center', gap: '10px', flexWrap: 'wrap' } });
    seqRow.appendChild(h('label', { class: 'form-label', style: { margin: 0 } }, '證書編號前綴'));
    const pfIn = h('input', { type: 'text', value: 'SPG-2026-', style: { width: '110px' } });
    seqRow.appendChild(pfIn);
    seqRow.appendChild(h('button', { class: 'btn btn-sm', onclick: function () {
      const pf = pfIn.value.trim() || 'CERT-';
      let seq = 0;
      approved.forEach(function (r) {
        const c = st.completion && st.completion.byStudent[r.id];
        if (c && c.certNo) seq = Math.max(seq, Number(String(c.certNo).split('-').pop()) || 0);
      });
      const list = root.querySelectorAll('[data-certno]');
      list.forEach(function (el) {
        const rid = el.getAttribute('data-certno');
        const r = approved.filter(function (g) { return g.id === rid; })[0];
        const c = r && st.completion && st.completion.byStudent[r.id];
        if (!el.value && r && el.getAttribute('data-pass') === '1') el.value = pf + String(++seq).padStart(3, '0');
      });
      toast('✏️ 已填編號——記得逐行撳「儲存」', 'ok');
    } }, '🔢 自動編號（合格・未填）'));
    bar.appendChild(seqRow);
    root.appendChild(bar);

    /* 評核表 */
    const card = h('div', { class: 'card' });
    card.appendChild(h('div', { class: 'card-title' }, '🧮 合格評核（' + ((st.completion && st.completion.decided) || 0) + '/' + approved.length + ' 已評）'));
    const wrap = h('div', { class: 'table-scroll' });
    const tbl = h('table', { class: 'data-table comp-table' });
    tbl.appendChild(h('thead', null, h('tr', null,
      h('th', null, '學員'), h('th', null, '出席'), h('th', null, '建議'),
      h('th', null, '評核'), h('th', null, '證書編號'), h('th', null, '不合格原因'), h('th', null, ''))));
    const tb = h('tbody', null);
    approved.forEach(function (r) {
      const c = (st.completion && st.completion.byStudent[r.id]) || null;
      const sug = compSuggest(st, r.id);
      const rt = Math.round(sug.rate.rate * 100);
      const low = sug.rate.marked && rt < _compThreshold;
      const tr = h('tr', null);
      tr.appendChild(h('td', { class: 'td-strong' },
        esc(String(r.studentNo || '—')) + '・' + esc(r.nameZh) + '（' + esc(r.troopNo || '—') + '）'));
      tr.appendChild(h('td', { class: 'td-num' + (low ? ' text-red' : '') },
        sug.rate.marked ? (sug.rate.hit + '/' + sug.rate.marked + '・' + rt + '%') : '未有記錄'));
      tr.appendChild(h('td', null, sug.rate.marked
        ? h('span', { class: 'badge ' + (sug.suggest ? 'badge-ok' : 'badge-err') }, sug.suggest ? '✔ 建議合格' : '✗ 建議不合格')
        : h('span', { class: 'dim' }, '—')));
      const sel = h('td', null);
      const passBtn = h('button', { class: 'btn btn-sm btn-ok' + (c && c.pass ? ' active' : '') }, '✔ 合格');
      const failBtn = h('button', { class: 'btn btn-sm btn-err' + (c && !c.pass ? ' active' : '') }, '✗ 不合格');
      sel.appendChild(passBtn); sel.appendChild(failBtn);
      tr.appendChild(sel);
      const certIn = h('input', { type: 'text', value: (c && c.certNo) || '', 'data-certno': r.id, 'data-pass': c && c.pass ? '1' : '0', style: { width: '120px' } });
      const reasonIn = h('input', { type: 'text', value: (c && c.failReason) || '', placeholder: c && !c.pass ? '例：出席率不足' : '', style: { width: '130px' } });
      tr.appendChild(h('td', null, certIn));
      tr.appendChild(h('td', null, reasonIn));
      tr.appendChild(h('td', null, c
        ? h('span', { class: 'badge ' + (c.pass ? 'badge-ok' : 'badge-err') }, c.pass ? '已評・合格' : '已評・不合格')
        : h('span', { class: 'badge' }, '未評')));
      const saveBtn = h('button', { class: 'btn btn-sm btn-primary' }, '💾 儲存');
      saveBtn.addEventListener('click', function () {
        const pass = passBtn.classList.contains('active');
        if (!passBtn.classList.contains('active') && !failBtn.classList.contains('active')) { toast('先揀 ✔／✗ 再儲存', 'err'); return; }
        compSaveRow(st, r, { pass: pass, certNo: certIn.value.trim(), failReason: reasonIn.value.trim() }, saveBtn);
      });
      passBtn.addEventListener('click', function () { passBtn.classList.add('active'); failBtn.classList.remove('active'); certIn.setAttribute('data-pass', '1'); });
      failBtn.addEventListener('click', function () { failBtn.classList.add('active'); passBtn.classList.remove('active'); certIn.setAttribute('data-pass', '0'); });
      tr.appendChild(h('td', { class: 'no-print' }, saveBtn));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    card.appendChild(wrap);
    card.appendChild(h('div', { class: 'row-sub' }, '出席率由簽到記錄自動計；建議只係參考，最終由班領導人決定。評核會寫入「Print_訓練班完成報告」。'));
    root.appendChild(card);
    return;
  }

  /* ══ 合格名單（印刷版） ══ */
  if (_compView === 'list') {
    const btnBar = h('div', { class: 'btn-row no-print', style: { marginBottom: '12px' } });
    btnBar.appendChild(h('button', { class: 'btn btn-primary', onclick: function () { window.print(); } }, '🖨 列印合格名單'));
    root.appendChild(btnBar);
    const doc = h('div', { class: 'doc-page list-doc' });
    doc.appendChild(h('div', { class: 'doc-org' }, '香港童軍總會 筲箕灣區'));
    doc.appendChild(h('div', { class: 'doc-title' }, esc(st.info.courseName)));
    doc.appendChild(h('div', { class: 'doc-sub' }, '合格名單'));
    const n = passList.length;
    const half = Math.ceil(n / 2);
    const mkCol = function (arr, startNo) {
      const col = h('div', { class: 'doc-col' });
      arr.forEach(function (r, i) {
        col.appendChild(h('div', { class: 'doc-line' },
          String(startNo + i) + '.　' + esc(r.nameZh) + '（' + esc(r.troopNo || '—') + '）'));
      });
      return col;
    };
    const cols = h('div', { class: 'doc-cols' });
    cols.appendChild(mkCol(passList.slice(0, half), 1));
    cols.appendChild(mkCol(passList.slice(half), half + 1));
    doc.appendChild(cols);
    doc.appendChild(h('div', { class: 'doc-note' },
      '尚未領取證書之學員，可於區會辦公時間前往區總部領取證書。區會辦公時間請參閱 www.skwscout.org.hk。'));
    doc.appendChild(h('div', { class: 'doc-sign' }, '班領導人：＿＿＿＿＿＿＿＿＿＿'));
    root.appendChild(doc);
    if (!n) root.appendChild(h('div', { class: 'card empty' }, '未有合格學員——先喺「🧮 評核」評好'));
    return;
  }

  /* ══ 列印證書 ══ */
  if (_compView === 'cert') {
    const noCert = passList.filter(function (r) {
      const c = (st.completion && st.completion.byStudent[r.id]) || null;
      return !c || !c.certNo;
    });
    const btnBar = h('div', { class: 'btn-row no-print', style: { marginBottom: '12px' } });
    btnBar.appendChild(h('button', { class: 'btn btn-primary', onclick: function () { window.print(); } }, '🖨 列印證書（' + (passList.length - noCert.length) + ' 張）'));
    root.appendChild(btnBar);
    if (!passList.length) { root.appendChild(h('div', { class: 'card empty' }, '未有合格學員——先喺「🧮 評核」評好')); return; }
    if (noCert.length) root.appendChild(h('div', { class: 'form-msg warn no-print' },
      '⚠️ 有 ' + noCert.length + ' 位合格學員未有證書編號（' + noCert.map(function (r) { return r.nameZh; }).join('、') + '）——返「🧮 評核」填編號後先列印到'));
    passList.forEach(function (r, i) {
      const c = (st.completion && st.completion.byStudent[r.id]) || null;
      if (!c || !c.certNo) return;
      const pg = h('div', { class: 'doc-page cert-page' + (i > 0 ? ' page-break' : '') });
      pg.appendChild(h('div', { class: 'cert-org' }, '香港童軍總會 筲箕灣區'));
      pg.appendChild(h('div', { class: 'cert-title' }, '證　書'));
      pg.appendChild(h('div', { class: 'cert-body' },
        '茲證明　', h('span', { class: 'cert-name' }, esc(r.nameZh)),
        '（' + esc(r['旅團'] || '') + '）修畢本區主辦之'));
      pg.appendChild(h('div', { class: 'cert-body cert-course' }, '「' + esc(st.info.courseName) + '」'));
      pg.appendChild(h('div', { class: 'cert-body' }, '成績合格，特發此證。'));
      pg.appendChild(h('div', { class: 'cert-no' }, '證書編號：' + esc(c.certNo)));
      const signs = h('div', { class: 'cert-sign-row' });
      signs.appendChild(h('div', { class: 'cert-sign' },
        h('div', { class: 'cert-sign-name' }, '班領導人　＿＿＿＿＿＿'), h('div', { class: 'cert-sign-role' }, (st.leader && st.leader.name) ? esc(st.leader.name) : '班領導人')));
      signs.appendChild(h('div', { class: 'cert-sign' },
        h('div', { class: 'cert-sign-name' }, '區　總　監　＿＿＿＿＿＿'), h('div', { class: 'cert-sign-role' }, '筲箕灣區總監')));
      signs.appendChild(h('div', { class: 'cert-sign' },
        h('div', { class: 'cert-sign-name' }, '日期　＿＿＿＿＿＿＿＿'), h('div', { class: 'cert-sign-role' }, '簽發日期')));
      pg.appendChild(signs);
      root.appendChild(pg);
    });
    return;
  }

  /* ══ 完成報告 ══ */
  if (_compView === 'report') {
    const s = compStats(st, approved);
    const writeReport = async function () {
      if (_compBusy) return;
      const decided = (st.completion && st.completion.decided) || 0;
      if (decided < approved.length) {
        const go = await confirmDlg('⚠️ 仲有 ' + (approved.length - decided) + ' 位未評核',
          '未評核嘅學員會照寫入報告（合格與否留空）。照去？', { okText: '照寫入' });
        if (!go) return;
      }
      _compBusy = true;
      toast('寫入完成報告…');
      const cells = [];
      const push = function (row, col, value) { cells.push({ tab: TAB.COMPLETE, row: row, col: col, value: value }); };
      push(4, 3, st.sessions.map(function (x) { return x.date; }).join(', '));
      push(5, 3, s.appliedHome); push(5, 6, s.appliedAway);
      push(6, 3, s.okHome); push(6, 6, s.okAway);
      push(7, 3, s.done); push(7, 6, s.pass);
      approved.forEach(function (r, i) {
        const c = (st.completion && st.completion.byStudent[r.id]) || null;
        const row = COMP_ROW_BASE + i;
        push(row, 1, r.studentNo || '');
        push(row, 2, r.nameZh);
        push(row, 3, r.troopNo || '');
        if (c) {
          push(row, 4, c.certNo || '');
          push(row, 5, c.pass ? '合格' : '不合格');
          push(row, 6, c.pass ? '' : (c.failReason || ''));
        }
      });
      const res = await api.batch(cells, st.rev, Store.staffName() || '');
      _compBusy = false;
      if (res && res.ok) {
        Store.pushLog('complete', '完成報告寫入（統計＋' + approved.length + ' 位學員）');
        toast('✅ 完成報告已寫入（rev ' + res.data.rev + '）', 'ok');
        await Sync.refresh('silent');
      } else if (res && res.conflict) {
        await Sync.refresh('silent');
        toast('有人同時改緊——已重讀最新，再撳一次', 'warn');
      } else {
        toast('❌ ' + ((res && res.error) || '失敗'), 'err');
      }
    };
    const btnBar = h('div', { class: 'btn-row no-print', style: { marginBottom: '12px' } });
    const wBtn = h('button', { class: 'btn btn-primary' }, '💾 寫入報告（GS）');
    wBtn.addEventListener('click', function () { writeReport(); });
    btnBar.appendChild(wBtn);
    btnBar.appendChild(h('button', { class: 'btn', onclick: function () { window.print(); } }, '🖨 列印完成報告'));
    root.appendChild(btnBar);

    const doc = h('div', { class: 'doc-page report-doc' });
    doc.appendChild(h('div', { class: 'doc-org' }, '香港童軍總會 筲箕灣區'));
    doc.appendChild(h('div', { class: 'doc-title' }, esc(st.info.courseName)));
    doc.appendChild(h('div', { class: 'doc-sub' }, '訓練班完成報告'));
    doc.appendChild(h('div', { class: 'doc-line' },
      '舉辦日期：' + st.sessions.map(function (x) { return x.date; }).join(', ')));
    const sTbl = h('table', { class: 'data-table doc-stat' });
    sTbl.appendChild(h('tbody', null,
      h('tr', null, h('td', { class: 'td-strong' }, '報班人數（本區）'), h('td', { class: 'td-num' }, String(s.appliedHome)),
        h('td', { class: 'td-strong' }, '報班人數（他區）'), h('td', { class: 'td-num' }, String(s.appliedAway))),
      h('tr', null, h('td', { class: 'td-strong' }, '接納人數（本區）'), h('td', { class: 'td-num' }, String(s.okHome)),
        h('td', { class: 'td-strong' }, '接納人數（他區）'), h('td', { class: 'td-num' }, String(s.okAway))),
      h('tr', null, h('td', { class: 'td-strong' }, '完成人數'), h('td', { class: 'td-num' }, String(s.done)),
        h('td', { class: 'td-strong' }, '合格人數'), h('td', { class: 'td-num' }, String(s.pass)))));
    doc.appendChild(sTbl);
    const wrap = h('div', { class: 'table-scroll' });
    const tbl = h('table', { class: 'data-table' });
    tbl.appendChild(h('thead', null, h('tr', null,
      h('th', null, '學員編號'), h('th', null, '中文姓名'), h('th', null, '旅號'),
      h('th', null, '證書編號'), h('th', null, '合格與否'), h('th', null, '不合格原因'))));
    const tb = h('tbody', null);
    approved.forEach(function (r) {
      const c = (st.completion && st.completion.byStudent[r.id]) || null;
      tb.appendChild(h('tr', null,
        h('td', null, esc(String(r.studentNo || '—'))), h('td', { class: 'td-strong' }, esc(r.nameZh)),
        h('td', null, esc(r.troopNo || '—')), h('td', null, esc((c && c.certNo) || '—')),
        h('td', null, c ? (c.pass ? '合格' : '不合格') : '—'),
        h('td', null, esc((c && !c.pass && c.failReason) || '—'))));
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    doc.appendChild(wrap);
    doc.appendChild(h('div', { class: 'doc-sign' }, '班領導人：＿＿＿＿＿＿＿＿＿＿'));
    root.appendChild(doc);
    return;
  }

  /* ══ 領取證書 ══ */
  if (_compView === 'pickup') {
    if (!passList.length) { root.appendChild(h('div', { class: 'card empty' }, '未有合格學員——先喺「🧮 評核」評好')); return; }
    const card = h('div', { class: 'card no-print' });
    card.appendChild(h('div', { class: 'card-title' }, '📋 領取證書紀錄（' + ((st.cert && st.cert.taken) || 0) + '/' + passList.length + ' 已領）'));
    const wrap = h('div', { class: 'table-scroll' });
    const tbl = h('table', { class: 'data-table' });
    tbl.appendChild(h('thead', null, h('tr', null,
      h('th', null, '學員'), h('th', null, '證書編號'), h('th', null, '領取日期'), h('th', null, '簽收'), h('th', null, ''))));
    const tb = h('tbody', null);
    passList.forEach(function (r) {
      const c = (st.cert && st.cert.byStudent[r.id]) || null;
      const tr = h('tr', null,
        h('td', { class: 'td-strong' }, esc(String(r.studentNo || '—')) + '・' + esc(r.nameZh)),
        h('td', null, esc((c && c.certNo) || ((st.completion.byStudent[r.id] || {}).certNo) || '—')),
        h('td', null, esc((c && c.pickupDate) || '—')),
        h('td', null, c && c.signed ? '✔' : '—'));
      if (c && c.pickupDate) {
        tr.appendChild(h('td', { class: 'dim' }, '已登記'));
      } else {
        const btn = h('button', { class: 'btn btn-sm btn-ok' }, '✅ 登記領取');
        btn.addEventListener('click', async function () {
          if (_compBusy) return;
          _compBusy = true; btn.disabled = true; btn.textContent = '…';
          const res = await apiCall('setCertRow', {
            code: r.studentNo || undefined, name: r.nameZh,
            certNo: (st.completion.byStudent[r.id] || {}).certNo || '',
            pickupDate: new Date().toISOString().slice(0, 10), signed: '✔',
            by: Store.staffName() || '',
          });
          _compBusy = false;
          if (res && res.ok) {
            toast('✅ ' + r.nameZh + ' 已登記領取', 'ok');
            Store.pushLog('cert', '領取證書：' + r.nameZh);
            await Sync.refresh('silent');
          } else if (res && res.conflict) {
            await Sync.refresh('silent');
            toast('有人同時改緊——已重讀最新，再撳一次', 'warn');
          } else {
            btn.disabled = false; btn.textContent = '✅ 登記領取';
            toast('❌ ' + ((res && res.error) || '失敗'), 'err');
          }
        });
        tr.appendChild(h('td', { class: 'no-print' }, btn));
      }
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    card.appendChild(wrap);
    root.appendChild(card);

    const btnBar = h('div', { class: 'btn-row no-print', style: { margin: '12px 0' } });
    btnBar.appendChild(h('button', { class: 'btn btn-primary', onclick: function () { window.print(); } }, '🖨 列印領取紀錄'));
    root.appendChild(btnBar);

    const doc = h('div', { class: 'doc-page pickup-doc' });
    doc.appendChild(h('div', { class: 'doc-org' }, '香港童軍總會 筲箕灣區'));
    doc.appendChild(h('div', { class: 'doc-title' }, esc(st.info.courseName)));
    doc.appendChild(h('div', { class: 'doc-sub' }, '領取證書紀錄'));
    doc.appendChild(h('div', { class: 'doc-line' }, '舉辦日期：' + st.sessions.map(function (x) { return x.date; }).join(', ')));
    doc.appendChild(h('div', { class: 'doc-line' }, '班領導人：' + esc((st.leader && st.leader.name) || '＿＿＿＿＿')));
    const pw = h('div', { class: 'table-scroll' });
    const pt = h('table', { class: 'data-table' });
    pt.appendChild(h('thead', null, h('tr', null,
      h('th', null, '學員編號'), h('th', null, '中文姓名'), h('th', null, '旅號'),
      h('th', null, '證書編號'), h('th', null, '領取日期'), h('th', null, '簽收'))));
    const ptb = h('tbody', null);
    passList.forEach(function (r) {
      const c = (st.cert && st.cert.byStudent[r.id]) || null;
      ptb.appendChild(h('tr', null,
        h('td', null, esc(String(r.studentNo || '—'))), h('td', { class: 'td-strong' }, esc(r.nameZh)),
        h('td', null, esc(r.troopNo || '—')),
        h('td', null, esc((c && c.certNo) || ((st.completion.byStudent[r.id] || {}).certNo) || '')),
        h('td', null, esc((c && c.pickupDate) || '')),
        h('td', null, (c && c.signed) ? '✔' : '')));
    });
    pt.appendChild(ptb);
    pw.appendChild(pt);
    doc.appendChild(pw);
    root.appendChild(doc);
  }
});
