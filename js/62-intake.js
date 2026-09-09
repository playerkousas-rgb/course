/* ============================================================
 * 62-intake.js — 收生確認（一條龍第①步實戰）
 * 名單 → 睇詳情＋入數紙 → 接納/拒絕/取消（記批核人+時間）
 * setRegStatus 係 identity 定位（時間戳記），多人同時批唔會錯行
 * ============================================================ */

let _intakeFilter = 'pending';
let _intakeSearch = '';
const _intakeSel = new Set();
const _busyIds = new Set();

async function intakeSetStatus(reg, status, opts) {
  opts = opts || {};
  if (_busyIds.has(reg.id)) { toast('處理中，等等…', 'warn'); return false; }
  const st = Store.state;
  if (status === 'approved' && st && st.stats.quota > 0 && st.stats.approved + 1 > st.stats.quota && !opts.skipQuota) {
    const go = await confirmDlg('⚠️ 已超名額',
      '名額 ' + st.stats.quota + ' 人，已取錄 ' + st.stats.approved + ' 人。再接納 ' + reg.nameZh + ' 會超收——確定？',
      { danger: true, okText: '照樣接納' });
    if (!go) return false;
  } else if (!opts.noConfirm) {
    const labels = { approved: '接納', rejected: '拒絕', cancelled: '取消', pending: '還原做待批' };
    const go = await confirmDlg(labels[status] + '報名',
      '確定' + labels[status] + '「' + reg.nameZh + '」（' + reg['旅團'] + '）？' +
      (status === 'rejected' ? '\n按程序：拒絕後區會會辦理退款並銷毀個人資料。' : '') +
      '\n記錄會以「' + (Store.staffName() || '未知職員') + '」名義寫入。');
    if (!go) return false;
  }
  _busyIds.add(reg.id);
  toast('處理中…');
  const res = await apiCall('setRegStatus', { id: reg.id, status: status, reviewer: Store.staffName() || '' });
  _busyIds.delete(reg.id);
  if (res && res.ok) {
    Store.pushLog('status', STATUS_INFO[status].label + '報名：' + reg.nameZh + '（' + (reg.refCode || reg.id) + '）');
    toast('✅ ' + reg.nameZh + ' 已' + STATUS_INFO[status].label, 'ok');
    await Sync.refresh('silent');
    return true;
  }
  toast('❌ ' + ((res && res.error) || '失敗'), 'err');
  return false;
}

async function intakeBatchApprove() {
  const ids = Array.from(_intakeSel);
  if (!ids.length) return;
  const st = Store.state;
  const regs = ids.map(id => st.regs.filter(r => r.id === id)[0]).filter(Boolean);
  const willOver = st.stats.quota > 0 && (st.stats.approved + regs.length) > st.stats.quota;
  const go = await confirmDlg('批量接納 ' + regs.length + ' 人',
    (willOver ? '⚠️ 會超名額（' + st.stats.quota + '）！\n\n' : '') +
    regs.map(r => '・' + r.nameZh + '（' + r['旅團'] + '）').join('\n') +
    '\n\n以「' + (Store.staffName() || '未知職員') + '」名義逐筆寫入。', { danger: willOver, okText: '全部接納' });
  if (!go) return;

  const prog = h('div', { class: 'progress-track' }, h('div', { class: 'progress-fill', style: { width: '0%' } }));
  const line = h('div', { class: 'row-sub', style: { marginTop: '8px' } }, '準備…');
  const m = modal({ title: '⏳ 批量接納中', dismissable: false, body: h('div', {}, prog, line) });
  let ok = 0, fail = 0;
  for (let i = 0; i < regs.length; i++) {
    line.textContent = '(' + (i + 1) + '/' + regs.length + ') ' + regs[i].nameZh + '…';
    prog.firstChild.style.width = Math.round((i) / regs.length * 100) + '%';
    const res = await apiCall('setRegStatus', { id: regs[i].id, status: 'approved', reviewer: Store.staffName() || '' });
    if (res && res.ok) { ok++; Store.pushLog('status', '接納報名：' + regs[i].nameZh); }
    else { fail++; toast('❌ ' + regs[i].nameZh + '：' + ((res && res.error) || '失敗'), 'err'); }
  }
  prog.firstChild.style.width = '100%';
  line.textContent = '完成：成功 ' + ok + '・失敗 ' + fail;
  _intakeSel.clear();
  await Sync.refresh('silent');
  setTimeout(() => m.close(), 700);
}

