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
  arch.appendChild(h('div', { class: 'row-sub' }, '呢個 APP 本身冇中央 server——後端係「一張訓練班系統 GS（原點）」：貼一次 Apps Script、部署一次、run 一次 setup，之後所有班嘅開班／登記／讀寫全部經同一個 /exec（用每班 API Key／公開課程ID 自動對應返正確班別）。每班 Sheet 由原點自動產生同登記，CL 全程零技術欄位。'));
  root.appendChild(arch);

  /* ── 全流程 ── */
  const flow = h('div', { class: 'card' });
  flow.appendChild(h('div', { class: 'card-title' }, '🚀 全流程（CL 視角，逐步做）'));
  const steps = [
    ['1️⃣ 新開班', '連線畫面「🆕 新開班」：填課程名・屆別・支部・專章・收生・收費・你個名 → 撳「🏛 連區會起表」。'
      + '系統即刻自動起一張新班 Sheet＋自動登記（照教學模版），你即刻連線入去（首次密碼 1234，入去先改）。'
      + '⚠️ 要向管理層攞「訓練班系統 /exec」（原點 GS 部署出嚟嗰條；開班碼可選）先撳到呢個掣（演示掣唔使）。'
      + '全程唔使貼 template id／folder id／Script URL／API Key，唔使逐班部署。想新班 Sheet 自動加你（或其他 CL）做編輯者，可以填「班領導人電郵」。'
      + '班 Sheet 唔想放喺原點帳戶？第二條路：自己帳戶開空白 GS → 分享（編輯者）俾原點帳戶電郵 → 「📥 我已有 Sheet，登記就得」貼網址登記（結構自動補齊，班內容照常留喺你嗰邊）。'],
    ['2️⃣ 複製網址交區', '起表完會彈「📋 網址」視窗（班 GS 網址），一掣複製，交俾區管理層／貼入區管理系統。'
      + '之後區管理層就連結到你張 GS 睇資料批改（Script 連結＝訓練班系統同一條 /exec）。（儀表板「🚢 掛載流程」隨時可以再攞 URL）'],
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
      h('tr', null, h('td', { class: 'td-strong' }, '新開班前'), h('td', null, '訓練班系統 /exec（原點 GS 單一後端；開班碼可選）'),
        h('td', null, '連線畫面「🆕 新開班 → 🏛 連區會起表」（一班起完，下一班照用同一條）')),
      h('tr', null, h('td', { class: 'td-strong' }, '填通告時'), h('td', null, '通告檔案編號（例：檔案編號: 26XX）'),
        h('td', null, '通告頁「檔案編號」')),
      h('tr', null, h('td', { class: 'td-strong' }, '填通告時'), h('td', null, '訓練班電郵（區會派俾呢個班用）'),
        h('td', null, '通告頁「訓練班電郵」——通告查詢行／通知書 ReplyTo 自動用佢')),
      h('tr', null, h('td', { class: 'td-strong' }, '掛載報名表時'), h('td', null, '不用人手入；用訓練班系統開班時自動產生嘅公開課程ID，區管理系統 CourseLinks 自動保存'),
        h('td', null, '區管理系統輸入 Script URL／通告編號／網頁通告 URL 後，自動用公開課程ID對準成員系統報名表；成員系統不用人手設定')),
      h('tr', null, h('td', { class: 'td-strong' }, '批核時'), h('td', null, '（唔使你做）區管理層 tick「區會批准」'),
        h('td', null, '你喺儀表板「🚢 掛載流程」見到 ✔ 就出通告')))));
  root.appendChild(mgmt);

  /* ── FAQ ── */
  const faq = h('div', { class: 'card' });
  faq.appendChild(h('div', { class: 'card-title' }, '❓ 常見問題'));
  [
    ['密碼幾多？', '每班首次 1234，首次登入強制要改（唔改乜都寫唔到；班職員共用一個密碼）。右上角 🔑 可隨時再改、🚪 登出切換班別。錯 5 次鎖 10 分鐘。忘記密碼搵 ADC 用後備管理員重設。'],
    ['幾個職員一齊用得唔得？', '得。所有修改先存本機草稿，撳💾先寫入；同一格兩個人改咗會偵測到衝突，彈窗揀邊個版本。每 15 秒自動同步。'],
    ['撳咗💾話「有人快咗一步」？', '有人啱啱寫入過。系統已幫你重讀最新——再撳一次儲存就得（你嘅草稿仲喺度）。'],
    ['手機用得嗎？', '得，介面係手機先行。最好 add 去主畫面（PWA 風格）當 App 咁用。'],
    ['資料喺邊？', '全部喺每班自己嘅 Google Sheet（由訓練班系統原點 GS 自動產生＋登記）。讀寫經訓練班系統單一 /exec，用該班 API Key 自動對應。APP 唔會備份你啲資料去第二度；班 GS 就係唯一事實來源，區管理層隨時連結核對。'],
    ['點解多人會見到同一樣嘢？', '因為同一班職員都用同一組連線資料（訓練班系統 /exec＋該班 API Key＋班密碼）讀同一張班 Sheet。前端每 15 秒同步一次；儲存有 rev 防撞，唔會互相覆蓋。'],
    ['一個人可以睇兩個班嗎？', '可以。首頁可以保存多個班連線：全部經同一個訓練班系統 /exec，後端按每班 API Key 自動讀返對應 Sheet；按「切換訓練班」就揀返要開嗰班。'],
    ['舊制逐班部署嘅班得唔得？', '得。舊班用「🔧 進階／舊班：手動連線」貼該班自己嘅 /exec＋API Key 照舊用；亦可以用後台 importCourse 登記入原點，之後「從登記表選班」都揀到。'],
    ['班 Sheet 可唔可以唔放喺區會帳戶？', '得，而且好簡單：登記表（原點）只係指針，班 Sheet 可以喺任何帳戶開。自己帳戶開一張空白 Google Sheet → Drive 分享（編輯者）俾「原點帳戶電郵」（即部署訓練班系統嗰個帳戶；App「🆕 新開班 → 我已有 Sheet」有「🔎 查原點電郵」）→ 貼返網址登記。系統驗證讀取權後會就地補齊模版結構（只補缺、唔覆蓋你已有嘅內容）＋自動生成三件套連線資料。全程只係逐個檔案嘅 Drive 分享，冇人要交出帳戶密碼；班內容擁有權永遠留喺你嗰邊。'],
    ['原點帳戶電郵＝訓練班電郵？', '唔係，兩樣完全唔同嘅嘢，唔好淆：①「原點帳戶電郵」（hubInfo.ownerEmail）＝部署「訓練班系統 GS」嗰個 Google 帳戶，係成個系統嘅執行身分——模版同「訓練班文件」資料夾喺佢名下，所有班嘅讀寫（報名入表、tick 參數⋯）都以佢執行；你只係用「📥 我已有 Sheet，登記就得」先需要分享（編輯者）俾佢，用「🆕 新開班」就完全唔使（Sheet 自動生喺原點帳戶）。②「訓練班電郵」＝每個班自己嘅查詢電郵（管理層派俾該班），填喺通告頁「訓練班電郵」格（寫入班 GS「參數」分頁），通告查詢行同接納／不接納通知書 ReplyTo 自動用佢；每班一個、班班可以唔同。兩者互不相干——千祈唔好將原點帳戶電郵填做訓練班電郵，亦唔使將訓練班電郵分享俾原點。'],
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
      '① 訓練班系統原點：用一個專門嘅非機密帳戶開一張 GS → 貼一個檔案（apps-script/CourseHub.gs，見 apps-script/COURSEHUB.md）→ 手動 run 一次 setup()（自動完成訓練班登記等所有設定，並自動產生「區系統密匙」同後台帳密——開一次「設定」分頁抄低）→ 部署一次 → 出「訓練班系統 /exec（＋開班碼，可選）」俾 CL；之後每個訓練班自動開一張 Sheet，唔使再部署。登記表只係指針——班 Sheet 可以喺任何帳戶開（「我已有 Sheet，登記就得」），原點只靠逐個檔案 Drive 分享存取，冇人需要交帳戶',
      h('br'),
      '② CL 交嚟嘅 GS 網址貼入區管理系統自己分頁，並將「區系統密匙 opsKey」貼入區系統設定（一次）→ 區系統靠 opsKey＋公開課程ID 對接所有班、自動掛載成員系統；成員報名 addReg 只憑公開課程ID、只寫不讀',
      h('br'),
      '③ 批核淨係睇一個 API：getCourseSummary（課程資料・節次・職員・預算 8 類・通告檔案編號・訓練班電郵・批准狀態・報名數，一個 call 攞齊，opsKey 白名單已包）——合約喺 docs/API.md',
      h('br'),
      '④ 批好 tick「區會批准」格：必須經 setParamLabel 帶 opsKey 寫入（人手開 GS 勾都得，但 APP 流程以 API 為準），CL 就會見到 ✔',
      h('br'),
      '⑤ 收款核對：setPaymentCheck API（tick「已核對收款」）；退款：setCourseRefund；Budget 批核：approveBudgetVersion（一批完自動寫回 Input01 更新收支表）；完成後讀「Print_訓練班完成報告」連結成員系統紀錄')));
  admin.appendChild(h('div', { class: 'row-sub' }, (course && course.mock ? '📊 而家喺演示班——上面全部可以試' : '🎓 而家連住真班——小心啲掣係真嘅') + (st && st.info && st.info.name ? '：「' + st.info.name + '」' : '')));
  root.appendChild(admin);
});
