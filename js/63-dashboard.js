/* ============================================================
 * 63-dashboard.js — 儀表板：一條龍進度 + 課程概況 + 收生統計
 * ============================================================ */

/* ============================================================
 * 掛載流程:本機草稿 → 生成 GS 交區 → 區會批准 → 通告上網 → 成員系統報名
 * ============================================================ */

/* 收集草稿班全部有料嘅格(寫入新生成嘅 GS;Input02 自動中文日期欄係公式,跳過) */
function draftCells(st) {
  const cells = [];
  [['input01', TAB.IN1], ['input02', TAB.IN2], ['input03', TAB.IN3], ['notice', TAB.NOTICE]].forEach(function (pair) {
    const g = st && st.raw && st.raw[pair[0]];
    if (!Array.isArray(g)) return;
    for (let r = 0; r < g.length && r < 150; r++) {
      const row = g[r] || [];
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (v === '' || v == null) continue;
        const col = c + 1;
        if (pair[0] === 'input02' && col === IN2_SESSIONS.autoCN) continue;
        cells.push({ tab: pair[1], row: r + 1, col: col, value: v });
      }
    }
  });
  return cells;
}

function gsValidate() {
  const st = Store.state;
  const course = Store.activeCourse();
  if (!course) return null;
  if (!course.mock) { toast('呢班已經連住真 GS，唔使再生成', 'warn'); return null; }
  if (st && st.raw && st.raw.submitted && st.raw.submitted.url) { toast('已生成咗 GS——' + st.raw.submitted.url, 'warn'); return null; }
  if (!st || !st.info || !st.info.name) { toast('請先喺「開班文件」填課程名稱', 'err'); nav('setup'); return null; }
  if (!st.sessions.length) { toast('請先喺「開班文件」填節次（Input02）', 'err'); nav('setup'); return null; }
  if (Store.draftCount()) { toast('有未存草稿——先撳右上角 💾 寫入，再生成 GS', 'warn'); return null; }
  return st;
}

/* 演示路:mock 標記 submitted */
async function generateGsMock() {
  const st = gsValidate();
  if (!st) return;
  const go = await confirmDlg('📤 生成 GS 交區（演示）',
    '會將呢班草稿標記為「已交區」——之後區管理層批改、tick「區會批准」，先可以出通告。\n（真版會喺區 Drive 開真 GS；演示用模擬 URL）', { okText: '生成' });
  if (!go) return;
  const r = await apiCall('finalizeCourse', { by: Store.staffName() || '' });
  if (!r || !r.ok) { toast('❌ ' + ((r && r.error) || '失敗'), 'err'); return; }
  await Sync.refresh('silent');
  showGsUrlModal(r.data.url);
  UI.rerenderPage();
}