function intakeDetail(reg) {
  const F = (label, v) => h('tr', null, h('td', null, label), h('td', { html: v ? esc(String(v)) : '<span class="dim">—</span>' }));
  const yn = (v) => v === 'TRUE' || v === true ? '✅ 已同意' : '❌ 未同意';
  const linkBtn = (url, label) => url
    ? h('a', { class: 'btn btn-sm', href: url, target: '_blank', rel: 'noopener' }, '🔗 ' + label)
    : h('span', { class: 'dim' }, '（無）');

  const body = h('div', {},
    h('div', { class: 'detail-head' },
      h('div', { class: 'detail-name' }, esc(reg.nameZh), reg.nameEn ? h('span', { class: 'dim' }, ' ' + esc(reg.nameEn)) : null),
      h('span', { class: 'chip-st ' + STATUS_INFO[reg.status].cls }, STATUS_INFO[reg.status].label),
      reg.status === 'approved' && reg.studentNo !== '' ? h('span', { class: 'tag tag-blue' }, '學員編號 ' + esc(reg.studentNo)) : null,
      reg.group ? h('span', { class: 'tag' }, esc(reg.group)) : null),
    h('table', { class: 'kv-table' },
      F('報名編號', reg.refCode), F('報名時間', fmtDT(reg.submittedAt)),
      F('批核人', reg.reviewer), F('批核時間', fmtDT(reg.reviewedAt))),
    h('div', { class: 'card-in' }, h('div', { class: 'card-title' }, '👦 學員資料'),
      h('table', { class: 'kv-table' },
        F('中文姓名', reg['中文姓名']), F('英文姓名', reg['英文姓名']), F('性別', reg['性別']),
        F('出生日期', reg['出生日期']), F('聯絡電話', reg['聯絡電話']), F('電郵', reg['電郵地址']),
        F('附加資料', reg['附加資料(有助訓練班取錄之原因)']))),
    h('div', { class: 'card-in' }, h('div', { class: 'card-title' }, '🎖️ 童軍資料'),
      h('table', { class: 'kv-table' },
        F('所屬童軍區', reg['所屬童軍區']), F('旅團', reg['旅團']), F('旅號', reg.troopNo),
        F('ScoutID', reg['童軍成員編號（ScoutID）']), F('童軍職位', reg['童軍職位']))),
    h('div', { class: 'card-in' }, h('div', { class: 'card-title' }, '👪 家長／監護人'),
      h('table', { class: 'kv-table' },
        F('同意', yn(reg['家長／監護人同意參與有關活動。'])), F('姓名', reg['家長/監護人姓名']),
        F('關係', reg['與申請人關係']), F('電話', reg['家長/監護人聯絡電話']), F('電郵', reg['家長/監護人聯絡電郵']))),
    h('div', { class: 'card-in' }, h('div', { class: 'card-title' }, '🧭 旅團領袖'),
      h('table', { class: 'kv-table' },
        F('同意', yn(reg['所屬童軍旅領袖同意參與有關活動。'])), F('姓名', reg['領袖姓名（中文全名）']),
        F('職位', reg['領袖職位']), F('電郵', reg['領袖聯絡電郵']))),
    h('div', { class: 'card-in' }, h('div', { class: 'card-title' }, '💰 付款'),
      h('table', { class: 'kv-table' },
        F('付款方式', reg['付款方式']), F('付款人', reg['付款人姓名']), F('付款帳戶', reg['付款帳戶']),
        F('需要收據', reg['是否需要收據'])),
      h('div', { class: 'btn-row' },
        linkBtn(reg.receiptUrl, '入數紙（Drive）'),
        linkBtn(reg.formUrl, '已填表格截圖'))),
    reg['備註'] ? h('div', { class: 'card-in' }, h('div', { class: 'card-title' }, '📝 備註'), esc(reg['備註'])) : null);

  const actions = [];
  if (reg.status !== 'approved') actions.push(h('button', { class: 'btn btn-primary', onclick: async () => { m.close(); await intakeSetStatus(reg, 'approved'); } }, '✔ 接納'));
  if (reg.status === 'pending') actions.push(h('button', { class: 'btn btn-danger', onclick: async () => { m.close(); await intakeSetStatus(reg, 'rejected'); } }, '✗ 拒絕'));
  if (reg.status !== 'cancelled' && reg.status !== 'pending') actions.push(h('button', { class: 'btn', onclick: async () => { m.close(); await intakeSetStatus(reg, 'cancelled', { noConfirm: false }); } }, '🚫 取消'));
  if (reg.status !== 'pending') actions.push(h('button', { class: 'btn btn-ghost', onclick: async () => { m.close(); await intakeSetStatus(reg, 'pending'); } }, '↩ 還原待批'));
  actions.push(h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, '關閉'));

  const m = modal({ title: '📋 報名詳情', wide: true, body: body, actions: actions });
}

