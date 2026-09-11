/* ============================================================
 * 50-ui.js — UI 核心：DOM 工具・彈窗・路由・外框・解鎖/連線畫面
 * ============================================================ */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function h(tag, attrs) {
  const el = document.createElement(tag);
  attrs = attrs || {};
  Object.keys(attrs).forEach((k) => {
    const v = attrs[k];
    if (v == null) return;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;              // 已自行 esc 嘅信任內容
    else if (k === 'text') el.textContent = v;
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v);
  });
  for (let i = 2; i < arguments.length; i++) {
    const kid = arguments[i];
    if (kid == null || kid === false) continue;
    if (Array.isArray(kid)) kid.forEach((k2) => { if (k2 != null) el.appendChild(typeof k2 === 'string' ? document.createTextNode(k2) : k2); });
    else el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}

/* ── Toast ── */
function toast(msg, type, ms) {
  type = type || 'info';
  let box = document.getElementById('toastBox');
  if (!box) { box = h('div', { id: 'toastBox', class: 'toast-box' }); document.body.appendChild(box); }
  const t = h('div', { class: 'toast toast-' + type, text: msg });
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms || (type === 'err' ? 5200 : 3600));
}

/* ── Modal ── */
function modal(opts) {
  const ov = h('div', { class: 'modal-ov' + (opts.wide ? ' wide' : '') });
  const closeBtn = h('button', { class: 'modal-x no-print', 'aria-label': '關閉', onclick: () => close() }, '✕');
  const card = h('div', { class: 'modal-card' },
    h('div', { class: 'modal-head' }, h('div', { class: 'modal-title', text: opts.title || '' }), closeBtn),
    h('div', { class: 'modal-body' }, opts.body || ''),
    opts.actions ? h('div', { class: 'modal-foot' }, opts.actions) : null);
  ov.appendChild(card);
  function close() { ov.remove(); if (opts.onClose) opts.onClose(); }
  ov.addEventListener('click', (e) => { if (e.target === ov && opts.dismissable !== false) close(); });
  document.body.appendChild(ov);
  return { close: close, el: card };
}
function confirmDlg(title, msg, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const m = modal({
      title: title,
      body: h('div', { class: 'confirm-body' }, msg),
      actions: [
        h('button', { class: 'btn', onclick: () => { m.close(); resolve(false); } }, opts.cancelText || '取消'),
        h('button', { class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'), onclick: () => { m.close(); resolve(true); } }, opts.okText || '確定'),
      ],
    });
  });
}

function fmtTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  } catch (e) { return ''; }
}
function fmtDT(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  } catch (e) { return ''; }
}

/* ============================================================
 * 路由
 * ============================================================ */
