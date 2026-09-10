/* ============================================================
 * 63-dashboard.js — 儀表板：一條龍進度 + 課程概況 + 收生統計
 * ============================================================ */

/* ============================================================
 * 掛載流程:本機草稿 → 生成 GS 交區 → 區會批准 → 通告上網 → 成員系統報名
 * ============================================================ */

function showGsUrlModal(url) {
  const txt = h('div', { class: 'confirm-body' },
    h('div', null, '複製以下 GS 網址交區管理系統——SCRIPT 連結之後就可以觀看訓練班資料（預算／節次／時間表／通告）嚟批改；批好 tick「區會批准」，APP 會自動見到：'),
    h('div', { style: { margin: '10px 0', padding: '8px', background: '#f2f6f5', borderRadius: '8px', wordBreak: 'break-all', fontSize: '13px' } }, url || '（起表時 CourseFactory 有回就會自動填）'));
  const m2 = modal({
    title: '📋 GS 網址（交區管理系統）',
    body: txt,
    actions: [
      h('button', { class: 'btn btn-primary', onclick: async function () {
        try { await navigator.clipboard.writeText(url || ''); toast('📋 已複製——貼俾區管理層／區管理系統', 'ok'); } catch (e) { toast('複製失敗——手動揀文字複製', 'warn'); }
      } }, '📋 複製網址'),
      h('button', { class: 'btn', onclick: function () { m2.close(); } }, '完成'),
    ],
  });
}