regPage('intake', function (root) {
  const st = Store.state;
  if (!st) { root.appendChild(h('div', { class: 'card' }, '載入中…')); return; }
  const s = st.stats;

  /* 篩選 chips */
  const chips = h('div', { class: 'chip-row' });
  [['all', '全部 ' + s.total], ['pending', '待批 ' + s.pending], ['approved', '已取錄 ' + s.approved],
   ['rejected', '拒絕 ' + s.rejected], ['cancelled', '取消 ' + s.cancelled]].forEach(([k, label]) => {
    chips.appendChild(h('button', {
      class: 'fchip' + (_intakeFilter === k ? ' active' : '') + (k === 'pending' && s.pending ? ' pulse' : ''),
      onclick: () => { _intakeFilter = k; UI.rerenderPage(); },
    }, label));
  });

  const searchIn = h('input', { class: 'input', type: 'search', placeholder: '搜尋姓名／旅團／電郵／電話／編號…', value: _intakeSearch });
  searchIn.addEventListener('input', () => { _intakeSearch = searchIn.value.trim(); });
  searchIn.addEventListener('change', () => UI.rerenderPage());

  root.appendChild(h('div', { class: 'page-head no-print' },
    h('div', { class: 'card-title' }, '✅ 收生確認'),
    h('div', { class: 'row-sub' }, '接納後學員編號會按報名次序自動編配；各張 Print 名單自動更新'),
    chips, searchIn));

  /* 批量 bar */
  if (_intakeSel.size) {
    root.appendChild(h('div', { class: 'batch-bar no-print' },
      h('span', null, '已揀 ' + _intakeSel.size + ' 人'),
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => intakeBatchApprove() }, '✔ 批量接納'),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { _intakeSel.clear(); UI.rerenderPage(); } }, '清除')));
  }

  /* 名單 */
  let regs = st.regs.slice().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  if (_intakeFilter !== 'all') regs = regs.filter(r => r.status === _intakeFilter);
  if (_intakeSearch) {
    const q = _intakeSearch.toLowerCase();
    regs = regs.filter(r =>
      (r.nameZh + r.nameEn + r['旅團'] + r['電郵地址'] + r['聯絡電話'] + r.refCode + r['所屬童軍區']).toLowerCase().indexOf(q) >= 0);
  }

  if (!regs.length) {
    root.appendChild(h('div', { class: 'card empty' },
      _intakeFilter === 'pending' ? '🎉 冇待批報名——收生完成或未開始' : '冇符合條件嘅報名'));
    return;
  }

  const list = h('div', { class: 'reg-list' });
  regs.forEach(reg => {
    const sel = h('input', { type: 'checkbox' });
    sel.checked = _intakeSel.has(reg.id);
    sel.addEventListener('change', () => {
      if (sel.checked) _intakeSel.add(reg.id); else _intakeSel.delete(reg.id);
      UI.rerenderPage(true);   /* 顯示/更新批量 bar，keep scroll 唔好彈返頂 */
    });

    const actions = [];
    if (reg.status !== 'approved') actions.push(h('button', { class: 'btn btn-sm btn-primary', onclick: () => intakeSetStatus(reg, 'approved') }, '✔ 接納'));
    if (reg.status === 'pending') actions.push(h('button', { class: 'btn btn-sm btn-danger', onclick: () => intakeSetStatus(reg, 'rejected') }, '✗ 拒絕'));
    if (reg.status !== 'cancelled' && reg.status !== 'pending') actions.push(h('button', { class: 'btn btn-sm', onclick: () => intakeSetStatus(reg, 'cancelled') }, '🚫 取消'));
    if (reg.status !== 'pending') actions.push(h('button', { class: 'btn btn-sm btn-ghost', onclick: () => intakeSetStatus(reg, 'pending') }, '↩ 待批'));

    list.appendChild(h('div', { class: 'card reg-card' },
      h('div', { class: 'reg-head' },
        reg.status === 'pending' ? sel : null,
        h('div', { class: 'reg-name', onclick: () => intakeDetail(reg) }, esc(reg.nameZh),
          reg.nameEn ? h('span', { class: 'dim' }, '・' + esc(reg.nameEn)) : null),
        h('span', { class: 'chip-st ' + STATUS_INFO[reg.status].cls }, STATUS_INFO[reg.status].label),
        reg.status === 'approved' && reg.studentNo !== '' ? h('span', { class: 'tag tag-blue' }, '#' + esc(reg.studentNo)) : null,
        reg.group ? h('span', { class: 'tag' }, esc(reg.group)) : null),
      h('div', { class: 'reg-sub' },
        esc(reg['旅團'] || '—') + '・' + esc(reg['所屬童軍區'] || '—') + '・' + esc(reg['性別'] || '—') + '・' + esc(reg['聯絡電話'] || '—')),
      h('div', { class: 'reg-sub dim' },
        (reg['付款方式'] || '—') + (reg['付款人姓名'] ? '・' + esc(reg['付款人姓名']) : '') + '・' + fmtDT(reg.submittedAt) + (reg.refCode ? '・' + esc(reg.refCode) : '')),
      h('div', { class: 'reg-actions no-print' },
        h('button', { class: 'btn btn-sm', onclick: () => intakeDetail(reg) }, '📋 詳情'),
        reg.receiptUrl ? h('a', { class: 'btn btn-sm', href: reg.receiptUrl, target: '_blank', rel: 'noopener' }, '🧾 入數紙') : null,
        actions)));
  });
  root.appendChild(list);
});
