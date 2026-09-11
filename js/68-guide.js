/**
 * 68-guide.js — 📖 使用教學
 * 俾 CL 真係要用時知道點用;亦俾區管理層驗證流程啱唔啱。
 * 配合演示模式(demo 班/新開班)跟住做一次就得。
 */
'use strict';

regPage('guide', function (root) {
  const st = Store.state;
  const course = Store.activeCourse();

  /* ── 開演示 ── */
  const demoCard = h('div', { class: 'card no-print' });
  demoCard.appendChild(h('div', { class: 'card-title' }, '🧪 跟住做一次（演示）'));
  demoCard.appendChild(h('div', { class: 'row-sub' },
    '演示模式有齊假資料（攝影班：3 節・10 個報名・收支・評核），隨便撳唔會影響真實資料。想由零試「新開班→掛載」成條線，撳下面第二個掣。'));
  const dRow = h('div', { class: 'btn-row', style: { flexWrap: 'wrap' } });
  dRow.appendChild(h('button', { class: 'btn btn-sm', onclick: function () {
    Store.addCourse({ mock: true, name: '演示訓練班（攝影專章）' });
    Store.setActive('demo');
    UI.render();
    toast('📊 已入演示班——跟住下面步驟逐頁試', 'ok');
  } }, '📊 開演示班（有齊資料）'));
  dRow.appendChild(h('button', { class: 'btn btn-sm btn-primary', onclick: async function () {
    const nm = '教學示範班 ' + new Date().toISOString().slice(5, 10).replace('-', '/');
    const res = await MockAPI.call('createCourse', { courseName: nm, clName: '陳大文' });
    if (!res || !res.ok) { toast('❌ ' + ((res && res.error) || '失敗'), 'err'); return; }
    Store.addCourse({ mock: true, id: res.data.apiKey, key: res.data.apiKey, name: nm, gsUrl: res.data.url });
    Store.setActive(res.data.apiKey);
    UI.render();
    toast('✅ 空白班已起（演示）——跟住第 2 步去「開班文件」填嘢', 'ok');
  } }, '🆕 由零開一個空白班（演示）'));
  demoCard.appendChild(dRow);
  root.appendChild(demoCard);

  /* ── 架構 ── */
  const arch = h('div', { class: 'card' });
  arch.appendChild(h('div', { class: 'card-title' }, '🗺️ 三方分工（睇住呢個圖就明成個生態）'));
  arch.appendChild(h('pre', { class: 'guide-pre' },
    '★ 本 APP＝所有訓練班嘅起點（重中之重）\n' +
    '   CL 開班 → 即刻起真 GS → 填晒所有嘢 → 全生命週期管理\n' +
    '\n' +
    '   區管理系統＝只管審批＋修改標亮＋掛載＋財務 tick；不寄訓練班 email、不接觸參加者\n' +
    '   成員系統＝通告 direct link 入該班報名，寫入訓練班「表格回應」\n' +
    '\n' +
    '   批核：區管理層連結 GS 睇資料 → tick「區會批准」格 → CL 見 ✔ 先出通告'));
  arch.appendChild(h('div', { class: 'row-sub' }, '呢個 APP 本身冇中央 server；每班 Google Sheet 旁邊嘅 Apps Script /exec 就係該班後端。多人共用係因為大家用同一個 /exec＋API Key 連到同一張 Sheet。'));
  root.appendChild(arch);

  /* ── 全流程 ── */
  const flow = h('div', { class: 'card' });
  flow.appendChild(h('div', { class: 'card-title' }, '🚀 全流程（CL 視角，逐步做）'));
  const steps = [
    ['1️⃣ 新開班', '連線畫面「🆕 新開班」：填課程名・屆別・支部・專章・收生・收費・你個名 → 撳「🏛 連區會起表」。'
      + '系統即刻喺區 Drive 起一張新 GS（照教學模版），你即刻連線入去（首次密碼 1234，入去先改）。'
      + '⚠️ 要向管理層攞「區會開班網址＋開班碼」先撳到呢個掣（演示掣唔使）。'],
    ['2️⃣ 複製網址交區', '起表完會彈「📋 網址」視窗（GS＋SCRIPT 兩條），一掣複製，交俾區管理層／貼入區管理系統。'
      + '之後區管理層就連結到你張 GS 睇資料批改。（儀表板「🚢 掛載流程」隨時可以再攞 URL）'],
    ['3️⃣ 填開班文件', '「📝 開班文件」三個分頁填晒：💰 Input01 預算（8 大開支，有小計）→ 📋 Input02 班資料（名額・節次・截止日・職員表）→ 🗓 時間表（每節 rundown，填「需時」撳⏱自動排時間）。'
      + '填完撳右上角 💾 寫入（之前全部係草稿，唔怕撞）。'],
    ['4️⃣ 填通告', '「📢 通告」：自動組版 A4 預覽（標題・節次・名額・截止・FPS 全部自動帶入）。'
      + '要填：檔案編號＋訓練班電郵（⚠️ 兩樣都係管理層告知先有）、參加資格・費用說明・服裝・備註。'],
    ['5️⃣ 等批核', '區管理層批改你張 GS。批好會 tick「區會批准」格——儀表板「🚢 掛載流程」②轉 ✓、通告頁出綠字。'
      + '⏳ 未見 ✔ 之前，通告唔好交區網頁管理員。'],
    ['6️⃣ 出通告', '見 ✔ 之後：通告頁「🖨 列印／📋 複製文字版」交區網頁管理員上網；通告入面係成員系統 direct 報名連結，不是訓練班 Script /exec。'
      + '上網後區管理層喺區管理系統貼通告 URL → 自動掛載成員系統 → 報名開始流入（儀表板見「報名中」）。'],
    ['7️⃣ 收生', '「✅ 收生」：報名自動入嚟（連入數紙截圖連結）。接納前睇清楚⚠️未核對收款；批量接納一掣搞掂。'
      + 'CL 喺本 App 發接納／不接納通知書；區會財務核對收款後會自動轉 💰✔，退款後會見到 ↩ 已退款。STA 正本喺「📄 收表」度 tick。'],
    ['7️⃣b Budget V2', '如果收生後實際人數太多／太少，要大改預算，就喺「💵 收支」提交 Budget V2 俾管理層批。管理層批完會自動更新正式 Input01／Print_財政預算／收支表，避免用錯舊 budget。'],
    ['8️⃣ 學員名單', '「👥 學員」：學員編號自動排、分組（可自動梅花間竹）、緊急聯絡清單列印、CSV 匯出。'],
    ['9️⃣ 上課：點名', '「✍️ 簽到」：揀節次 → 學員 ✔/✗/遲/假 一掣 tick；職員簽到自動計服務時數。'
      + '第一次用先撳「對齊名單」開出席表。'],
    ['🔟 收支', '「💵 收支」：支出逐筆入帳；頂部「預算 vs 實際」即刻睇到每項仲有幾錢使（超支紅字）。'],
    ['1️⃣1️⃣ 完成模組', '「🎓 完成」：出席率自動計 → 評核（✔/✗＋證書編號，可自動編號）→ 合格名單 → 列印證書 → 完成報告一掣寫入 GS → 領取證書紀錄。完成後可在 ⚙️ 設定按「📦 標記已完成」，主清單就唔會越嚟越長。'],
  ];
  steps.forEach(function (x) {
    flow.appendChild(h('div', { class: 'guide-step' },
      h('div', { class: 'guide-step-title' }, x[0]),
      h('div', { class: 'guide-step-body' }, x[1])));
  });
  root.appendChild(flow);

  /* ── 管理層告知清單 ── */
  const mgmt = h('div', { class: 'card' });
  mgmt.appendChild(h('div', { class: 'card-title' }, '🏛️ 要向管理層攞嘅嘢（開班前後）'));
  mgmt.appendChild(h('table', { class: 'data-table' },
    h('thead', null, h('tr', null, h('th', null, '咩時候'), h('th', null, '攞咩'), h('th', null, '用喺邊'))),
    h('tbody', null,
      h('tr', null, h('td', { class: 'td-strong' }, '新開班前'), h('td', null, '區會開班網址（CourseFactory /exec）＋開班碼'),
        h('td', null, '連線畫面「🆕 新開班 → 🏛 連區會起表」')),
      h('tr', null, h('td', { class: 'td-strong' }, '填通告時'), h('td', null, '通告檔案編號（例：檔案編號: 26XX）'),
        h('td', null, '通告頁「檔案編號」')),
      h('tr', null, h('td', { class: 'td-strong' }, '填通告時'), h('td', null, '訓練班電郵（區會派俾呢個班用）'),
        h('td', null, '通告頁「訓練班電郵」——通告查詢行／通知書 ReplyTo 自動用佢')),
      h('tr', null, h('td', { class: 'td-strong' }, '掛載報名表時'), h('td', null, '不用人手入；用 CourseFactory 產生嘅公開課程ID，區管理系統 CourseLinks 自動保存'),
        h('td', null, '區管理系統輸入 Script URL／通告編號／網頁通告 URL 後，自動用公開課程ID對準成員系統報名表；成員系統不用人手設定')),
      h('tr', null, h('td', { class: 'td-strong' }, '批核時'), h('td', null, '（唔使你做）區管理層 tick「區會批准」'),
        h('td', null, '你喺儀表板「🚢 掛載流程」見到 ✔ 就出通告')))));
  root.appendChild(mgmt);

  /* ── FAQ ── */
  const faq = h('div', { class: 'card' });
  faq.appendChild(h('div', { class: 'card-title' }, '❓ 常見問題'));
  [
    ['密碼幾多？', '每班首次 1234，入去即刻改（班職員共用一個密碼）。錯 5 次鎖 10 分鐘。忘記密碼搵 ADC 重設。'],
    ['幾個職員一齊用得唔得？', '得。所有修改先存本機草稿，撳💾先寫入；同一格兩個人改咗會偵測到衝突，彈窗揀邊個版本。每 15 秒自動同步。'],
    ['撳咗💾話「有人快咗一步」？', '有人啱啱寫入過。系統已幫你重讀最新——再撳一次儲存就得（你嘅草稿仲喺度）。'],
    ['手機用得嗎？', '得，介面係手機先行。最好 add 去主畫面（PWA 風格）當 App 咁用。'],
    ['資料喺邊？', '全部喺每班自己嘅 Google Sheet；每班 Apps Script /exec 就係該班後端。APP 冇中央 server、唔會備份你啲資料去第二度；GS 就係唯一事實來源，區管理層隨時連結核對。'],
    ['點解多人會見到同一樣嘢？', '因為同一班職員都用同一組 /exec＋API Key＋班密碼連去同一張 Sheet。前端每 15 秒同步一次；儲存有 rev 防撞，唔會互相覆蓋。'],
    ['一個人可以睇兩個班嗎？', '可以。首頁可以保存多個班連線：A 班 exec/key 讀 A Sheet，B 班 exec/key 讀 B Sheet；按「切換訓練班」就揀返要開嗰班。'],
    ['舊版後端嘅班得唔得？', '得，唯獨密碼閘退回本機版（1234）；新功能（起表/批准格/完成模組）要 coursev5 後端先有，會顯示「舊版後端」提示。'],
  ].forEach(function (x) {
    faq.appendChild(h('div', { class: 'guide-step' },
      h('div', { class: 'guide-step-title' }, '❓ ' + x[0]),
      h('div', { class: 'guide-step-body' }, x[1])));
  });
  root.appendChild(faq);

  /* ── 區管理層版 ── */
  const admin = h('div', { class: 'card' });
  admin.appendChild(h('div', { class: 'card-title' }, '🏛️ 區管理層／ADC 版重點'));
  admin.appendChild(h('div', { class: 'guide-step' },
    h('div', { class: 'guide-step-body' },
      '① 部署 CourseFactory 一次（apps-script/CourseFactory.gs，見 COURSEV5-UPGRADE.md）→ 出「開班網址＋開班碼」俾 CL',
      h('br'),
      '② CL 交嚟嘅 GS＋SCRIPT 網址貼入區管理系統自己分頁 → 自動掛載成員系統',
      h('br'),
      '③ 批核淨係睇一個 API：getCourseSummary（課程資料・節次・職員・預算 8 類・通告檔案編號・訓練班電郵・批准狀態・報名數，一個 call 攞齊）——合約喺 docs/API.md',
      h('br'),
      '④ 批好 tick「區會批准」格（GS 參數分頁，或經你系統寫入），CL 就會見到 ✔',
      h('br'),
      '⑤ 收款核對：setPaymentCheck API（tick「已核對收款」）；退款：setCourseRefund；Budget 批核：approveBudgetVersion（一批完自動寫回 Input01 更新收支表）；完成後讀「Print_訓練班完成報告」連結成員系統紀錄')));
  admin.appendChild(h('div', { class: 'row-sub' }, (course && course.mock ? '📊 而家喺演示班——上面全部可以試' : '🎓 而家連住真班——小心啲掣係真嘅') + (st && st.info && st.info.name ? '：「' + st.info.name + '」' : '')));
  root.appendChild(admin);
});