regPage('dashboard', function (root) {
  const st = Store.state;
  if (!st) { root.appendChild(h('div', { class: 'card' }, '載入中…')); return; }
  const info = st.info;

  /* ── 🚢 掛載流程（CL 起表 → 區會批核 → 成員系統報名） ── */
  const ms = mountStatus(st);
  const course = Store.activeCourse();
  const mountCard = h('div', { class: 'card' });
  mountCard.appendChild(h('div', { class: 'card-title' }, '🚢 掛載流程（CL 起表 → 區會批核 → 成員系統報名）'));
  const mChips = h('div', { class: 'chip-row', style: { flexWrap: 'wrap' } });
  const mkChip = (ok, t) => mChips.appendChild(h('span', { class: 'fchip' + (ok ? ' active' : '') }, (ok ? '✓ ' : '○ ') + t));
  mkChip(true, '① 起 GS・CL 填寫中');
  mkChip(ms.approved, '② 區會批准');
  mkChip(!!ms.noticeUrl, '③ 通告上網');
  mkChip(ms.phase === 'mounted', '④ 成員系統報名中');
  mountCard.appendChild(mChips);
  const mRow = h('div', { class: 'btn-row', style: { marginTop: '10px', flexWrap: 'wrap' } });
  if (ms.phase === 'writing') {
    mRow.appendChild(h('span', { class: 'row-sub' }, '📝 CL 填寫中——填好開班文件＋時間表＋通告之後，記得複製 GS 網址交區管理系統（SCRIPT 連結觀看批改）'));
    if (ms.gsUrl) mRow.appendChild(h('button', { class: 'btn btn-primary btn-sm', onclick: function () { showGsUrlModal(ms.gsUrl); } }, '📋 複製 GS 網址交區'));
    if (course && course.mock) mRow.appendChild(h('button', { class: 'btn btn-sm', onclick: async function () {
      MockDemo.approveCourse(course.key); await Sync.refresh('silent'); toast('🧪 區管理層已 tick「區會批准」（演示）', 'ok'); UI.rerenderPage();
    } }, '🧪 模擬區會批准'));
  } else if (ms.phase === 'approved') {
    mRow.appendChild(h('span', { class: 'row-sub' }, '✅ 區會已批准——去「通告」生成通告（列印／文字版）交區網頁管理員；上網後區管理層貼返「通告網址」'));
    mRow.appendChild(h('button', { class: 'btn btn-primary btn-sm', onclick: function () { nav('notice'); } }, '📢 去通告'));
    if (course && course.mock) mRow.appendChild(h('button', { class: 'btn btn-sm', onclick: async function () {
      MockDemo.setNoticeUrl(course.key); await Sync.refresh('silent'); toast('🧪 區管理層已貼通告網址（演示）——正式掛載成員系統', 'ok'); UI.rerenderPage();
    } }, '🧪 模擬貼通告網址'));
  } else {
    mRow.appendChild(h('span', { class: 'row-sub' }, '🌐 通告已上網，成員系統報名進行中'));
    if (ms.noticeUrl) mRow.appendChild(h('a', { class: 'btn btn-sm', href: ms.noticeUrl, target: '_blank', rel: 'noopener' }, '📢 通告'));
    if (ms.portalUrl) mRow.appendChild(h('a', { class: 'btn btn-sm', href: ms.portalUrl, target: '_blank', rel: 'noopener' }, '🧒 成員系統報名'));
  }
  mountCard.appendChild(mRow);
  root.appendChild(mountCard);

  /* ── 一條龍進度 checklist ── */
  const steps = [
    { ok: !!(info.name && (info.intake || info.intake === 0) && (info.fee || info.fee === 0)), label: '① 開班文件 — 預算基本資料', route: 'setup' },
    { ok: !!(info.quota && st.sessions.length > 0), label: '② 開班文件 — 名額・節次・職員', route: 'setup' },
    { ok: !!(st.noticeEdits.eligibility && st.noticeEdits.feeNote && st.noticeEdits.uniform), label: '③ 通告 — 補參加資格・費用說明・服裝', route: 'notice' },
    { ok: !!(info.deadline && info.publish), label: '④ 截止報名／公佈取錄日', route: 'setup' },
    { ok: st.stats.approved > 0, label: '⑤ 收生 — 確認取錄（' + st.stats.approved + '/' + (info.quota || '?') + '）', route: 'intake' },
    { ok: st.stats.approved > 0 && st.regs.filter(r => r.status === 'approved').every(r => r.group), label: '⑥ 學員分組', route: 'roster' },
    { ok: !!(st.attend && st.attend.initialized), label: '⑦ 出席表對齊（可以開始點名）', route: 'attend' },
    { ok: financeSummary(st).used > 0, label: '⑧ 收支記錄（有支出入帳）', route: 'finance' },
    { ok: !!(st.completion && st.completion.decided > 0), label: '⑨ 完成評核（' + ((st.completion && st.completion.decided) || 0) + ' 位已評）', route: 'complete' },
  ];
  const done = steps.filter(s => s.ok).length;

  const progress = h('div', { class: 'card' },
    h('div', { class: 'card-title-row' },
      h('div', { class: 'card-title' }, '🚀 開班一條龍進度'),
      h('span', { class: 'badge-num' }, done + '/' + steps.length)),
    h('div', { class: 'progress-track' }, h('div', { class: 'progress-fill', style: { width: Math.round(done / steps.length * 100) + '%' } })),
    h('div', { class: 'steps' }, steps.map(s => h('button', {
      class: 'step' + (s.ok ? ' ok' : ''),
      onclick: () => nav(s.route),
    }, h('span', { class: 'step-dot' }, s.ok ? '✓' : '○'), h('span', { class: 'step-label' }, s.label), h('span', { class: 'step-go' }, '›')))));

  /* ── 課程資料 ── */
  const kv = (k, v) => h('tr', null, h('td', null, k), h('td', { html: v === '' || v == null ? '<span class="dim">（未填）</span>' : esc(String(v)) }));
  const courseCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '🎓 課程資料'),
    h('table', { class: 'kv-table' },
      kv('名稱', info.name),
      kv('屆別', info.edition ? info.edition + ' 屆' : ''),
      kv('支部', info.section),
      kv('專章', info.badge || info.customName),
      kv('形式', [info.type1, info.type2].filter(Boolean).join('・')),
      kv('名額', info.quota ? info.quota + ' 人' : ''),
      kv('收費', info.fee !== '' ? '$' + info.fee : ''),
      kv('截止報名', info.deadline ? fmtCNDate(info.deadline) : ''),
      kv('公佈取錄', info.publish ? fmtCNDate(info.publish) : ''),
      kv('班職員', info.staff !== '' ? info.staff + ' 人（常駐 ' + (info.resident || '—') + '）' : '')),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-sm', onclick: () => nav('setup') }, '📝 修改開班文件')));

  /* ── 收生統計 ── */
  const s = st.stats;
  const statChip = (n, label, cls) => h('div', { class: 'stat ' + (cls || '') }, h('div', { class: 'stat-n' }, String(n)), h('div', { class: 'stat-l' }, label));
  const pendingList = st.regs.filter(r => r.status === 'pending').slice(-3).reverse();
  const intakeCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '✅ 收生狀況'),
    h('div', { class: 'stat-row' },
      statChip(s.total, '總報名'), statChip(s.pending, '待批', 'amber'),
      statChip(s.approved, '已取錄', 'green'), statChip(s.rejected, '拒絕', 'red'), statChip(s.cancelled, '取消', 'gray')),
    s.quota ? h('div', { class: 'quota-line' },
      h('div', { class: 'progress-track' }, h('div', { class: 'progress-fill' + (s.approved > s.quota ? ' over' : ''), style: { width: Math.min(100, Math.round(s.approved / s.quota * 100)) + '%' } })),
      h('div', { class: 'quota-text' }, '名額 ' + s.approved + '/' + s.quota + (s.approved > s.quota ? ' ⚠️ 超收' : '（剩 ' + s.seatsLeft + '）'))) : null,
    pendingList.length ? h('div', { class: 'mini-list' },
      h('div', { class: 'row-sub', style: { marginBottom: '4px' } }, '最新待批：'),
      pendingList.map(r => h('div', { class: 'row-item compact' },
        h('div', { class: 'row-title' }, esc(r.nameZh) + '・' + esc(r['旅團'])),
        h('button', { class: 'btn btn-sm btn-primary', onclick: () => nav('intake') }, '去處理')))) : h('div', { class: 'row-sub' }, s.pending ? '' : '冇待批報名 🎉'),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-sm btn-primary', onclick: () => nav('intake') }, '➡ 去收生確認')));

  /* ── 節次 + 職員 ── */
  const sessCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '📅 節次（' + st.sessions.length + '）'),
    st.sessions.length
      ? h('div', { class: 'mini-list' }, st.sessions.map(x => h('div', { class: 'sess-item' },
          h('span', { class: 'sess-date' }, fmtShortDate(x.date)),
          h('span', { class: 'sess-time' }, esc(x.time || '—')),
          h('span', { class: 'sess-venue' }, esc(x.venue || '—')),
          x.onNotice ? h('span', { class: 'tag tag-blue' }, '上通告') : null)))
      : h('div', { class: 'row-sub' }, '未填節次（開班文件 → Input02）'));

  const leader = st.leader;
  const staffCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '👥 班職員（' + st.staff.length + '）'),
    leader ? h('div', { class: 'leader-line' }, '🏅 班領導人：' + esc(leader.name) + esc(leader.title) + (leader.qual ? '（' + esc(leader.qual) + '）' : '') + (leader.phone ? '・' + esc(leader.phone) : '')) : h('div', { class: 'row-sub' }, '未填班領導人'),
    h('div', { class: 'mini-list' }, st.staff.filter(x => x.name && x.role !== '班領導人').slice(0, 8).map(x => h('div', { class: 'row-sub' }, esc(x.role) + '・' + esc(x.name)))));

  /* ── 🔔 待辦提醒 ── */
  const todos = [];
  if (s.pending) todos.push({ icon: '⏳', txt: s.pending + ' 筆報名待批（' + (s.pendingUnpaid || 0) + ' 筆未核對收款）', act: () => { _intakeFilter = 'pending'; nav('intake'); }, urgent: true });
  if (s.approvedUnpaid) todos.push({ icon: '💰', txt: s.approvedUnpaid + ' 位已取錄學員，區會仲未核對收款', act: () => { _intakeFilter = 'unpaid'; nav('intake'); } });
  if (s.approvedNoSta) todos.push({ icon: '📄', txt: s.approvedNoSta + ' 位學員未交 STA 表格正本（上課時收）', act: () => nav('roster') });
  if (s.groupsInUse && s.ungrouped) todos.push({ icon: '👥', txt: s.ungrouped + ' 位取錄學員未分組', act: () => nav('roster') });
  if (info.deadline) {
    const days = Math.ceil((new Date(info.deadline + 'T23:59:59+08:00').getTime() - Date.now()) / 86400000);
    if (days < 0) todos.push({ icon: '📅', txt: '報名已截止（' + fmtCNDate(info.deadline) + '）——記得公佈取錄' });
    else if (days <= 7) todos.push({ icon: '📅', txt: '報名 ' + days + ' 日後截止（' + fmtCNDate(info.deadline) + '）', act: () => nav('intake') });
  }
  if (s.quota && s.approved > s.quota) todos.push({ icon: '⚠️', txt: '已超收：' + s.approved + '/' + s.quota + '——考慮取消部分接納', act: () => nav('intake'), urgent: true });
  (function () {
    if (!st.attend || !st.attend.initialized) return;
    const today = new Date();
    const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const sess = st.sessions.filter(x => x.date === iso);
    if (!sess.length) return;
    const approved = st.regs.filter(r => r.status === 'approved');
    const idx = st.sessions.indexOf(sess[0]);
    const done = approved.filter(r => (st.attend.byStudent[r.id] || [])[idx] !== '' && (st.attend.byStudent[r.id] || [])[idx] !== undefined).length;
    if (done < approved.length) todos.push({ icon: '✍️', txt: '今日（第 ' + (idx + 1) + ' 節）仲有 ' + (approved.length - done) + ' 位未點名', act: () => { _attendSess = idx + 1; nav('attend'); }, urgent: true });
  })();
  if (!todos.length) todos.push({ icon: '🎉', txt: '冇待辦事項——一切正常', done: true });
  const todoCard = h('div', { class: 'card' },
    h('div', { class: 'card-title-row' }, h('div', { class: 'card-title' }, '🔔 職員待辦'),
      todos.some(t => t.urgent) ? h('span', { class: 'badge-num pulse' }, '!') : null),
    h('div', { class: 'steps' }, todos.map(t => h('button', {
      class: 'step todo' + (t.done ? ' ok' : '') + (t.urgent ? ' urgent' : ''),
      onclick: t.act || null,
    }, h('span', { class: 'step-dot' }, t.icon), h('span', { class: 'step-label' }, t.txt)))));

  root.appendChild(progress);
  root.appendChild(todoCard);
  root.appendChild(h('div', { class: 'grid-2' }, courseCard, h('div', null, intakeCard)));
  root.appendChild(h('div', { class: 'grid-2' }, sessCard, staffCard));
});