/* 真路:CourseFactory 起表 + batch 寫入草稿資料 + 課程轉真連線 */
function generateGsReal() {
  const st = gsValidate();
  if (!st) return;
  const execIn = h('input', { class: 'input', type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', value: (Store.config.factoryExec || '') });
  const keyIn = h('input', { class: 'input', type: 'text', placeholder: '開班碼（向區管理層攞）', value: (Store.config.factoryKey || '') });
  const mmsg = h('div', { class: 'form-msg' });
  const m = modal({
    title: '🏛 連區會生成 GS',
    body: h('div', null,
      h('div', { class: 'row-sub' },
        '會經區會 CourseFactory 喺區 Drive 開新工作簿（照模版），寫入晒呢班草稿嘅資料（開班文件＋時間表＋通告），然後攞 URL 交區管理層批核。'),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '區會開班網址（CourseFactory /exec）'), execIn),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '開班碼'), keyIn),
      mmsg),
    actions: [
      h('button', { class: 'btn btn-primary', onclick: async function () { await doGen(); } }, '生成 GS'),
      h('button', { class: 'btn', onclick: function () { m.close(); } }, '取消'),
    ],
  });
  async function doGen() {
    const fx = execIn.value.trim(), mk = keyIn.value.trim();
    if (!fx || !mk) { mmsg.textContent = '請填開班網址同開班碼。'; mmsg.className = 'form-msg err'; return; }
    Store.config.factoryExec = fx; Store.config.factoryKey = mk; Store.saveConfig();
    mmsg.textContent = '起表中…'; mmsg.className = 'form-msg';
    const cur = Store.state;
    const r1 = await apiCall('createCourse', {
      masterKey: mk, courseName: cur.info.name, edition: cur.info.edition, section: cur.info.section,
      badge: cur.info.badge, intake: cur.info.intake, fee: cur.info.fee,
      clName: (cur.leader && cur.leader.name) || '',
    }, { exec: fx, key: mk });
    if (!r1 || !r1.ok) { mmsg.textContent = '起表失敗：' + ((r1 && r1.error) || '未知錯誤'); mmsg.className = 'form-msg err'; return; }
    const cells = draftCells(cur);
    let writeErr = '';
    if (cells.length) {
      mmsg.textContent = '寫入資料（' + cells.length + ' 格）…';
      const r2 = await apiCall('saveCourseBatch', { cells: cells, by: Store.staffName() || '' }, { exec: r1.data.exec, key: r1.data.apiKey });
      if (!r2 || !r2.ok) writeErr = (r2 && r2.error) || '未知錯誤';
    }
    const oldId = Store.activeCourse().id;
    const newId = Store.addCourse({ exec: r1.data.exec, key: r1.data.apiKey, name: cur.info.name });
    Store.removeCourse(oldId);
    Store.setActive(newId);
    m.close();
    UI.render();
    showGsUrlModal(r1.data.url || r1.data.exec, writeErr);
  }
}

function showGsUrlModal(url, writeErr) {
  const txt = h('div', { class: 'confirm-body' },
    h('div', null, 'GS 已生成——複製以下網址交區管理層（區管理系統連結批改，批好 tick「區會批准」）：'),
    h('div', { style: { margin: '10px 0', padding: '8px', background: '#f2f6f5', borderRadius: '8px', wordBreak: 'break-all', fontSize: '13px' } }, url || '（見 CourseFactory 回覆）'),
    writeErr ? h('div', { class: 'form-msg warn' }, '⚠️ 資料寫入有問題：' + writeErr + '——請聯絡 ADC 檢查') : null);
  const m2 = modal({
    title: '✅ GS 已生成',
    body: txt,
    actions: [
      h('button', { class: 'btn btn-primary', onclick: async function () {
        try { await navigator.clipboard.writeText(url || ''); toast('📋 已複製', 'ok'); } catch (e) { toast('複製失敗——手動揀文字複製', 'warn'); }
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
  mkChip(true, '① 開班草稿');
  mkChip(ms.submitted, '② 生成 GS 交區');
  mkChip(ms.approved, '③ 區會批准');
  mkChip(!!ms.noticeUrl, '④ 通告上網');
  mkChip(ms.phase === 'mounted', '⑤ 成員系統報名中');
  mountCard.appendChild(mChips);
  const mRow = h('div', { class: 'btn-row', style: { marginTop: '10px', flexWrap: 'wrap' } });
  if (ms.phase === 'draft') {
    mRow.appendChild(h('span', { class: 'row-sub' }, '📝 本機草稿——填好晒開班文件＋時間表＋通告，先好生成 GS'));
    mRow.appendChild(h('button', { class: 'btn btn-primary btn-sm', onclick: generateGsMock }, '📤 生成 GS 交區（演示）'));
    mRow.appendChild(h('button', { class: 'btn btn-sm', onclick: generateGsReal }, '🏛 連區會生成 GS'));
  } else if (ms.phase === 'submitted') {
    mRow.appendChild(h('span', { class: 'row-sub' }, '⏳ 已交區（' + ms.gsUrl + '）——等區管理層喺區管理系統批改，OK 就 tick「區會批准」'));
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
