/* ============================================================
 * 66-finance.js — 收支表（數碼化記帳）
 * 支出：Input04（收據 1-35・B茶點…J設備）＋ addExpenseRow 入帳（唔撞 rev）
 * 收入：班費×取錄人數自動計＋已核對收款實收；盈虧即時計
 * ============================================================ */

/* Input04 支出欄（B-J 類別 + K 備註；收據行 8-42） */
const FIN_COLS = [
  ['B', '茶點'], ['C', '膳食津貼'], ['D', '職員膳食'], ['E', '住宿'], ['F', '交通'],
  ['G', '行政'], ['H', '講義及快勞'], ['I', '其他'], ['J', '設備'],
];
const FIN_ROW_START = 8, FIN_ROW_END = 42;

/* 解析 Input04 → { rows:[{row,no,amounts:{B..J},note}], totals:{B..J}, grand, used } */
function financeSummary(st) {
  const out = { rows: [], totals: {}, grand: 0, used: 0 };
  const grid = st && st.raw && st.raw.input04;
  if (!Array.isArray(grid)) return out;
  const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[$,]/g, '')); return Number.isFinite(n) ? n : 0; };
  for (let r = FIN_ROW_START; r <= FIN_ROW_END; r++) {
    const row = grid[r - 1];
    if (!row) break;
    const amounts = {};
    let has = false;
    FIN_COLS.forEach(([L]) => {
      const v = String(row[L.charCodeAt(0) - 65] == null ? '' : row[L.charCodeAt(0) - 65]).trim();
      amounts[L] = v;
      if (v !== '') { has = true; out.totals[L] = (out.totals[L] || 0) + num(v); out.grand += num(v); }
    });
    const note = String(row[10] == null ? '' : row[10]).trim();
    if (!has && !note) continue;
    out.used++;
    out.rows.push({ row: r, no: String(row[0] == null ? '' : row[0]).trim(), amounts: amounts, note: note });
  }
  return out;
}

