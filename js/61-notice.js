/* ============================================================
 * 61-notice.js — 通告：即時預覽（跟 Print_通告組版）＋可編欄位＋列印
 * 標題/節次/名額/截止/報名辦法/FPS/查詢 由班資料自動組；
 * 參加資格/費用說明/服裝/備註等喺呢頁填（寫入 Print_通告 格）
 * ============================================================ */

regPage('notice', function (root) {
  const st = Store.state;
  if (!st) { root.appendChild(h('div', { class: 'card' }, '載入中…')); return; }

  const get = (tab, r, c) => Store.effectiveCell(tab, r, c);
  const doc = composeNoticeDoc(get, st.params);

  /* ── 掛載狀態（通告出街時機閘:區會批准格 ✔ 先可以交區網頁管理員） ── */
  const ms = mountStatus(st);
  if (ms.phase === 'writing') {
    root.appendChild(h('div', { class: 'form-msg warn' },
      '⏳ CL 填寫中／待區管理層批改——通告內容可以照草擬，但區管理層未 tick「區會批准」之前，唔好交區網頁管理員。'));
  } else if (ms.phase === 'approved') {
    root.appendChild(h('div', { class: 'form-msg ok' },
      '✅ 區會已批准——而家可以生成通告（下面 🖨 列印／📋 複製文字版）交區網頁管理員。上網後區管理系統貼通告 URL 自動掛載，報名會流入呢度。'));
  } else {
    root.appendChild(h('div', { class: 'form-msg ok' },
      '🌐 通告已上網、成員系統報名進行中（' + ms.regCount + ' 位已報名）。'));
  }

  /* ── 編輯面板 ── */
  const editCard = h('div', { class: 'card no-print' },
    h('div', { class: 'card-title' }, '✏️ 通告可編欄位'),
    h('div', { class: 'row-sub' }, '其餘（標題・節次・名額・截止・FPS・查詢）全部由「開班文件」自動帶入，唔使填'),
    h('div', { class: 'grid-2c' },
      cellField(TAB.NOTICE, NOTICE_EDIT.fileNo),
      cellField(TAB.NOTICE, NOTICE_EDIT.issueDate)),
    h('div', {}, cellField(TAB.NOTICE, NOTICE_EDIT.eligibility)),
    h('div', {}, cellField(TAB.NOTICE, NOTICE_EDIT.feeNote)),
    h('div', {}, cellField(TAB.NOTICE, NOTICE_EDIT.uniform)),
    ['remark1', 'remark2', 'remark3', 'remark4', 'remark5', 'remark6'].map(k => cellField(TAB.NOTICE, NOTICE_EDIT[k])),
    h('div', { class: 'grid-2c' },
      cellField(TAB.NOTICE, NOTICE_EDIT.signer),
      cellField(TAB.NOTICE, NOTICE_EDIT.deputy)));

  /* QR 上載（只存本機，列印用） */
  const qrImg = Store.qrData();
  const qrBox = h('div', { class: 'qr-preview' }, qrImg ? h('img', { src: qrImg, alt: 'FPS QR' }) : h('div', { class: 'qr-empty' }, '未有 QR'));
  const qrInput = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
  qrInput.addEventListener('change', () => {
    const f = qrInput.files && qrInput.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 600 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * scale));
        cv.height = Math.max(1, Math.round(img.height * scale));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        Store.setQr(cv.toDataURL('image/png'));
        toast('✅ FPS QR 已載入（只存呢部裝置，列印時會用）', 'ok');
        UI.rerenderPage();
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
  const editCard2 = h('div', { class: 'card no-print' },
    h('div', { class: 'card-title' }, '🖼️ FPS QR Code'),
    h('div', { class: 'row-sub' }, '區會 FPS QR 圖片——上載後列印通告會自動印埋（只存本機；正式版亦可喺 Google Sheet Print_通告 B42 貼浮動圖片）'),
    h('div', { class: 'btn-row' },
      qrBox,
      h('button', { class: 'btn btn-sm', onclick: () => qrInput.click() }, '📁 上載圖片'),
      qrImg ? h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { Store.setQr(''); UI.rerenderPage(); } }, '移除') : null,
      qrInput));

  /* ── A4 預覽 ── */
  const qrData = Store.qrData();
  const preview = h('div', { class: 'doc-page print-doc', id: 'noticeDoc' },
    h('div', { class: 'doc-fileno' }, esc(doc.fileNo || '檔案編號: 　　　　')),
    h('div', { class: 'doc-fileno', style: { textAlign: 'right' } }, doc.issueDate ? esc(doc.issueDate) : ''),
    h('div', { class: 'doc-title' }, esc(doc.title || '（未填訓練班名稱）')),
    doc.sessions.length ? h('table', { class: 'doc-sess' },
      h('thead', null, h('tr', null, h('th', null, '日期'), h('th', null, '時間'), h('th', null, '地點'))),
      h('tbody', null, doc.sessions.map(sp => h('tr', null,
        h('td', null, esc(sp.date)), h('td', null, esc(sp.time || '—')), h('td', null, esc(sp.venue || '—')))))) : null,
    h('div', { class: 'doc-line' }, h('span', { class: 'doc-k' }, '班領導人：'), h('span', null, esc(doc.leaderText || '（未填）'))),
    h('div', { class: 'doc-line' }, h('span', { class: 'doc-k' }, '參加資格：'), h('span', null, esc(doc.eligibility || '　'))),
    h('div', { class: 'doc-line' }, h('span', { class: 'doc-k' }, '費 用：'), h('span', null, esc(doc.feeNote || '　'))),
    h('div', { class: 'doc-line indent' }, h('span', null, esc(doc.payText))),
    h('div', { class: 'doc-line' }, h('span', { class: 'doc-k' }, '名 額：'), h('span', null, esc(doc.quotaText || '　'))),
    h('div', { class: 'doc-line' }, h('span', { class: 'doc-k' }, '截止日期：'), h('span', null, esc(doc.deadlineText || '　'))),
    h('div', { class: 'doc-line' }, h('span', { class: 'doc-k' }, '報名辦法：'), h('span', null, esc(doc.signupText))),
    h('div', { class: 'doc-line' }, h('span', { class: 'doc-k' }, '服 裝：'), h('span', null, esc(doc.uniform || '　'))),
    h('div', { class: 'doc-line' }, h('span', { class: 'doc-k', style: { verticalAlign: 'top' } }, '備 註：'),
      h('div', { class: 'doc-remarks' }, (doc.remarks.length ? doc.remarks : ['　']).map(t => h('div', null, esc(t))))),
    h('div', { class: 'doc-line' }, h('span', { class: 'doc-k' }, '查 詢：'), h('span', null, esc(doc.enquiry))),
    h('div', { class: 'doc-qr-row' },
      h('div', { class: 'doc-qr-box' }, qrData ? h('img', { src: qrData }) : h('div', { class: 'doc-qr-ph' }, 'FPS QR Code\n（上載後印呢度）')),
      h('div', { class: 'doc-sign' },
        h('div', { class: 'doc-sign-title' }, '區總監'),
        h('div', { class: 'doc-sign-name' }, esc(doc.signer || '　　　　')),
        doc.deputy ? h('div', { class: 'doc-sign-deputy' }, '（' + esc(doc.deputy) + '代行）') : null)));

  const actions = h('div', { class: 'card no-print' },
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn btn-primary', onclick: () => window.print() }, '🖨️ 列印 / 另存 PDF'),
      h('button', { class: 'btn', onclick: () => nav('setup') }, '📝 改班資料（自動帶入）')),
    h('div', { class: 'row-sub', style: { marginTop: '8px' } }, '舊流程照用：列印做 PDF → 交網頁管理員上載區網／總會；區管理平台開班登記會經 getCourseProfile 自動讀晒呢啲資料。'));

  root.appendChild(actions);
  root.appendChild(h('div', { class: 'notice-layout' },
    h('div', { class: 'notice-edit' }, editCard, editCard2),
    preview));
});