const ROUTES = [
  { id: 'dashboard', label: '儀表板', icon: '📊' },
  { id: 'setup', label: '開班文件', icon: '📝' },
  { id: 'notice', label: '通告', icon: '📢' },
  { id: 'intake', label: '收生', icon: '✅' },
  { id: 'roster', label: '學員', icon: '👥' },
  { id: 'attend', label: '簽到', icon: '✍️' },
  { id: 'finance', label: '收支', icon: '💵' },
  { id: 'complete', label: '完成', icon: '🎓' },
  { id: 'guide', label: '教學', icon: '📖' },
];
const PAGES = {};
function regPage(id, fn) { PAGES[id] = fn; }
function nav(id) { location.hash = '#' + id; }
function currentRoute() {
  const id = (location.hash || '').replace(/^#/, '');
  return ROUTES.filter(r => r.id === id)[0] ? id : 'dashboard';
}

/* ============================================================
 * UI
 * ============================================================ */
const UI = {
  conflictCount: 0,

  /* 總入口：決定邊個畫面 */
  render: function () {
    const app = document.getElementById('app');
    app.innerHTML = '';
    if (!Store.activeCourse()) { this.renderConnect(app); return; }
    if (!Store.isUnlocked()) { this.renderLock(app); return; }
    this.renderShell(app);
    Sync.refresh('boot').then(() => { Sync.start(); });
  },

  /* ── 連線畫面 ── */
  renderConnect: function (app, prefill) {
    prefill = prefill || {};
    const execIn = h('input', { class: 'input', type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', value: prefill.exec || '' });
    const keyIn = h('input', { class: 'input', type: 'text', placeholder: 'ck_…（班領導人 CL 交俾 ADC 嗰個 API Key）', value: prefill.key || '' });
    const nameIn = h('input', { class: 'input', type: 'text', placeholder: '例：攝影專章班（可選，方便辨認）', value: prefill.name || '' });
    const msg = h('div', { class: 'form-msg' });

    async function doConnect(mock) {
      msg.textContent = ''; msg.className = 'form-msg';
      const exec = execIn.value.trim(), key = keyIn.value.trim();
      if (!mock && (!exec || !key)) { msg.textContent = '請填 /exec 網址同 API Key。'; msg.className = 'form-msg err'; return; }
      msg.textContent = '連線中…'; msg.className = 'form-msg';
      if (mock) {
        Store.addCourse({ mock: true, name: '演示訓練班（攝影專章）' });
        Store.setActive('demo');
        toast('📊 已進入演示模式（mock 後端，隨便試，唔會影響真實資料）', 'ok');
        UI.render();
        return;
      }
      /* 先暫存連線去測試 */
      const id = Store.addCourse({ exec: exec, key: key, name: nameIn.value.trim() });
      const prev = Store.config.activeId;
      Store.config.activeId = id; Store.saveConfig();
      const res = await apiCall('getCourseProfile', {});
      if (res && res.ok) {
        const nm = (res.data && res.data.courseName) || nameIn.value.trim();
        Store.config.courses.forEach(c => { if (c.id === id) c.name = nm || c.name; });
        Store.saveConfig();
        Store.loadDrafts();
        toast('✅ 已連線：' + nm, 'ok');
        UI.render();
      } else {
        Store.config.activeId = prev; Store.saveConfig();
        Store.removeCourse(id);
        msg.textContent = '連線失敗：' + ((res && res.error) || '未知錯誤');
        msg.className = 'form-msg err';
      }
    }

    const activeCourses = Store.courses().filter(c => !c.archived && !c.archivedAt);
    const archivedCourses = Store.courses().filter(c => c.archived || c.archivedAt);
    const courseRow = (c, archived) => h('div', { class: 'row-item' },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, (c.mock ? '📊 ' : (archived ? '📦 ' : '🎓 ')) + c.name),
        h('div', { class: 'row-sub' }, archived ? ('已完成' + (c.archivedAt ? '・' + fmtDT(c.archivedAt) : '')) : (c.mock ? '演示模式' : c.exec.slice(0, 52) + '…'))),
      archived
        ? h('button', { class: 'btn btn-sm', onclick: () => { Store.archiveCourse(c.id, false); Store.setActive(c.id); UI.render(); } }, '重新開啟')
        : h('button', { class: 'btn btn-sm', onclick: () => { Store.setActive(c.id); UI.render(); } }, '開啟'),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: async () => {
        if (await confirmDlg('刪除連線', '刪除「' + c.name + '」連線記錄？（本機草稿都會刪，Sheet 資料唔受影響）', { danger: true, okText: '刪除' })) {
          Store.removeCourse(c.id); UI.render();
        }
      } }, '🗑'));
    const savedList = (activeCourses.length || archivedCourses.length)
      ? h('div', { class: 'card' },
          h('div', { class: 'card-title' }, '已連線嘅訓練班'),
          activeCourses.length ? activeCourses.map(c => courseRow(c, false)) : h('div', { class: 'row-sub' }, '未有進行中訓練班'),
          archivedCourses.length ? h('div', { class: 'card-in' },
            h('div', { class: 'card-title' }, '📦 已完成訓練班'),
            archivedCourses.map(c => courseRow(c, true))) : null)
      : null;

    app.appendChild(h('div', { class: 'screen-center' },
      h('div', { class: 'brand-block' },
        h('div', { class: 'brand-icon', onclick: () => { UI._adminClicks = (UI._adminClicks || 0) + 1; if (UI._adminClicks >= 7) { UI._adminClicks = 0; UI.showFactoryAdmin(); } } }, '🎓'),
        h('h1', { class: 'brand-title' }, APP_INFO.name),
        h('div', { class: 'brand-sub' }, '開班文件 → 通告 → 收生 → 點名收支（一條龍）')),
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, '🔎 我點樣讀返自己嗰班？'),
        h('div', { class: 'row-sub' }, '呢個係共用前端，同一個網址可以服務 A/B/C 幾個訓練班。每班真正資料喺自己一張 Google Sheet，全部讀寫經「訓練班系統」單一 /exec（後端用該班 API Key 自動對應返正確班別，唔使逐班部署）。CL 起表後，系統會保存該班連線資料喺本機；其他職員用「複製職員連結」一撳就自動加入同一班。幾班同時進行時，下面「已連線嘅訓練班」揀返要開嗰班就得。')),
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, '🔧 進階／舊班：手動連線'),
        h('div', { class: 'row-sub' }, '新制班用下面「🆕 新開班／📚 從登記表選班」就得（只填一條訓練班系統 /exec）。呢度俾舊制逐班部署嘅班／已有連線資料嘅職員直接貼。'),
        h('div', { class: 'field' }, h('label', { class: 'flabel' }, '該班 /exec 網址（Apps Script 網頁應用程式）'), execIn),
        h('div', { class: 'field' }, h('label', { class: 'flabel' }, 'API Key'), keyIn),
        h('div', { class: 'field' }, h('label', { class: 'flabel' }, '顯示名稱（可選）'), nameIn),
        msg,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-primary', onclick: () => doConnect(false) }, '🔗 連線'),
          h('button', { class: 'btn', onclick: () => doConnect(true) }, '📊 演示模式'))),
      this.renderNewCourse(),
      savedList,
        h('div', { class: 'foot-note' }, '共職員密碼預設 1234（進入後可改）・共用前端，全部經訓練班系統單一後端讀寫每班 Google Sheet')));
  },

  /* ── 隱藏 CourseFactory 後台：清理開錯班（首頁 Logo 連按 7 下） ── */
  showFactoryAdmin: function () {
    const fxIn = h('input', { class: 'input', type: 'url', placeholder: '訓練班系統 /exec', value: (Store.config && (Store.config.hubExec || Store.config.factoryExec)) || '' });
    const userIn = h('input', { class: 'input', type: 'text', placeholder: '後台帳號', autocomplete: 'off' });
    const pwIn = h('input', { class: 'input', type: 'password', placeholder: '後台密碼', autocomplete: 'off' });
    const list = h('div', { class: 'card-in' }, h('div', { class: 'row-sub' }, '登入後可刪除開錯嘅訓練班登記；可同時將該 GS 移到 Drive 垃圾桶。'));
    const msg = h('div', { class: 'form-msg' });
    let creds = null;
    async function loadList() {
      const fx = fxIn.value.trim();
      if (!fx) { msg.textContent = '請填 CourseFactory /exec。'; msg.className = 'form-msg err'; return; }
      creds = { adminUser: userIn.value.trim(), adminPassword: pwIn.value };
      msg.textContent = '讀取中…'; msg.className = 'form-msg';
      const res = await apiCall('adminListCourses', creds, { exec: fx, key: '' });
      if (!res || !res.ok) { msg.textContent = '登入／讀取失敗：' + ((res && res.error) || '未知錯誤'); msg.className = 'form-msg err'; return; }
      Store.config.hubExec = fx; Store.config.factoryExec = fx; Store.saveConfig();
      const courses = (res.data && res.data.courses) || [];
      list.innerHTML = '';
      if (!courses.length) list.appendChild(h('div', { class: 'row-sub' }, '未有訓練班登記。'));
      courses.forEach(c => {
        const trash = h('input', { type: 'checkbox', checked: 'checked' });
        list.appendChild(h('div', { class: 'row-item' },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, esc(c.name || c.courseName || '未命名訓練班')),
            h('div', { class: 'row-sub' }, 'CL：' + esc(c.cl || '—') + (c.createdAt ? '・' + fmtDT(c.createdAt) : '') + (c.publicCourseId ? '・' + esc(c.publicCourseId) : '')),
            h('label', { class: 'row-sub' }, trash, ' 同時將 GS 移到垃圾桶')),
          h('button', { class: 'btn btn-sm btn-danger', onclick: async () => {
            if (!(await confirmDlg('刪除開錯班', '確定刪除「' + (c.name || c.courseName || '未命名訓練班') + '」？\n\n會從訓練班登記表移除；如剔選，該 GS 亦會移到 Drive 垃圾桶。', { danger: true, okText: '刪除' }))) return;
            const del = await apiCall('adminDeleteCourse', Object.assign({}, creds, { apiKey: c.apiKey || c.key, publicCourseId: c.publicCourseId, courseId: c.courseId, trashFile: trash.checked }), { exec: fx, key: '' });
            if (del && del.ok) { toast('✅ 已刪除：' + (c.name || c.courseName), 'ok'); loadList(); }
            else toast('❌ 刪除失敗：' + ((del && del.error) || '未知錯誤'), 'err');
          } }, '刪除')));
      });
      msg.textContent = '已登入'; msg.className = 'form-msg ok';
    }
    const m = modal({ title: '後台清理', wide: true, body: h('div', {},
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '訓練班系統 /exec（原點 GS 單一後端）'), fxIn),
      h('div', { class: 'grid-2c' },
        h('div', { class: 'field' }, h('label', { class: 'flabel' }, '帳號'), userIn),
        h('div', { class: 'field' }, h('label', { class: 'flabel' }, '密碼'), pwIn)),
      msg, list), actions: [
      h('button', { class: 'btn', onclick: loadList }, '登入／重新整理'),
      h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, '關閉')
    ] });
    pwIn.addEventListener('keydown', e => { if (e.key === 'Enter') loadList(); });
  },

  /* ── 🆕 新開班（CL 起表:即刻起真 GS,區管理系統攞 URL 連結批核） ── */
  renderNewCourse: function () { 
    const card = h('div', { class: 'card' });
    card.appendChild(h('div', { class: 'card-title' }, '🆕 新開班（CL 起表）'));
    card.appendChild(h('div', { class: 'row-sub' },
      '只填課程資料（名稱／班領導人／名額／收費…）即刻自動起一張新班 Sheet＋自動登記——唔使貼 template id／folder id／Script URL／API Key，唔使逐班部署。之後喺 APP 填晒預算／節次／時間表／通告（全部寫入班 GS），複製 GS 網址交區管理系統；區管理層批好 tick「區會批准」，之後先生成通告交區網頁管理員，上網貼返通告網址就正式掛載成員系統報名。'));

    const nmIn = h('input', { class: 'input', type: 'text', placeholder: '例：遠足專科徽章訓練班（必填）' });
    const edIn = h('input', { class: 'input', type: 'number', placeholder: '屆別，例：2（可選）' });
    const secSel = h('select', { class: 'input' },
      h('option', { value: '' }, '支部（可選）'),
      BRANCH_OPTIONS.map(o => h('option', { value: o }, o)));
    const badgeIn = h('input', { class: 'input', type: 'text', placeholder: '專章，例：興趣 - 遠足（可選）' });
    const intakeIn = h('input', { class: 'input', type: 'number', placeholder: '預計收生人數（可選）' });
    const feeIn = h('input', { class: 'input', type: 'number', placeholder: '預計收費（元，可選）' });
    const clIn = h('input', { class: 'input', type: 'text', placeholder: '班領導人姓名（可選，建議填）' });
    const factoryIn = h('input', { class: 'input', type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec（訓練班系統單一後端）', value: ((Store.config && (Store.config.hubExec || Store.config.factoryExec)) || '') });
    const masterIn = h('input', { class: 'input', type: 'text', placeholder: '開班碼（可選；原點 GS「設定」有設定先要填）', value: (Store.config.factoryKey || '') });
    const msg = h('div', { class: 'form-msg' });

    async function doCreate(mockMode) {
      msg.textContent = ''; msg.className = 'form-msg';
      const nm = nmIn.value.trim();
      if (!nm) { msg.textContent = '請填課程名稱。'; msg.className = 'form-msg err'; return; }
      const payload = {
        courseName: nm, edition: edIn.value, section: secSel.value, badge: badgeIn.value,
        intake: intakeIn.value, fee: feeIn.value, clName: clIn.value.trim(),
      };
      let res;
      if (mockMode) {
        try { res = await MockAPI.call('createCourse', payload); }
        catch (e) { res = { ok: false, error: '演示後台錯誤：' + (e && e.message) }; }
      } else {
        const fx = factoryIn.value.trim(), mk = masterIn.value.trim();
        if (!fx) { msg.textContent = '請填訓練班系統 /exec（原點 GS 部署出嚟嗰條）。'; msg.className = 'form-msg err'; return; }
        Store.config.hubExec = fx; Store.config.factoryExec = fx; Store.config.factoryKey = mk; Store.saveConfig();
        payload.masterKey = mk;
        res = await apiCall('createCourse', payload, { exec: fx, key: mk });
      }
      if (!res || !res.ok) { msg.textContent = '起表失敗：' + ((res && res.error) || '未知錯誤'); msg.className = 'form-msg err'; return; }
      const d = res.data;
      const id = mockMode
        ? Store.addCourse({ mock: true, id: d.apiKey, key: d.apiKey, name: nm, gsUrl: d.url || '', directRegUrl: d.directRegUrl || '', publicCourseId: d.publicCourseId || '', fresh: true })
        : Store.addCourse({ exec: d.exec, key: d.apiKey, name: nm, gsUrl: d.url || '', directRegUrl: d.directRegUrl || '', publicCourseId: d.publicCourseId || '', fresh: true });
      Store.setActive(id);
      toast('✅ 新班 Sheet 已自動產生＋登記「' + nm + '」——首次密碼 1234，入去先改密碼，之後複製 GS 網址交區管理系統批核', 'ok');
      UI.render();
      if (d.url) showGsUrlModal(d.url);
    }

    async function doPickRegistered(mockMode) {
      const fx = factoryIn.value.trim(), mk = masterIn.value.trim();
      if (!mockMode && !fx) { msg.textContent = '請填訓練班系統 /exec，先可以讀訓練班登記表。'; msg.className = 'form-msg err'; return; }
      Store.config.hubExec = fx; Store.config.factoryExec = fx; Store.config.factoryKey = mk; Store.saveConfig();
      msg.textContent = '讀取訓練班登記表中…'; msg.className = 'form-msg';
      const res = mockMode
        ? await MockAPI.call('listCourses', {})
        : await apiCall('listCourses', { masterKey: mk }, { exec: fx, key: mk });
      if (!res || !res.ok) { msg.textContent = '讀取失敗：' + ((res && res.error) || '未知錯誤'); msg.className = 'form-msg err'; return; }
      const courses = ((res.data && res.data.courses) || []).filter(c => c && (c.name || c.courseName));
      if (!courses.length) { msg.textContent = '登記表暫時未有訓練班。'; msg.className = 'form-msg warn'; return; }
      let m;
      async function openPicked(c) {
        if ((c.exec || c.scriptExecUrl) && (c.apiKey || c.key)) {
          const id = Store.addCourse({ exec: c.exec || c.scriptExecUrl, key: c.apiKey || c.key, name: c.name || c.courseName, gsUrl: c.gsUrl || c.url || '', directRegUrl: c.directRegUrl || '', publicCourseId: c.publicCourseId || '' });
          Store.setActive(id); m.close(); toast('✅ 已選擇：' + (c.name || c.courseName), 'ok'); UI.render();
          return;
        }
        const pw = h('input', { class: 'input', type: 'password', placeholder: '輸入本班共用密碼', autocomplete: 'off' });
        const em = h('div', { class: 'form-msg' });
        let m2;
        const go = async () => {
          const password = pw.value;
          if (!password) { em.textContent = '請輸入本班密碼。'; em.className = 'form-msg err'; return; }
          em.textContent = '驗證中…'; em.className = 'form-msg';
          const rr = mockMode
            ? await MockAPI.call('connectCourseByPassword', { publicCourseId: c.publicCourseId || c.courseId || c.id, password: password })
            : await apiCall('connectCourseByPassword', { publicCourseId: c.publicCourseId || c.courseId || c.id, password: password }, { exec: fx, key: mk });
          if (rr && rr.ok && rr.data) {
            const d = rr.data;
            const id = Store.addCourse({ exec: d.exec || d.scriptExecUrl, key: d.apiKey || d.key, name: d.name || d.courseName, gsUrl: d.gsUrl || d.url || '', directRegUrl: d.directRegUrl || '', publicCourseId: d.publicCourseId || '' });
            Store.setActive(id); m2.close(); m.close(); toast('✅ 已進入：' + (d.name || d.courseName), 'ok'); UI.render();
          } else {
            em.textContent = (rr && rr.error) || '密碼不正確／連線失敗'; em.className = 'form-msg err';
          }
        };
        m2 = modal({ title: '🔐 ' + (c.name || c.courseName), body: h('div', {},
          h('div', { class: 'row-sub' }, '不用記 courseId 或 Script URL；輸入本班密碼後，系統會自動取回該班連線資料。'),
          h('div', { class: 'field' }, pw), em), actions: [
          h('button', { class: 'btn btn-ghost', onclick: () => m2.close() }, '取消'),
          h('button', { class: 'btn btn-primary', onclick: go }, '進入')
        ] });
        pw.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
        setTimeout(() => pw.focus(), 50);
      }
      const list = h('div', {}, courses.map(c => h('div', { class: 'row-item' },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, esc(c.name || c.courseName || '未命名訓練班')),
          h('div', { class: 'row-sub' }, 'CL：' + esc(c.cl || '—') + (c.status ? '・' + esc(c.status) : '') + (c.publicCourseId ? '・ID ' + esc(c.publicCourseId) : ''))),
        h('button', { class: 'btn btn-sm', onclick: () => openPicked(c) }, (c.exec || c.scriptExecUrl) && (c.apiKey || c.key) ? '開啟' : '輸入密碼'))));
      m = modal({ title: '📚 從訓練班登記表選擇', wide: true, body: list });
      msg.textContent = ''; msg.className = 'form-msg';
    }

    card.appendChild(h('div', { class: 'grid-2c' },
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '課程名稱＊'), nmIn),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '屆別'), edIn),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '支部'), secSel),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '專章'), badgeIn),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '預計收生人數'), intakeIn),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '預計收費（元）'), feeIn),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '班領導人姓名'), clIn)));
    card.appendChild(h('div', { class: 'field' }, h('label', { class: 'flabel' }, '訓練班系統 /exec（原點 GS 單一後端）——新開班／選班只需填呢條；演示唔使'), factoryIn));
    card.appendChild(h('div', { class: 'field' }, h('label', { class: 'flabel' }, '開班碼（可選；原點 GS「設定」有設定先要填。選已有班只需本班密碼，唔會公開 API Key）'), masterIn));
    card.appendChild(msg);
    card.appendChild(h('div', { class: 'btn-row' },
      h('button', { class: 'btn btn-primary', onclick: () => doCreate(true) }, '🚀 起表（演示）'),
      h('button', { class: 'btn', onclick: () => doCreate(false) }, '🏛 連區會起表（即刻開真 GS）'),
      h('button', { class: 'btn btn-ghost', onclick: () => doPickRegistered(false) }, '📚 從登記表選班')));
    return card;
  },

  /* ── 解鎖畫面（密碼＋職員名） ── */
  renderLock: function (app) {
    const course = Store.activeCourse();
    let fails = 0, lockUntil = 0;
    const pwIn = h('input', { class: 'input', type: 'password', placeholder: '共職員密碼（預設 1234）', autocomplete: 'off' });
    const staffSel = h('select', { class: 'input' }, h('option', { value: '' }, '載入職員名單中…'));
    const staffOther = h('input', { class: 'input', type: 'text', placeholder: '你嘅姓名（揀「手填」先會用）', style: { display: 'none' } });
    const msg = h('div', { class: 'form-msg' });

    apiCall('getCourseProfile', {}).then((res) => {
      if (res && res.ok && res.data && res.data.staff && res.data.staff.length) {
        staffSel.innerHTML = '';
        staffSel.appendChild(h('option', { value: '' }, '— 揀你嘅職位/姓名 —'));
        res.data.staff.forEach(s => staffSel.appendChild(h('option', { value: s.name }, s.role + '・' + s.name)));
        staffSel.appendChild(h('option', { value: '__other__' }, '其他（手填）'));
        staffSel.addEventListener('change', () => {
          staffOther.style.display = staffSel.value === '__other__' ? '' : 'none';
        });
      } else {
        staffSel.innerHTML = '';
        staffSel.appendChild(h('option', { value: '__other__' }, '手填姓名'));
        staffSel.value = '__other__';
        staffOther.style.display = '';
      }
    });

    const unlockBtn = h('button', { class: 'btn btn-primary', onclick: () => tryUnlock() }, '🔓 進入系統');
    let busy = false;

    async function tryUnlock() {
      if (busy) return;
      const now = Date.now();
      if (now < lockUntil) {
        msg.textContent = '試得多咗，等 ' + Math.ceil((lockUntil - now) / 1000) + ' 秒再試。';
        msg.className = 'form-msg err'; return;
      }
      const pw = pwIn.value;
      if (!pw) { msg.textContent = '請輸入密碼。'; msg.className = 'form-msg err'; return; }
      let staff = staffSel.value === '__other__' ? staffOther.value.trim() : staffSel.value;
      if (!staff) { msg.textContent = '請揀（或填）你嘅姓名，方便防呆記錄。'; msg.className = 'form-msg err'; return; }

      busy = true; unlockBtn.textContent = '驗證中…'; msg.textContent = ''; msg.className = 'form-msg';
      function localFail(txt) {
        fails++;
        if (fails >= 5) { lockUntil = Date.now() + 15000; fails = 0; }
        msg.textContent = txt; msg.className = 'form-msg err';
      }
      function enterSystem(note) {
        Store.setStaffName(staff);
        Store.setUnlocked();
        Store.pushLog('unlock', '進入系統' + (note || ''));
        UI.render();
      }

      const res = await api.auth(pw);

      if (res && res.ok) {
        /* coursev5 後端：密碼正確 */
        const course = Store.activeCourse();
        if (course && !course.mock && course.authV5 !== true) { course.authV5 = true; Store.saveConfig(); }
        const firstLogin = res.data && res.data.firstLogin && res.data.role !== 'admin';
        enterSystem(firstLogin ? '（首次登入）' : '');
        if (firstLogin) UI.promptChangePw(true);
        return;
      }

      const errTxt = String((res && res.error) || '');
      if (/未知|unknown/i.test(errTxt)) {
        /* 舊版後端（coursev4）冇 auth action → 退返本機密碼閘（同舊行為一致） */
        const course = Store.activeCourse();
        if (course && !course.mock && course.authV5 !== false) { course.authV5 = false; Store.saveConfig(); }
        if (pw === (Store.config.password || APP_INFO.defaultPassword)) {
          enterSystem('（舊版後端）');
          toast('後端係舊版，未支援全組密碼——建議升級 coursev5', 'warn');
        } else {
          localFail('密碼唔啱。（預設 1234）');
        }
      } else {
        /* 後端有回應但密碼錯／被鎖 */
        localFail(errTxt || '密碼唔啱。');
      }

      if (unlockBtn.isConnected) unlockBtn.textContent = '🔓 進入系統';
      busy = false;
    }

    app.appendChild(h('div', { class: 'screen-center' },
      h('div', { class: 'card lock-card' },
        h('div', { class: 'brand-icon', onclick: () => { UI._adminClicks = (UI._adminClicks || 0) + 1; if (UI._adminClicks >= 7) { UI._adminClicks = 0; UI.showFactoryAdmin(); } } }, '🎓'),
        h('h2', { class: 'lock-title' }, course.name || APP_INFO.name),
        h('div', { class: 'lock-sub' }, '班職員共用入口 — 輸入密碼後揀自己個名'),
        h('div', { class: 'field' }, h('label', { class: 'flabel' }, '密碼'), pwIn),
        h('div', { class: 'field' }, h('label', { class: 'flabel' }, '你是'), staffSel, staffOther),
        msg,
        h('div', { class: 'btn-row' },
          unlockBtn,
          h('button', { class: 'btn btn-ghost', onclick: () => { Store.config.activeId = null; Store.saveConfig(); UI.render(); } }, '切換訓練班')),
        h('div', { class: 'foot-note' }, '每班第一次登入密碼 1234，入到會提示即刻改密碼'))));

    pwIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
  },

  /* ── 主外框 ── */
  renderShell: function (app) {
    const course = Store.activeCourse();
    const headLeft = h('div', { class: 'head-left' },
      h('div', { class: 'head-title', text: (course.mock ? '📊 ' : '🎓 ') + (Store.state && Store.state.info && Store.state.info.name ? Store.state.info.name : course.name) }),
      h('div', { class: 'head-staff', id: 'headStaff' }));
    const syncChip = h('button', { class: 'chip chip-sync', id: 'syncChip', title: '', onclick: () => this.syncDetail() }, '…');
    const saveChip = h('button', { class: 'chip chip-save', id: 'saveChip', onclick: () => this.showDraftsModal() }, '💾');
    const menuBtn = h('button', { class: 'chip chip-menu', onclick: () => this.showSettings() }, '⚙️');
    const banner = h('div', { class: 'conflict-banner', id: 'conflictBanner', style: { display: 'none' },
      onclick: () => this.showConflictDialog(Store.resolveAgainstFresh().conflict, Store.resolveAgainstFresh().keep) });

    app.appendChild(h('div', { class: 'app-chrome' },
      h('header', { class: 'app-head no-print' }, headLeft,
        h('div', { class: 'head-right' }, syncChip, saveChip, menuBtn)),
      banner,
      h('main', { class: 'app-main', id: 'page' }),
      h('nav', { class: 'app-nav no-print' },
        ROUTES.map(r => h('button', {
          class: 'nav-btn', 'data-route': r.id,
          onclick: () => nav(r.id),
        }, h('span', { class: 'nav-icon' }, r.icon), h('span', { class: 'nav-label' }, r.label))))));

    if (!this._hashBound) {
      this._hashBound = true;
      window.addEventListener('hashchange', () => this.rerenderPage());
    }
    this.rerenderPage();
    this.updateSyncIndicator();
    this.updateHeader();
    Store.notify = () => this.updateHeader();
  },

  rerenderPage: function () {
    const page = document.getElementById('page');
    if (!page) return;
    const id = currentRoute();
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-route') === id));
    page.innerHTML = '';
    if (PAGES[id]) PAGES[id](page);
    window.scrollTo(0, 0);
  },

  updateHeader: function () {
    const saveChip = document.getElementById('saveChip');
    if (saveChip) {
      const n = Store.draftCount();
      saveChip.textContent = n ? '💾 未儲存 ' + n : '💾';
      saveChip.classList.toggle('has', n > 0);
      saveChip.title = n ? '有 ' + n + ' 項未儲存（撳呢度睇/儲存）' : '全部已儲存';
    }
    const staff = document.getElementById('headStaff');
    if (staff) staff.textContent = '👤 ' + (Store.staffName() || '未命名職員');
  },

  updateSyncIndicator: function () {
    const chip = document.getElementById('syncChip');
    if (!chip) return;
    const st = Store.state;
    if (Sync.lastState === 'syncing') { chip.textContent = '🔄'; chip.className = 'chip chip-sync syncing'; chip.title = '同步中…'; return; }
    if (Sync.lastState === 'error') { chip.textContent = '🔴'; chip.className = 'chip chip-sync error'; chip.title = '連線失敗：' + Sync.lastError; return; }
    if (!st) { chip.textContent = '…'; chip.className = 'chip chip-sync'; return; }
    chip.textContent = '🟢 ' + fmtTime(Sync.lastFetchAt);
    chip.className = 'chip chip-sync ok';
    chip.title = 'rev ' + st.rev + (st.revBy ? '・' + st.revBy + ' 於 ' + fmtDT(st.revSavedAt) + ' 儲存' : '') + '\n（撳呢度睇詳情/手動同步）';
  },

  setSaving: function (b) {
    const chip = document.getElementById('saveChip');
    if (chip) chip.classList.toggle('saving', b);
  },

  setConflictBanner: function (n) {
    this.conflictCount = n;
    const b = document.getElementById('conflictBanner');
    if (!b) return;
    b.style.display = n ? '' : 'none';
    b.textContent = '⚠️ 有 ' + n + ' 項修改同其他職員撞咗（同一格兩個版本）——撳呢度處理';
  },

  syncDetail: function () {
    const st = Store.state;
    const body = h('div', {},
      h('table', { class: 'kv-table' },
        h('tr', null, h('td', null, '狀態'), h('td', null, Sync.lastState === 'ok' ? '🟢 已連線' : Sync.lastState === 'error' ? '🔴 失敗' : Sync.lastState)),
        h('tr', null, h('td', null, '最後讀取'), h('td', null, fmtDT(Sync.lastFetchAt) || '—')),
        h('tr', null, h('td', null, '工作簿版本 rev'), h('td', null, st ? String(st.rev) : '—')),
        h('tr', null, h('td', null, '最後儲存人'), h('td', null, st && st.revBy ? esc(st.revBy) : '—')),
        h('tr', null, h('td', null, '最後儲存時間'), h('td', null, st ? fmtDT(st.revSavedAt) : '—')),
        h('tr', null, h('td', null, '自動同步'), h('td', null, ((Store.config.pollMs || APP_INFO.pollMs) / 1000) + ' 秒（分頁隱藏時暫停）'))),
      Sync.lastError ? h('div', { class: 'form-msg err', style: { marginTop: '10px' } }, '⚠️ ' + esc(Sync.lastError)) : null);
    const m = modal({ title: '🔄 同步狀態', body: body, actions: [
      h('button', { class: 'btn', onclick: async () => { m.close(); toast('同步中…'); await Sync.refresh('manual'); toast(Sync.lastState === 'ok' ? '✅ 已同步至 rev ' + (Store.state ? Store.state.rev : '') : '仍然失敗：' + Sync.lastError, Sync.lastState === 'ok' ? 'ok' : 'err'); } }, '🔄 手動同步'),
      h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, '關閉'),
    ] });
  },

  /* ── 草稿一覽 ── */
  showDraftsModal: function () {
    const drafts = Store.drafts();
    if (!drafts.length) { toast('冇未儲存修改 ✅'); return; }
    const list = h('div', { class: 'draft-list' });
    drafts.forEach(d => {
      list.appendChild(h('div', { class: 'draft-item' },
        h('div', { class: 'draft-main' },
          h('div', { class: 'draft-label' }, '✏️ ' + d.label),
          h('div', { class: 'draft-diff' },
            h('span', { class: 'old' }, '原本：' + esc(String(d.baseValue == null ? '' : d.baseValue) || '（空）')),
            h('span', { class: 'arr' }, '→'),
            h('span', { class: 'new' }, '改為：' + esc(String(d.value == null ? '' : d.value))))),
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { Store.removeDraft(d.key); list.querySelector('[data-k="' + CSS.escape(d.key) + '"]')?.remove(); if (!Store.draftCount()) m.close(); } }, '撤銷')));
      list.lastChild.setAttribute('data-k', d.key);
    });
    const m = modal({ title: '✏️ 未儲存修改（' + drafts.length + '）', wide: true, body: list, actions: [
      h('button', { class: 'btn btn-danger', onclick: async () => {
        m.close();
        if (await confirmDlg('全部撤銷', '確定放棄全部 ' + Store.draftCount() + ' 項未儲存修改？', { danger: true, okText: '放棄' })) { Store.clearDrafts(); toast('已全部撤銷'); }
      } }, '全部撤銷'),
      h('button', { class: 'btn btn-primary', onclick: () => { m.close(); Sync.saveAll(); } }, '💾 儲存全部'),
      h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, '關閉'),
    ] });
  },

  /* ── 衝突對話框（同一格兩個版本，揀邊個） ── */
  showConflictDialog: function (conflicts, keep) {
    if (!conflicts || !conflicts.length) { UI.setConflictBanner(0); return; }
    const picks = {};
    const list = h('div', {});
    list.appendChild(h('div', { class: 'form-msg warn' }, '有其他職員啱啱改咗同一格。揀「用我嘅」會覆蓋對方，揀「用對方」就放棄你嘅改動。你其他冇撞嘅修改（' + (keep ? keep.length : 0) + ' 項）會照常儲存。'));
    conflicts.forEach(d => {
      const mine = h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'cf-' + CSS.escape(d.key), checked: 'checked' }), '用我嘅：「' + String(d.value == null ? '' : d.value) + '」');
      const theirs = h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'cf-' + CSS.escape(d.key) }), '用對方' + (d.conflictInfo ? '（' + d.conflictInfo + '）' : ''));
      mine.querySelector('input').addEventListener('change', () => { picks[d.key] = 'mine'; });
      theirs.querySelector('input').addEventListener('change', () => { picks[d.key] = 'theirs'; });
      picks[d.key] = 'mine';
      list.appendChild(h('div', { class: 'conflict-item' },
        h('div', { class: 'draft-label' }, '✏️ ' + d.label), mine, theirs));
    });
    const m = modal({ title: '⚠️ 同一格有兩個版本（' + conflicts.length + '）', wide: true, body: list, dismissable: false, actions: [
      h('button', { class: 'btn btn-primary', onclick: () => {
        const removeKeys = conflicts.filter(d => picks[d.key] === 'theirs').map(d => d.key);
        Store.clearDrafts(removeKeys);
        m.close();
        UI.setConflictBanner(0);
        Sync.saveAll();
      } }, '套用並繼續儲存'),
    ] });
  },

  /* ── 更改共職員密碼（後端驗證，全體生效；firstLogin=首次登入提示） ── */
  promptChangePw: function (firstLogin) {
    const oldIn = h('input', { class: 'input', type: 'password', placeholder: '現時密碼（預設 1234）', autocomplete: 'off' });
    const p1 = h('input', { class: 'input', type: 'password', placeholder: '新密碼（至少 4 位）', autocomplete: 'new-password' });
    const p2 = h('input', { class: 'input', type: 'password', placeholder: '重複新密碼', autocomplete: 'new-password' });
    const msg = h('div', { class: 'form-msg' });
    const btn = h('button', { class: 'btn btn-primary' }, '💾 更新密碼');
    btn.addEventListener('click', async () => {
      if (!p1.value || p1.value !== p2.value) { msg.textContent = '兩次新密碼唔一致。'; msg.className = 'form-msg err'; return; }
      msg.textContent = '驗證中…'; msg.className = 'form-msg';
      btn.disabled = true;
      const res = await api.setPassword(oldIn.value, p1.value);
      btn.disabled = false;
      if (res && res.ok) {
        m.close();
        Store.pushLog('password', '已更改共職員密碼');
        toast('✅ 密碼已更新——對所有班職員即時生效', 'ok');
      } else {
        msg.textContent = (res && res.error) || '更新失敗';
        msg.className = 'form-msg err';
      }
    });
    const m = modal({
      title: firstLogin ? '🔑 首次登入——請設定新密碼' : '🔑 更改共職員密碼',
      body: h('div', {},
        firstLogin ? h('div', { class: 'form-msg warn' }, '呢班仲用緊預設密碼 1234——改做班內密碼先至安全。新密碼對所有班職員生效。') : null,
        h('div', { class: 'field' }, h('label', { class: 'flabel' }, '現時密碼'), oldIn),
        h('div', { class: 'field' }, h('label', { class: 'flabel' }, '新密碼'), p1),
        h('div', { class: 'field' }, h('label', { class: 'flabel' }, '重複新密碼'), p2),
        msg),
      actions: [
        firstLogin
          ? h('button', { class: 'btn btn-ghost', onclick: () => { m.close(); toast('記得盡快喺 ⚙️ 設定更改密碼', 'warn'); } }, '稍後再改')
          : h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, '取消'),
        btn,
      ],
    });
    setTimeout(() => oldIn.focus(), 50);
  },

  /* ── 設定 ── */
  showSettings: function () {
    const course = Store.activeCourse();
    const staffIn = h('input', { class: 'input', type: 'text', value: Store.staffName() || '' });
    const pw1 = h('input', { class: 'input', type: 'password', placeholder: '新密碼' });
    const pw2 = h('input', { class: 'input', type: 'password', placeholder: '重複新密碼' });
    const pollSel = h('select', { class: 'input' },
      [10, 15, 30, 60].map(s => h('option', { value: s, selected: (Store.config.pollMs / 1000) === s ? 'selected' : null }, s + ' 秒')));

    const body = h('div', {},
      h('div', { class: 'card-in' },
        h('div', { class: 'card-title' }, '🎓 ' + esc(course.name) + (course.mock ? '（演示模式）' : '')),
        course.mock ? null : h('div', { class: 'kv-line' }, h('span', null, '/exec'), h('code', null, course.exec.length > 60 ? course.exec.slice(0, 60) + '…' : course.exec)),
        course.mock ? null : h('div', { class: 'kv-line' }, h('span', null, 'API Key'), h('code', null, course.key.slice(0, 6) + '…' + course.key.slice(-4))),
        h('div', { class: 'btn-row' },
          course.mock ? null : h('button', { class: 'btn btn-sm', onclick: () => {
            const url = location.origin + location.pathname + '?exec=' + encodeURIComponent(course.exec) + '&key=' + encodeURIComponent(course.key) + '&name=' + encodeURIComponent(course.name);
            if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('✅ 職員連結已複製——Send俾其他班職員，一按即入', 'ok'));
            else modal({ title: '職員連結', body: h('textarea', { class: 'input', readonly: 'readonly', style: { height: '90px' } }, url) });
          } }, '🔗 複製職員連結'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: async () => { const r = await apiCall('getCourseProfile', {}); toast(r.ok ? '✅ 後台正常（' + (r.data && r.data.courseName) + '）' : '❌ ' + r.error, r.ok ? 'ok' : 'err'); } }, '🩺 測試連線'))),
      h('div', { class: 'card-in' },
        h('div', { class: 'card-title' }, '👤 職員身份（寫入記錄用）'),
        h('div', { class: 'btn-row' }, staffIn, h('button', { class: 'btn btn-sm', onclick: () => { Store.setStaffName(staffIn.value); UI.updateHeader(); toast('✅ 已更新'); } }, '保存'))),
      (course.authV5 === false && !course.mock)
        ? h('div', { class: 'card-in' },
            h('div', { class: 'card-title' }, '🔒 密碼（舊版後端——只影響本裝置）'),
            h('div', { class: 'row-sub' }, '呢班後端係舊版，未支援全組密碼；密碼只存喺呢部裝置。'),
            h('div', { class: 'field' }, pw1), h('div', { class: 'field' }, pw2),
            h('button', { class: 'btn btn-sm', onclick: () => {
              if (!pw1.value || pw1.value !== pw2.value) { toast('兩次輸入唔同／空的', 'err'); return; }
              Store.config.password = pw1.value; Store.saveConfig(); toast('✅ 本機密碼已更新');
            } }, '改密碼'))
        : h('div', { class: 'card-in' },
            h('div', { class: 'card-title' }, '🔑 共職員密碼（後端驗證・全體生效）'),
            h('div', { class: 'row-sub' }, '每班第一次登入用預設 1234，之後改成班內密碼；錯 5 次會鎖 10 分鐘。'),
            h('button', { class: 'btn btn-sm', onclick: () => UI.promptChangePw(false) }, '🔑 更改密碼')),
      h('div', { class: 'card-in' },
        h('div', { class: 'card-title' }, '🔄 同步間隔'),
        h('div', { class: 'btn-row' }, pollSel, h('button', { class: 'btn btn-sm', onclick: () => {
          Store.config.pollMs = Number(pollSel.value) * 1000; Store.saveConfig(); Sync.start(); toast('✅ 已設做 ' + pollSel.value + ' 秒');
        } }, '保存'))),
      course.mock ? h('div', { class: 'card-in' },
        h('div', { class: 'card-title' }, '🧪 演示工具（試防呆用）'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-sm', onclick: () => { const r = MockDemo.newReg(); toast('📥 已模擬新報名：' + r.name + '（等下一次自動同步／手動同步就見到）', 'ok'); Sync.refresh('manual'); } }, '📥 模擬新報名'),
          h('button', { class: 'btn btn-sm', onclick: () => { const r = MockDemo.otherStaffSave(); toast('🧪 另一職員（李美芬）已改咗「' + r.changed + '」並儲存（rev ' + r.rev + '）', 'warn'); Sync.refresh('manual'); } }, '🧪 模擬另一職員儲存'),
          h('button', { class: 'btn btn-sm', onclick: () => { MockDemo.resetPw(); toast('🔑 演示班密碼已重設做 1234（重新鎖定後可試首次登入流程）', 'ok'); } }, '🔑 重設密碼'),
          h('button', { class: 'btn btn-sm btn-danger', onclick: async () => {
            if (await confirmDlg('重設演示資料', '成個演示工作簿會回復初始狀態（草稿都會清埋）', { danger: true, okText: '重設' })) {
              MockDemo.reset(); Store.clearDrafts(); await Sync.refresh('manual'); toast('♻️ 已重設', 'ok');
            }
          } }, '♻️ 重設演示資料'))) : null,
      h('div', { class: 'card-in' },
        h('div', { class: 'card-title' }, '📜 操作紀錄（本機）'),
        Store.logs().length
          ? h('div', { class: 'oplog' }, Store.logs().slice(0, 15).map(l => h('div', { class: 'oplog-item' }, h('span', { class: 't' }, fmtDT(l.t)), h('span', { class: 's' }, esc(l.staff)), h('span', null, esc(l.summary)))))
          : h('div', { class: 'row-sub' }, '（未有記錄）')),
      h('div', { class: 'btn-row', style: { marginTop: '12px' } },
        h('button', { class: 'btn btn-ghost', onclick: () => { Store.lock(); Sync.stop(); UI.render(); } }, '🔒 鎖定'),
        h('button', { class: 'btn btn-ghost', onclick: () => { Store.config.activeId = null; Store.saveConfig(); Store.lock(); Sync.stop(); UI.render(); } }, '🔁 切換訓練班'),
        h('button', { class: 'btn btn-ghost', onclick: async () => {
          if (await confirmDlg('標記訓練班已完成', '完成訓練班後可將本機連線標記已完成，主清單就唔會越嚟越長。只係標記已完成呢部機嘅連線記錄，Google Sheet／區管理系統資料唔會受影響；之後可喺「已完成／已完成」重新開啟。', { okText: '標記已完成' })) {
            Store.archiveCourse(course.id, true); Store.lock(); Sync.stop(); m.close(); UI.render();
          }
        } }, '📦 標記已完成'),
        h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, '關閉')));

    const m = modal({ title: '⚙️ 設定', wide: true, body: body });
  },
};