/* ── Input01 預算 → 每大類（照模版公式等效計；職員/學員人數取 Input01 B11/B13） ── */
function budgetSummary(st) {
  const out = { sections: [], total: 0 };
  const g = st && st.raw && st.raw.input01;
  if (!Array.isArray(g)) return out;
  const num = (r, c) => {
    const v = shCell(g, r, c);
    const n = Number(String(v == null ? '' : v).replace(/[$,]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const staffN = Number(st.info.staff) || 0;
  const intakeN = Number(st.info.intake) || 0;
  const sec = (key, label, mapTo, budget) => { out.sections.push({ key: key, label: label, mapTo: mapTo, budget: Math.round(budget * 100) / 100 }); out.total += budget; };

  let v = 0;
  IN1_MEALS.rows.forEach((r) => {
    const per = num(r, IN1_MEALS.breakfast) + num(r, IN1_MEALS.lunch) + num(r, IN1_MEALS.dinner) + num(r, IN1_MEALS.snack) + num(r, IN1_MEALS.water);
    if (!per) return;
    const who = String(shCell(g, r, IN1_MEALS.who) || '');
    v += per * (who.indexOf('職員') >= 0 ? staffN : intakeN);
  });
  sec('meal', '1. 膳食', ['B', 'C', 'D'], v);

  v = 0;
  IN1_RENT.rows.forEach((r) => { const q = num(r, IN1_RENT.qty), p = num(r, IN1_RENT.price); if (q && p) v += q * p; });
  IN1_RENT_EXTRA.rows.forEach((r) => { if (!num(r, IN1_RENT.qty)) v += num(r, IN1_RENT_EXTRA.amount); });
  [IN1_CAMP, IN1_LODGE].forEach((m) => m.rows.forEach((r) => {
    const n2 = num(r, m.nights), pp = num(r, m.people), pr = num(r, m.price);
    if (n2 && pp && pr) v += n2 * pp * pr;
  }));
  sec('rent', '2. 租金（場租＋露營＋住宿）', ['E'], v);

  v = 0;
  IN1_TRANSPORT.forEach((t) => t.rows.forEach((r) => { v += num(r, IN1_TRANSPORT_COLS.budget); }));
  sec('transport', '3. 交通', ['F'], v);

  v = 0;
  IN1_HANDOUTS.rows.forEach((r) => { v += num(r, IN1_HANDOUTS.qty) * num(r, IN1_HANDOUTS.price); });
  sec('handouts', '4. 講義及快勞', ['H'], v);

  v = 0;
  IN1_PROGRAMME.rows.forEach((r) => { v += num(r, IN1_PROGRAMME.qty) * num(r, IN1_PROGRAMME.price); });
  sec('programme', '5. 節目', ['I'], v);

  v = 0;
  IN1_ADMIN.rows.forEach((r) => { v += num(r, IN1_ADMIN.qty) * num(r, IN1_ADMIN.price); });
  sec('admin', '6. 行政', ['G'], v);

  v = 0;
  IN1_SOUVENIR.rows.forEach((r) => { v += num(r, IN1_SOUVENIR.qty) * num(r, IN1_SOUVENIR.price); });
  sec('souvenir', '7. 紀念品', ['I'], v);

  v = 0;
  IN1_MISC.rows.forEach((r) => { v += num(r, IN1_MISC.amount); });
  sec('misc', '8. 其他', ['I'], v);

  out.total = Math.round(out.total * 100) / 100;
  return out;
}

let _finBusy = false;

/* 新增支出（addExpenseRow：append-only，唔檢查 rev，唔會撞其他職員） */
function financeAdd(st) {
  const inputs = {};
  const body = h('div', {});
  body.appendChild(h('div', { class: 'row-sub' }, '逐張收據入帳——會寫去 Input04 支出表下一個空行（收據編號自動），唔會撞到其他人同時入帳。'));
  const grid = h('div', { class: 'fin-form' });
  FIN_COLS.forEach(([L, label]) => {
    const inp = h('input', { class: 'input', type: 'number', step: '0.01', min: '0', placeholder: '0.00', inputmode: 'decimal' });
    inputs[L] = inp;
    grid.appendChild(h('div', { class: 'field' }, h('label', { class: 'flabel' }, label), inp));
  });
  body.appendChild(grid);
  const noteIn = h('input', { class: 'input', type: 'text', placeholder: '例：10月17日茶點（24人×$5）' });
  body.appendChild(h('div', { class: 'field' }, h('label', { class: 'flabel' }, '備註'), noteIn));
  const msg = h('div', { class: 'form-msg' });

  const m = modal({ title: '➕ 新增支出', wide: true, body: body, actions: [
    h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, '取消'),
    h('button', { class: 'btn btn-primary', onclick: async () => {
      if (_finBusy) return;
      const amounts = {};
      let any = false;
      FIN_COLS.forEach(([L]) => {
        const v = String(inputs[L].value || '').trim();
        if (v !== '') { amounts[L] = v; any = true; }
      });
      const note = noteIn.value.trim();
      if (!any && !note) { msg.textContent = '至少填一個金額或備註。'; msg.className = 'form-msg err'; return; }
      _finBusy = true; msg.textContent = '入帳中…'; msg.className = 'form-msg';
      const res = await apiCall('addExpenseRow', { amounts: amounts, note: note });
      _finBusy = false;
      if (res && res.ok) {
        m.close();
        Store.pushLog('finance', '支出入帳：收據 #' + res.data.receiptNo + '（$' + FIN_COLS.reduce((s2, [L]) => s2 + (Number(amounts[L]) || 0), 0) + '）');
        toast('✅ 已入帳——收據編號 ' + res.data.receiptNo + '（Input04 第 ' + res.data.row + ' 行）', 'ok');
        await Sync.refresh('silent');
      } else {
        msg.textContent = (res && res.error) || '入帳失敗';
        msg.className = 'form-msg err';
      }
    } }, '💾 入帳'),
  ] });
}

regPage('finance', function (root) {
  const st = Store.state;
  if (!st) { root.appendChild(h('div', { class: 'card' }, '載入中…')); return; }
  const fin = financeSummary(st);
  const fee = Number(st.info.fee) || 0;
  const approved = st.stats.approved;
  const confirmed = st.regs.filter(r => r.status === 'approved' && r.pcheck).length;
  const incomeDue = fee * approved;
  const incomeGot = fee * confirmed;
  const balance = incomeDue - fin.grand;

  /* 統計卡 */
  const head = h('div', { class: 'page-head no-print' });
  head.appendChild(h('div', { class: 'card-title' }, '💵 收支表'));
  head.appendChild(h('div', { class: 'row-sub' }, '支出逐筆入帳（Input04 收據 1-35）；收入＝班費自動計；全部數碼化，唔使印刷'));
  const stats = h('div', { class: 'stat-row' });
  const stat = (n, l, cls) => h('div', { class: 'stat ' + (cls || '') }, h('div', { class: 'stat-n' }, String(n)), h('div', { class: 'stat-l' }, l));
  stats.appendChild(stat('$' + fin.grand, '總支出'));
  stats.appendChild(stat('$' + incomeDue, '應收班費（' + approved + '×$' + fee + '）'));
  stats.appendChild(stat('$' + incomeGot, '已核實（' + confirmed + ' 位💰✔）', 'green'));
  stats.appendChild(stat((balance >= 0 ? '$' : '-$') + Math.abs(balance), balance >= 0 ? '盈餘（未計津貼）' : '不敷', balance >= 0 ? 'green' : 'red'));
  stats.appendChild(stat(fin.used + '/35', '收據', fin.used >= 30 ? 'amber' : ''));
  head.appendChild(stats);
  const btns = h('div', { class: 'btn-row' });
  btns.appendChild(h('button', { class: 'btn btn-sm btn-primary', onclick: () => financeAdd(st) }, '➕ 新增支出'));
  btns.appendChild(h('button', { class: 'btn btn-sm', onclick: () => window.print() }, '🖨️ 列印收支表'));
  if (st.stats.approvedUnpaid) {
    btns.appendChild(h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { _intakeFilter = 'unpaid'; nav('intake'); } }, '💰 ' + st.stats.approvedUnpaid + ' 位未核對收款'));
  }
  head.appendChild(btns);
  if (fin.used >= 30) {
    head.appendChild(h('div', { class: 'form-msg warn' }, '⚠️ 收據行用了 ' + fin.used + '/35——快滿，啲細數可以合併入一張'));
  }
  root.appendChild(head);

  /* ── 預算對比（邊項仲有幾錢使） ── */
  const bud = budgetSummary(st);
  const budCard = h('div', { class: 'card fin-screen' });
  budCard.appendChild(h('div', { class: 'card-title' }, '📋 預算 vs 實際（Input01 預算・Input04 支出）'));
  const bWrap = h('div', { class: 'table-scroll' });
  const bTbl = h('table', { class: 'data-table' });
  bTbl.appendChild(h('thead', null, h('tr', null,
    h('th', null, '預算分類'), h('th', null, '預算'), h('th', null, '已使'), h('th', null, '剩餘'), h('th', null, '對應支出欄'))));
  const bTb = h('tbody', null);
  let budTotal = 0, spentTotal = 0;
  bud.sections.forEach((x) => {
    const spent = x.mapTo.reduce((s2, L) => s2 + (fin.totals[L] || 0), 0);
    budTotal += x.budget; spentTotal += spent;
    const left = x.budget - spent;
    const tr = h('tr', null,
      h('td', { class: 'td-strong' }, esc(x.label)),
      h('td', { class: 'td-num' }, '$' + x.budget),
      h('td', { class: 'td-num' }, '$' + Math.round(spent * 100) / 100),
      h('td', { class: 'td-num td-strong' + (left < 0 ? ' text-red' : '') }, (left < 0 ? '-$' : '$') + Math.abs(Math.round(left * 100) / 100)),
      h('td', { class: 'td-small dim' }, x.mapTo.join('＋')));
    bTb.appendChild(tr);
  });
  const jSpent = fin.totals['J'] || 0;
  if (jSpent) {
    bTb.appendChild(h('tr', null,
      h('td', { class: 'td-strong' }, '設備（資本性・冇預算欄）'),
      h('td', { class: 'td-num dim' }, '—'),
      h('td', { class: 'td-num' }, '$' + jSpent),
      h('td', { class: 'td-num dim' }, '—'),
      h('td', { class: 'td-small dim' }, 'J')));
  }
  const bTr = h('tr', null, h('td', { class: 'td-total' }, '合計'));
  bTr.appendChild(h('td', { class: 'td-total td-num' }, '$' + bud.total));
  bTr.appendChild(h('td', { class: 'td-total td-num' }, '$' + fin.grand));
  bTr.appendChild(h('td', { class: 'td-total td-num' + (bud.total - fin.grand < 0 ? ' text-red' : '') }, '$' + Math.round((bud.total - fin.grand) * 100) / 100));
  bTr.appendChild(h('td', { class: 'td-total td-small' }, ''));
  bTb.appendChild(bTr);
  bTbl.appendChild(bTb);
  bWrap.appendChild(bTbl);
  budCard.appendChild(bWrap);
  budCard.appendChild(h('div', { class: 'row-sub' }, '剩餘＝預算−實際支出（紅字＝超支）；節目・紀念品・其他共用「I 其他」支出欄；設備（J）係資本性支出，預算要另批'));
  root.appendChild(budCard);

  /* 支出表 */
  const card = h('div', { class: 'card fin-screen' });
  card.appendChild(h('div', { class: 'card-title' }, '🧾 支出記錄（' + fin.rows.length + ' 筆）'));
  if (!fin.rows.length) {
    card.appendChild(h('div', { class: 'row-sub' }, '未有支出記錄——買咗嘢就即時入帳，第時唔使執爛數'));
  } else {
    const wrap = h('div', { class: 'table-scroll' });
    const tbl = h('table', { class: 'data-table fin-table print-doc' });
    const hr = h('tr', null, h('th', null, '收據'));
    FIN_COLS.forEach(([L, label]) => hr.appendChild(h('th', null, label)));
    hr.appendChild(h('th', null, '備註'));
    tbl.appendChild(h('thead', null, hr));
    const tb = h('tbody', null);
    fin.rows.forEach((r) => {
      const tr = h('tr', null);
      tr.appendChild(h('td', { class: 'td-idx' }, esc(r.no || r.row - 7)));
      FIN_COLS.forEach(([L]) => {
        const v = r.amounts[L];
        tr.appendChild(h('td', { class: v !== '' ? 'td-num' : 'td-empty' }, v !== '' ? esc(v) : ''));
      });
      tr.appendChild(h('td', { class: 'td-small' }, esc(r.note || '')));
      tb.appendChild(tr);
    });
    const trT = h('tr', null, h('td', { class: 'td-total' }, '合計'));
    FIN_COLS.forEach(([L]) => trT.appendChild(h('td', { class: 'td-total td-num' }, fin.totals[L] ? '$' + fin.totals[L] : '')));
    trT.appendChild(h('td', { class: 'td-total' }, '$' + fin.grand));
    tb.appendChild(trT);
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    card.appendChild(wrap);
  }
  root.appendChild(card);

  /* 收入明細 */
  const inc = h('div', { class: 'card fin-screen' });
  inc.appendChild(h('div', { class: 'card-title' }, '💰 收入'));
  const it = h('table', { class: 'kv-table' });
  const kvRow = (k, v) => h('tr', null, h('td', null, k), h('td', { class: 'td-strong' }, v));
  it.appendChild(kvRow('班費應收', '$' + fee + ' × ' + approved + ' 位取錄 ＝ $' + incomeDue));
  it.appendChild(kvRow('已核對收款（區會帳戶實收）', confirmed + ' 位 💰✔ ＝ $' + incomeGot + (approved - confirmed ? '（仲有 ' + (approved - confirmed) + ' 位未核對）' : ' ✅')));
  it.appendChild(kvRow('津貼／其他收入', '如有請喺完成報告一併申報（總會資助計劃分頁）'));
  it.appendChild(kvRow('盈餘／（不敷）', (balance >= 0 ? '$' : '（$') + Math.abs(balance) + (balance >= 0 ? '' : '）') + '（未計津貼）'));
  inc.appendChild(it);
  root.appendChild(inc);

  /* 列印版（doc-page，跟 Print_收支紀錄 精神但數碼版） */
  const doc = h('div', { class: 'print-only' });
  const dp = h('div', { class: 'doc-page' });
  dp.appendChild(h('div', { class: 'doc-center', style: { fontSize: '15px', fontWeight: '700' } }, '香港童軍總會　筲箕灣區'));
  dp.appendChild(h('div', { class: 'doc-center doc-title', style: { textDecoration: 'none' } }, esc(st.info.name || '')));
  dp.appendChild(h('div', { class: 'doc-center doc-h2' }, '訓 練 班 收 支 計 算 表'));
  const dKv = h('table', { class: 'kv-table', style: { margin: '8px 0 16px' } });
  dKv.appendChild(kvRow('班期', st.sessions.map(s => fmtShortDate(s.date)).join('、')));
  dKv.appendChild(kvRow('職員／學員', st.staff.length + ' 人／' + approved + ' 人'));
  dp.appendChild(dKv);
  const dWrap = h('div', {});
  const dTbl = h('table', { class: 'data-table' });
  const dhr = h('tr', null, h('th', null, '收據'));
  FIN_COLS.forEach(([, label]) => dhr.appendChild(h('th', null, label)));
  dhr.appendChild(h('th', null, '備註'));
  dTbl.appendChild(h('thead', null, dhr));
  const dtb = h('tbody', null);
  fin.rows.forEach((r) => {
    const tr = h('tr', null);
    tr.appendChild(h('td', { style: { textAlign: 'center' } }, esc(r.no || '')));
    FIN_COLS.forEach(([L]) => tr.appendChild(h('td', { style: { textAlign: 'right' } }, r.amounts[L] !== '' ? esc(r.amounts[L]) : '')));
    tr.appendChild(h('td', null, esc(r.note || '')));
    dtb.appendChild(tr);
  });
  const dtr = h('tr', null, h('td', { style: { fontWeight: '700' } }, '支出合計'));
  FIN_COLS.forEach(() => dtr.appendChild(h('td', null, '')));
  dtr.appendChild(h('td', { style: { fontWeight: '700' } }, '$' + fin.grand));
  dtb.appendChild(dtr);
  const itr = h('tr', null, h('td', { colspan: 2, style: { fontWeight: '700' } }, '收入：班費 $' + fee + ' × ' + approved + ' ＝ $' + incomeDue));
  FIN_COLS.forEach(() => itr.appendChild(h('td', null, '')));
  itr.appendChild(h('td', null, ''));
  dtb.appendChild(itr);
  const btr = h('tr', null, h('td', { colspan: 2, style: { fontWeight: '700' } }, '盈餘／（不敷）'));
  FIN_COLS.forEach(() => btr.appendChild(h('td', null, '')));
  btr.appendChild(h('td', { style: { fontWeight: '700' } }, (balance >= 0 ? '$' : '($') + Math.abs(balance) + (balance >= 0 ? '' : ')')));
  dtb.appendChild(btr);
  dTbl.appendChild(dtb);
  dWrap.appendChild(dTbl);
  dp.appendChild(dWrap);
  dp.appendChild(h('div', { class: 'doc-sign', style: { textAlign: 'right', marginTop: '30px', fontSize: '14px' } },
    '計算：＿＿＿＿＿＿（班務行政）　核對：＿＿＿＿＿＿（班領導人）',
    h('div', { style: { marginTop: '12px' } }, '認可：＿＿＿＿＿＿ DDC(T)　＿＿＿＿＿＿ DC')));
  doc.appendChild(dp);
  root.appendChild(doc);
});
