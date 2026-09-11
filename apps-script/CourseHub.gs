/*************************************************************
 * CourseHub.gs — 訓練班系統唯一後端（單一檔案部署）
 *
 * 一張「訓練班系統 GS」做原點，全程只需要：
 *   1. 開一張新 Google Sheet → 擴充功能 → Apps Script
 *   2. 貼入【本檔案】（只需要呢一個檔案）
 *   3. 手動 run 一次 `setup()` → 自動完成「訓練班登記」等所有設定：
 *      設定／訓練班登記／_Auth／_Meta 分頁＋Drive 資料夾＋開班文件模版
 *   4. 部署做網頁應用程式（執行身分：我自己；存取：任何人）→ 攞 /exec
 *
 * 之後每個訓練班＝自動開一張 Sheet（CL 喺前端「🆕 新開班」填課程資料
 * 就得，零貼 ID、零逐班部署）；所有讀寫經同一個 /exec，
 * 按每班 API Key／公開課程ID 自動對應返正確班別。
 *
 * ⚠️ 唔好將舊制檔案（CourseFactory.gs／Auth.gs／PaymentCheck.gs…）
 *    貼入同一個專案——同名函式會撞。舊制逐班部署嘅班照舊用佢自己嘅部署。
 *
 * 本檔四段：
 *   〔一〕模版規格（純數據；同前端座標凍結一致，測試鎖住）
 *   〔二〕setup——原點 GS 自動建立／整理（幂等；可分段重入）
 *   〔三〕Hub 路由——對應＋開班＋登記＋選班＋後台
 *   〔四〕CourseSheet——coursev5 合約（每班讀寫；回應格式零改變）
 *
 * 詳見 apps-script/COURSEHUB.md；合約見 docs/API.md。
 *************************************************************/


/* ════════════════════════ 〔一〕模版規格 ════════════════════════ */

/*************************************************************
 * CourseHub · TemplateLayout（P0：模版規格＝唯一事實來源）
 *
 * 呢個檔案（〔一〕模版規格段）係「開班文件模版」嘅**數據驅動規格**：
 *   - 〔二〕嘅 setup() 讀佢，喺 Drive 自動起「開班文件模版」GS
 *   - 前端 mock（js/15-mock.js mockBlankState）係佢嘅鏡像
 *   - tests/t_hub.js 會逐項對帳（欄數／表頭／必要格）
 *
 * ⚠️ 呢段係純數據（冇任何 GAS API 呼叫），可以直接用 node 載入測試。
 * ⚠️ 座標全部跟 v4.13.0 模版（js/00-config.js／docs/sheet-layouts.md），
 *    唔可以改座標；要改版面就三方一齊改。
 *
 * 格式：
 *   TPL_TABS[] = {
 *     name:  分頁名（同前端 TAB 常數一致）,
 *     rows/cols: 空白工作簿尺寸,
 *     cells: [[row, col, 固定值], ...]（1-based）,
 *     formulas: [[row, col, '=公式'], ...],
 *     headerRow: [第一行表頭...]（表格回應用）,
 *     formulaCols: [{col, fromRow, f:'={r} 代入行號'}]（大量直行公式）,
 *     hidden: 隱藏分頁
 *   }
 *************************************************************/

var HUB_TEMPLATE_VERSION = '1.0.0';

/* ── 表格回應表頭（53 欄 A–BA；同前端 js/00-config.js RESP_HEADERS 完全一致）── */
var TPL_RESP_HEADERS = [
  '時間戳記', '電郵地址', '中文姓名', '英文姓名', '聯絡電話', '性別', '出生日期',
  '所屬童軍區', '旅團', '童軍成員編號（ScoutID）', '童軍職位',
  '附加資料(有助訓練班取錄之原因)',
  '家長／監護人同意參與有關活動。', '家長/監護人姓名', '與申請人關係',
  '家長/監護人聯絡電郵', '家長/監護人聯絡電話',
  '所屬童軍旅領袖同意參與有關活動。', '領袖姓名（中文全名）', '領袖職位', '領袖聯絡電郵',
  '付款方式', '付款人姓名', '付款帳戶',
  '已繳付訓練班費用截圖', '已填妥之表格截圖(上課時需交回正本)', '是否需要收據', '備註',
  '接納', '旅號', 'Region flag', 'Troop flag', 'Seq in group', 'Sequence Ref', '學員編號', '分組',
  '審批狀態', '批核人', '批核時間', '_courseId', '_courseTitle', '_section', '_badgeCode', '_ref',
  '已核對收款', '核對人', '核對時間', '已交表格正本（STA）', '收表記錄',
  '已退款', '退款核對人', '通知書', '通知書寄出時間'
];

/* ── Input02 職員表預設職位（行 23–42；同前端 STAFF_ROLE_DEFAULTS）── */
var TPL_IN2_ROLES = [
  '班領導人', '副班領導人', '副班領導人', '助理班領導人',
  '小隊導師', '小隊導師', '小隊導師', '小隊導師',
  '團隊長', '團隊長', '班務行政', '物資管理', '物資管理',
  '講師', '講師', '講師', '講師', '講師', '講師', '講師'
];

/* ── Input03 時間表：每節一個 10 行 block（第 1 節 head=2；最多 9 節）── */
function tplIn3Cells() {
  var cells = [];
  for (var i = 0; i < 9; i++) {
    var head = 2 + i * 10;
    cells.push([head, 2, '日期：'], [head, 5, '地點：']);
    cells.push([head + 1, 2, '時間：'], [head + 1, 5, '服裝：']);
    cells.push([head + 3, 2, '時 間'], [head + 3, 3, '需時（分鐘）'], [head + 3, 4, '項目'], [head + 3, 5, '負責人']);
  }
  return cells;
}

/* ── Input04 支出表：收據編號 1–35（行 8–42）── */
function tplIn4Cells() {
  var cells = [
    [1, 1, '筲箕灣童軍區會'], [2, 1, '活動支出'],
    [6, 1, '類別'], [6, 2, '茶　點'], [6, 3, '膳食津貼'], [6, 4, '職員膳食'], [6, 5, '住　宿'],
    [6, 6, '交通'], [6, 7, '行　政'], [6, 8, '講義及快勞'], [6, 9, '其　他'], [6, 10, '設　備'], [6, 11, '備註'],
    [7, 1, '收據編號']
  ];
  for (var r = 8; r <= 42; r++) cells.push([r, 1, r - 7]);
  return cells;
}

/* ── Input02 節次公式（行 9–16）── */
function tplIn2Formulas() {
  var fs = [
    [1, 2, "='Input01 訓練班預算'!B1"],      /* B1 名稱（黃格：由預算帶入） */
    [4, 2, "='Input01 訓練班預算'!B11"],     /* B4 名額 */
    [5, 2, "='Input01 訓練班預算'!B12"],     /* B5 收費 */
    [6, 2, "='Input01 訓練班預算'!B13"],     /* B6 職員人數 */
    [45, 2, '=COUNTA($B$23:$B$42)']          /* B45 班職員總人數 */
  ];
  for (var r = 9; r <= 16; r++) {
    fs.push([r, 7, '=IF($B' + r + '="","",TEXT($B' + r + ',"yyyy年m月d日（aaaa）"))']);                              /* G 自動中文日期（只讀） */
    fs.push([r, 9, '=IF(OR($B' + r + '="",NOT($H' + r + ')),"",TEXT($B' + r + ',"yyyy年m月d日（aaaa）"))']);         /* I 通告顯示日期（預設公式） */
    fs.push([r, 10, '=IF(OR($D' + r + '="",NOT($H' + r + ')),"",SUBSTITUTE($D' + r + '," - ","至"))']);              /* J 通告顯示時間 */
    fs.push([r, 11, '=IF(OR($E' + r + '="",NOT($H' + r + ')),"",$E' + r + ')']);                                     /* K 通告顯示地點 */
  }
  return fs;
}

var TPL_TABS = [
  {
    name: 'Input01 訓練班預算', rows: 105, cols: 13,
    cells: [
      [1, 1, '活動/訓練班名稱'],
      [4, 1, '屆別'], [4, 3, '屆'],
      [5, 1, '支部'],
      [6, 1, '專章'],
      [7, 1, '自定義名稱'],
      [8, 1, '形式-1'], [9, 1, '形式-2'],
      [11, 1, '預計收生人數'], [11, 3, '名'],
      [12, 1, '預計收費'], [12, 3, '元'],
      [13, 1, '職員人數'], [13, 3, '人 (不計算講師)'],
      [15, 2, 'dd/mm/yyyy'], [15, 3, '0000 - 2359'], [15, 5, '場地'],
      [16, 1, '活動日期及場地'],
      [29, 1, '1. 膳食 Catering'],
      [31, 2, '日期'], [31, 3, '時間'], [31, 5, '早餐'], [31, 6, '午餐'], [31, 7, '晚餐'], [31, 8, '茶點'], [31, 9, '飲用水'], [31, 10, '職員/學員'],
      [44, 1, '2. 租金Rent'],
      [46, 2, '地點'], [46, 3, '時段'], [46, 6, '數量'], [46, 8, '單價'],
      [67, 1, '3. 交通/運輸Transportation'],
      [101, 1, '8. 其他 Miscelleous (請註明 Please specify)']
    ]
  },
  {
    name: 'Input02 訓練班資料', rows: 50, cols: 12,
    cells: [
      [1, 1, '活動/訓練班名稱'],
      [4, 1, '名額'], [4, 3, '名'],
      [5, 1, '預計收費'], [5, 3, '元'],
      [6, 1, '職員人數'], [6, 3, '人 (不計算講師)'],
      [8, 2, 'dd/mm/yyyy'], [8, 3, '橫跨至下一日?'], [8, 4, '0000 - 2359'], [8, 5, '場地'],
      [8, 7, '（自動）'], [8, 8, '✓上通告'], [8, 9, '通告顯示日期'], [8, 10, '通告顯示時間'], [8, 11, '通告顯示地點'],
      [9, 1, '活動日期及場地'],
      [18, 1, '截止報名日期'], [19, 1, '最遲公佈取錄名單日'],
      [21, 1, '職員資料'],
      [22, 1, '職位'], [22, 2, '姓名'], [22, 3, '稱謂'], [22, 4, '所屬單位 / 職銜'], [22, 5, '資格標註'], [22, 6, '電話'], [22, 7, '電郵'],
      [45, 1, '班職員總人數'], [46, 1, '常駐班職員人數']
    ].concat(TPL_IN2_ROLES.map(function (role, i) { return [23 + i, 1, role]; })),
    formulas: tplIn2Formulas()
  },
  { name: 'Input03 時間表', rows: 95, cols: 8, cells: tplIn3Cells() },
  { name: 'Input04_Print支出表', rows: 46, cols: 11, cells: tplIn4Cells() },
  {
    name: '表格回應', rows: 301, cols: 53,
    headerRow: TPL_RESP_HEADERS,
    formulaCols: [
      /* AD 旅號（旅團抽數字；公式欄只讀） */
      { col: 30, fromRow: 2, f: '=IF($I{r}="","",IFERROR(REGEXEXTRACT($I{r}&"","\\d+"),""))' },
      /* AI 學員編號（✔ 行 COUNTIF，報名次序；公式欄只讀） */
      { col: 35, fromRow: 2, f: '=IF($AC{r}="✔",COUNTIF($AC$2:$AC{r},"✔"),"")' }
    ]
  },
  {
    name: '參數', rows: 12, cols: 2,
    cells: [
      [1, 1, '區會常數（唔好改名）'],
      [2, 1, '成員系統報名網址'],
      [3, 1, '公開課程ID'],
      [4, 1, '成員系統直接報名連結'],
      [5, 1, 'FPS 識別碼'],
      [6, 1, 'FPS 戶口名稱'],
      [7, 1, '區會網址'],
      [8, 1, '區會批准'],
      [9, 1, '訓練班電郵']
    ]
  },
  { name: 'Print_通告', rows: 48, cols: 8, cells: [] },
  { name: 'Print_學員出席紀錄', rows: 64, cols: 16, cells: [] },
  {
    name: 'Print_訓練班完成報告', rows: 46, cols: 8,
    cells: [
      [2, 1, '訓練班完成報告'],
      [4, 1, '舉辦日期：'],
      [5, 1, '報班人數（本區）：'], [5, 5, '報班人數（他區）：'],
      [6, 1, '接納人數（本區）：'], [6, 5, '接納人數（他區）：'],
      [7, 1, '完成人數：'], [7, 5, '合格人數：'],
      [9, 1, '學員編號'], [9, 2, '中文姓名'], [9, 3, '旅號'], [9, 4, '證書編號'], [9, 5, '合格與否'], [9, 6, '不合格原因']
    ]
  },
  {
    name: 'Print_領取證書紀錄', rows: 44, cols: 8,
    cells: [
      [1, 2, '領取證書紀錄'],
      [3, 4, '舉辦日期：'], [4, 4, '班領導人：'],
      [6, 2, '學員編號'], [6, 3, '中文姓名'], [6, 4, '旅號'], [6, 5, '證書編號'], [6, 6, '領取日期'], [6, 7, '簽收']
    ]
  },
  { name: '_Sync', rows: 5, cols: 3, hidden: true, cells: [[1, 1, 0]] }
];

/* ════════════════════ 〔二〕setup：原點 GS 自動建立 ════════════════════ */

/*************************************************************
 * CourseHub · Setup（原點 GS 自動建立／整理）
 *
 * 用法（一次過；重複 run 安全、幂等）：
 *   1. 開一張新 Google Sheet＝「訓練班系統 GS」（原點）
 *   2. 擴充功能 → Apps Script → 貼入本檔案（CourseHub.gs；單一檔案）
 *   3. 喺編輯器手動 run 一次 `setup()`（首次會彈授權）
 *   4. 部署為網頁應用程式（執行身分：我自己；存取：任何人）→ 攞 /exec
 *
 * setup() 會自動：
 *   - 建「設定」分頁（A欄 label／B欄 value；全部可留空都有默认行為）
 *   - 建「訓練班登記」分頁（每班一行；對應之源）
 *   - 建「_Auth」隱藏分頁（每班密碼 hash＋API Key；設保護）
 *   - 建「_Meta」隱藏分頁（模版／資料夾 ID；setup 自動寫，唔使人手貼）
 *   - 喺 Drive 自動開「訓練班文件」資料夾
 *   - 照 TemplateLayout 規格自動起「開班文件模版」GS（makeCopy 用）
 *
 * 6 分鐘時限對策：setup() 拆做幾段，每段可以獨立手動重入：
 *   setup() ／ setupTemplate() ／ setupRegistry()
 *************************************************************/

var HUB_CONFIG_SHEET = '設定';
var HUB_REGISTRY_SHEET = '訓練班登記';
var HUB_AUTH_SHEET = '_Auth';
var HUB_META_SHEET = '_Meta';
var HUB_FOLDER_NAME = '訓練班文件';
var HUB_TEMPLATE_NAME = '開班文件模版（自動產生）';

/* ── 設定分頁預設行（setup 自動種；人手只需要改「值」，永遠唔使貼 ID）── */
function hubConfigDefaults_() {
  return [
    ['成員系統報名網址', ''],
    ['區管理電郵', ''],
    ['開班碼', ''],
    ['開班碼SHA256', ''],
    ['FPS 識別碼', ''],
    ['FPS 戶口名稱', ''],
    ['區會網址', ''],
    ['模版檔案模式', 'auto']
  ];
}

function hubRegistryHeaders_() {
  return ['內部課程ID', '公開課程ID', '課程名稱', 'API Key hash', 'GS檔案ID', 'GS網址', 'Script /exec（舊班）', '狀態', '班領導人', '建立時間'];
}
function hubAuthHeaders_() {
  return ['內部課程ID', '密碼hash', 'API Key', '更新時間'];
}
function hubMetaKeys_() {
  return ['模版檔案ID', '資料夾ID', '模版版本', 'hub版本', 'setupAt'];
}

/* ══════════ 主入口 ══════════ */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  hubEnsureConfigSheet_(ss);
  hubEnsureRegistrySheet_(ss);
  hubEnsureAuthSheet_(ss);
  hubEnsureMetaSheet_(ss);
  hubEnsureDriveAssets_(ss);
  hubSetMeta_(ss, 'hub版本', HUB_VERSION);
  hubSetMeta_(ss, 'setupAt', new Date().toISOString());
  Logger.log('setup 完成——而家可以部署做網頁應用程式。');
}

/* 獨立段：只重建／整理模版（模版唔見咗或者要升級時用） */
function setupTemplate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  hubEnsureMetaSheet_(ss);
  hubEnsureDriveAssets_(ss, true);
}

/* 獨立段：只整理登記表／設定結構 */
function setupRegistry() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  hubEnsureConfigSheet_(ss);
  hubEnsureRegistrySheet_(ss);
  hubEnsureAuthSheet_(ss);
  hubEnsureMetaSheet_(ss);
}

/* ══════════ 原點 GS 分頁 ══════════ */

function hubEnsureConfigSheet_(ss) {
  var sh = ss.getSheetByName(HUB_CONFIG_SHEET) || ss.insertSheet(HUB_CONFIG_SHEET);
  var have = {};
  if (sh.getLastRow() > 0) {
    sh.getRange(1, 1, sh.getLastRow(), 1).getValues().forEach(function (r) {
      have[String(r[0] || '').trim()] = true;
    });
  }
  var add = hubConfigDefaults_().filter(function (p) { return !have[p[0]]; });
  if (add.length) {
    var at = Math.max(sh.getLastRow(), 0) + 1;
    sh.getRange(at, 1, add.length, 2).setValues(add);
  }
}

function hubEnsureRegistrySheet_(ss) {
  var sh = ss.getSheetByName(HUB_REGISTRY_SHEET) || ss.insertSheet(HUB_REGISTRY_SHEET);
  var heads = hubRegistryHeaders_();
  var row1 = sh.getLastRow() >= 1 ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0] : [];
  var need = [];
  heads.forEach(function (h, i) { if (String(row1[i] || '').trim() !== h) need.push([i + 1, h]); });
  need.forEach(function (x) { sh.getRange(1, x[0]).setValue(x[1]); });
}

function hubEnsureAuthSheet_(ss) {
  var sh = ss.getSheetByName(HUB_AUTH_SHEET) || ss.insertSheet(HUB_AUTH_SHEET);
  var heads = hubAuthHeaders_();
  var row1 = sh.getLastRow() >= 1 ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0] : [];
  heads.forEach(function (h, i) { if (String(row1[i] || '').trim() !== h) sh.getRange(1, i + 1).setValue(h); });
  try { sh.hideSheet(); } catch (e) { /* 已隱藏 */ }
  /* 保護：只 script／擁有者可改（設警告，唔阻 script 寫入） */
  var prots = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  if (!prots.length) {
    var p = sh.protect(SpreadsheetApp.ProtectionType.SHEET);
    p.setDescription('訓練班系統密碼／API Key（唔好手改）');
    p.setWarningOnly(true);
  }
}

function hubEnsureMetaSheet_(ss) {
  var sh = ss.getSheetByName(HUB_META_SHEET) || ss.insertSheet(HUB_META_SHEET);
  var have = {};
  if (sh.getLastRow() > 0) {
    sh.getRange(1, 1, sh.getLastRow(), 1).getValues().forEach(function (r) { have[String(r[0] || '').trim()] = true; });
  }
  var at = Math.max(sh.getLastRow(), 0) + 1;
  hubMetaKeys_().forEach(function (k) {
    if (!have[k]) { sh.getRange(at, 1).setValue(k); sh.getRange(at, 2).setValue(''); at++; }
  });
  try { sh.hideSheet(); } catch (e) { /* 已隱藏 */ }
}

/* ══════════ Drive 資產（資料夾＋模版；ID 自動寫 _Meta，唔使人手貼）══════════ */

function hubEnsureDriveAssets_(ss, forceTemplate) {
  var meta = hubMeta_(ss);

  /* 1. 資料夾：_Meta 有就用；冇就喺原點 GS 隔離開「訓練班文件」 */
  var folder = null;
  if (meta['資料夾ID']) {
    try { folder = DriveApp.getFolderById(meta['資料夾ID']); } catch (e) { folder = null; }
  }
  if (!folder) {
    var parent = null;
    try {
      var it = DriveApp.getFileById(ss.getId()).getParents();
      if (it.hasNext()) parent = it.next();
    } catch (e) { parent = null; }
    folder = parent ? parent.createFolder(HUB_FOLDER_NAME) : DriveApp.createFolder(HUB_FOLDER_NAME);
    hubSetMeta_(ss, '資料夾ID', folder.getId());
  }

  /* 2. 模版：manual 模式＝用人手指定檔案（逃生口）；auto＝setup 自動起 */
  var cfg = hubConfig_(ss);
  var tpl = null;
  if (meta['模版檔案ID'] && !forceTemplate) {
    try { tpl = SpreadsheetApp.openById(meta['模版檔案ID']); } catch (e) { tpl = null; }
  }
  if (!tpl && String(cfg.templateMode || 'auto') === 'manual' && cfg.templateId) {
    try { tpl = SpreadsheetApp.openById(cfg.templateId); } catch (e2) { tpl = null; }
  }
  if (!tpl) {
    tpl = hubBuildTemplate_(folder);
    hubSetMeta_(ss, '模版檔案ID', tpl.getId());
  } else {
    hubRepairTemplate_(tpl);   /* 整理：補返缺嘅分頁／表頭 */
  }
  hubSetMeta_(ss, '模版版本', HUB_TEMPLATE_VERSION);
}

/* 照 TemplateLayout 起一張全新模版 GS */
function hubBuildTemplate_(folder) {
  var f = SpreadsheetApp.create(HUB_TEMPLATE_NAME);
  var file = DriveApp.getFileById(f.getId());
  try {
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  } catch (e) { /* 權限不足就留喺根資料夾，唔阻開班 */ }

  var sheets = f.getSheets();
  var first = sheets[0];
  TPL_TABS.forEach(function (spec, i) {
    var sh = i === 0 ? first : f.insertSheet(spec.name);
    if (i === 0) sh.setName(spec.name);
    hubApplyTpl_(sh, spec);
  });
  return f;
}

/* 整理既有模版：缺分頁補分頁、缺表頭補表頭（唔覆蓋已有內容） */
function hubRepairTemplate_(ss) {
  TPL_TABS.forEach(function (spec) {
    var sh = ss.getSheetByName(spec.name);
    if (!sh) { sh = ss.insertSheet(spec.name); hubApplyTpl_(sh, spec); return; }
    /* 只補第一行表頭（表格回應）同 _Sync rev 格 */
    if (spec.headerRow) {
      var row1 = sh.getRange(1, 1, 1, spec.headerRow.length).getValues()[0];
      spec.headerRow.forEach(function (h, i) {
        if (String(row1[i] || '').trim() === '') sh.getRange(1, i + 1).setValue(h);
      });
    }
    if (spec.name === '_Sync' && String(sh.getRange(1, 1).getValue() || '').trim() === '') {
      sh.getRange(1, 1).setValue(0);
    }
    if (spec.hidden) { try { sh.hideSheet(); } catch (e) { /* 已隱藏 */ } }
  });
}

/* 將一份 TPL spec 寫入分頁 */
function hubApplyTpl_(sh, spec) {
  if (spec.rows && spec.cols) {
    /* 預先確保尺寸（插入行／欄） */
    if (sh.getMaxRows() < spec.rows) sh.insertRowsAfter(sh.getMaxRows(), spec.rows - sh.getMaxRows());
    if (sh.getMaxColumns() < spec.cols) sh.insertColumnsAfter(sh.getMaxColumns(), spec.cols - sh.getMaxColumns());
  }
  if (spec.headerRow) {
    sh.getRange(1, 1, 1, spec.headerRow.length).setValues([spec.headerRow]);
  }
  if (spec.cells && spec.cells.length) {
    spec.cells.forEach(function (c) { sh.getRange(c[0], c[1]).setValue(c[2]); });
  }
  if (spec.formulas && spec.formulas.length) {
    spec.formulas.forEach(function (c) { sh.getRange(c[0], c[1]).setFormula(c[2]); });
  }
  if (spec.formulaCols && spec.formulaCols.length) {
    spec.formulaCols.forEach(function (fc) {
      var last = Math.max(spec.rows || sh.getMaxRows(), fc.fromRow);
      var fs = [];
      for (var r = fc.fromRow; r <= last; r++) fs.push([fc.f.split('{r}').join(String(r))]);
      sh.getRange(fc.fromRow, fc.col, fs.length, 1).setFormulas(fs);
    });
  }
  if (spec.hidden) { try { sh.hideSheet(); } catch (e) { /* 已隱藏 */ } }
}

/* ══════════ 設定／Meta 讀寫 ══════════ */

function hubConfig_(ss) {
  var out = {};
  var sh = ss.getSheetByName(HUB_CONFIG_SHEET);
  if (!sh || sh.getLastRow() < 1) return out;
  var vals = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  var aliases = {
    '開班碼': 'plainKey', '管理碼': 'plainKey',
    '開班碼SHA256': 'keyHash', 'FACTORY_KEY_HASH': 'keyHash',
    '成員系統報名網址': 'memberPortalUrl', 'MEMBER_PORTAL_URL': 'memberPortalUrl',
    '區管理電郵': 'opsEmail', 'OPS_EMAIL': 'opsEmail',
    'FPS 識別碼': 'fpsId', 'FPS 戶口名稱': 'fpsName', '區會網址': 'districtWeb',
    '模版檔案模式': 'templateMode', '模版GS檔案ID': 'templateId', '模版檔案ID': 'templateId'
  };
  vals.forEach(function (row) {
    var label = String(row[0] || '').trim();
    if (!label) return;
    out[aliases[label] || label] = String(row[1] == null ? '' : row[1]).trim();
  });
  if (!out.keyHash && out.plainKey) out.keyHash = hubSha256_(out.plainKey);
  return out;
}

function hubMeta_(ss) {
  var out = {};
  var sh = ss.getSheetByName(HUB_META_SHEET);
  if (!sh || sh.getLastRow() < 1) return out;
  sh.getRange(1, 1, sh.getLastRow(), 2).getValues().forEach(function (row) {
    var k = String(row[0] || '').trim();
    if (k) out[k] = String(row[1] == null ? '' : row[1]).trim();
  });
  return out;
}

function hubSetMeta_(ss, key, value) {
  hubEnsureMetaSheet_(ss);
  var sh = ss.getSheetByName(HUB_META_SHEET);
  var last = Math.max(sh.getLastRow(), 1);
  var vals = sh.getRange(1, 1, last, 2).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.getRange(last + 1, 1, 1, 2).setValues([[key, value]]);
}

/* ════════════════════ 〔三〕Hub 路由：對應＋開班＋登記 ════════════════════ */

/*************************************************************
 * CourseHub · 訓練班系統唯一後端（一張原點 GS，部署一次）
 *
 * 取代舊制「每班一個 bound script／部署」：
 *   - 所有訓練班共用呢一個 /exec
 *   - 每個請求用 API Key（SHA-256 對「訓練班登記」）／內部課程ID／
 *     公開課程ID 對應到正確班別（該班 GS 工作簿）
 *   - 開班／登記／模版／設定全部由「訓練班系統 GS」自動管理（見 HubSetup.gs）
 *
 * 貼入原點 GS 嘅 Apps Script 項目**只需要本檔案**（單一檔案部署）。
 * （CourseFactory.gs／Auth.gs 等係舊制逐班部署用，唔好貼入同一個專案）
 *
 * ── 兩類 action ──
 * Hub actions（唔使班別對應）：
 *   hubInfo／createCourse／listCourses／connectCourseByPassword／
 *   setParamLabel／adminListCourses／adminDeleteCourse／importCourse
 * Course actions（coursev5 合約，回應格式零改變；逐一對應到班）：
 *   getCourseSheetRaw／getCourseProfile／getCourseSummary／saveCourseBatch／
 *   setCourseCells／addReg／listRegs／setRegStatus／addExpenseRow／
 *   setCompletionRow／setCertRow／setPaymentCheck／setCourseRefund／
 *   sendRegNotice／submitBudgetVersion／listBudgetVersions／
 *   approveBudgetVersion／auth／setPassword
 *
 * ── 保安 ──
 *   - 「訓練班登記」只存 API Key **hash**（唔再明文——修正舊制弱點）；
 *     明文 key 只喺 createCourse 回應出現一次＋存喺隱藏保護嘅 _Auth 分頁
 *     （「從登記表選班」輸入班密碼後先取回）
 *   - 每班密碼存 _Auth（冇行＝首次密碼 1234）；錯 5 次鎖 10 分鐘（按班）
 *   - 後備管理員「帳號:密碼」只寫喺下面常數
 *************************************************************/

var HUB_VERSION = '6.0.0';

var HUB_ADMIN_USER = 'sheep';   /* 後台清理／後備管理員（只寫喺呢度） */
var HUB_ADMIN_PW = '0728';

var HUB_DEFAULT_PW = '1234';
var HUB_PW_MIN_LEN = 4;
var HUB_PW_MAX_FAIL = 5;
var HUB_PW_LOCK_MINUTES = 10;

function hubJsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function hubSha256_(s) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    String(s == null ? '' : s), Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function hubId_(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}
function hubExecUrl_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

/* ══════════ 入口 ══════════ */

function doGet() {
  return hubJsonOut_(hubInfo({}));
}

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);
    var a = String(b.action || '');
    /* hub actions */
    if (a === 'hubInfo') return hubJsonOut_(hubInfo(b));
    if (a === 'createCourse') return hubJsonOut_(hubCreateCourse_(b));
    if (a === 'listCourses') return hubJsonOut_(hubListCourses_(b));
    if (a === 'connectCourseByPassword') return hubJsonOut_(hubConnectByPassword_(b));
    if (a === 'setParamLabel') return hubJsonOut_(hubSetParamLabel_(b));
    if (a === 'adminListCourses') return hubJsonOut_(hubAdminList_(b));
    if (a === 'adminDeleteCourse') return hubJsonOut_(hubAdminDelete_(b));
    if (a === 'importCourse') return hubJsonOut_(hubImportCourse_(b));
    /* course actions：對應到班 → 行 coursev5 合約 */
    var r = hubRequireCourse_(b);
    if (!r.ok) return hubJsonOut_(r);
    return hubJsonOut_(hubDispatchCourse_(a, r.row, b));
  } catch (err) {
    return hubJsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function hubInfo(b) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var meta = hubMeta_(ss);
  var rows = hubRegistryRows_(ss);
  var active = 0, archived = 0;
  rows.forEach(function (r) {
    if (r.status === 'archived' || r.status === 'completed') archived++; else active++;
  });
  return {
    ok: true,
    data: {
      hubVersion: HUB_VERSION,
      templateVersion: meta['模版版本'] || HUB_TEMPLATE_VERSION,
      setupAt: meta['setupAt'] || '',
      ready: !!(meta['模版檔案ID'] && meta['資料夾ID']),
      courses: { active: active, archived: archived }
    }
  };
}

/* ══════════ 登記表（對應之源）══════════
 * 欄：內部課程ID／公開課程ID／課程名稱／API Key hash／GS檔案ID／GS網址／
 *     Script /exec（舊班）／狀態／班領導人／建立時間
 */
function hubRegistryRows_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(HUB_REGISTRY_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  var heads = hubRegistryHeaders_();
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, heads.length).getValues();
  var out = [];
  vals.forEach(function (v, i) {
    var courseId = String(v[0] || '').trim();
    if (!courseId) return;
    out.push({
      courseId: courseId,
      publicCourseId: String(v[1] || '').trim(),
      name: String(v[2] || '').trim(),
      keyHash: String(v[3] || '').trim(),
      fileId: String(v[4] || '').trim(),
      url: String(v[5] || '').trim(),
      exec: String(v[6] || '').trim(),      /* 舊班先有值＝該班自己嘅 /exec */
      status: String(v[7] || 'active').trim() || 'active',
      cl: String(v[8] || '').trim(),
      createdAt: String(v[9] || '').trim(),
      _row: i + 2
    });
  });
  return out;
}

function hubAppendRegistry_(ss, row) {
  var sh = ss.getSheetByName(HUB_REGISTRY_SHEET);
  if (!sh) return false;
  sh.appendRow([
    row.courseId, row.publicCourseId, row.name, row.keyHash,
    row.fileId, row.url, row.exec || '', row.status || 'active',
    row.cl || '', row.createdAt || new Date().toISOString()
  ]);
  return true;
}

function hubDeleteRegistryRow_(ss, courseId) {
  var sh = ss.getSheetByName(HUB_REGISTRY_SHEET);
  if (!sh || sh.getLastRow() < 2) return;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === courseId) sh.deleteRow(i + 2);
  }
}

/* ══════════ _Auth（每班密碼 hash＋API Key；隱藏＋保護）══════════ */

function hubAuthRows_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(HUB_AUTH_SHEET);
  if (!sh || sh.getLastRow() < 2) return {};
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  var out = {};
  vals.forEach(function (v, i) {
    var id = String(v[0] || '').trim();
    if (!id) return;
    out[id] = { pwHash: String(v[1] || '').trim(), apiKey: String(v[2] || '').trim(), _row: i + 2 };
  });
  return out;
}

function hubAuthSave_(ss, courseId, fields) {
  var sh = ss.getSheetByName(HUB_AUTH_SHEET);
  if (!sh) return;
  var rows = hubAuthRows_(ss);
  var at = rows[courseId] ? rows[courseId]._row : (sh.getLastRow() + 1);
  var cur = rows[courseId] || { pwHash: '', apiKey: '' };
  var next = {
    pwHash: fields.pwHash !== undefined ? fields.pwHash : cur.pwHash,
    apiKey: fields.apiKey !== undefined ? fields.apiKey : cur.apiKey
  };
  sh.getRange(at, 1, 1, 4).setValues([[courseId, next.pwHash, next.apiKey, new Date().toISOString()]]);
}

function hubAuthDelete_(ss, courseId) {
  var sh = ss.getSheetByName(HUB_AUTH_SHEET);
  if (!sh || sh.getLastRow() < 2) return;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === courseId) sh.deleteRow(i + 2);
  }
}

/* ══════════ 對應（每個請求揾到唯一一班）══════════ */

/* 優先用 apiKey（hash 比對）；可另帶 courseId／publicCourseId 覆核／定位。
 * 回 { ok, row }；失敗回 { ok:false, error }（Unauthorized 字眼同舊制一致，
 * 前端 apiNormalizeError 靠佢出提示）。 */
function hubRequireCourse_(b) {
  b = b || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var meta = hubMeta_(ss);
  if (!meta['模版檔案ID'] && !hubRegistryRows_(ss).length) {
    return { ok: false, error: '訓練班系統 GS 未 run setup()——請先喺 Apps Script 編輯器手動執行一次' };
  }
  var key = String(b.apiKey || '').trim();
  var rows = hubRegistryRows_(ss);
  var row = null;

  if (key) {
    var kh = hubSha256_(key);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].keyHash === kh) { row = rows[i]; break; }
    }
    if (!row) return { ok: false, error: 'Unauthorized: invalid or missing apiKey' };
  }

  var wanted = String(b.publicCourseId || b.courseId || '').trim();
  if (wanted) {
    var byId = null;
    for (var j = 0; j < rows.length; j++) {
      if (rows[j].publicCourseId === wanted || rows[j].courseId === wanted || rows[j].fileId === wanted) { byId = rows[j]; break; }
    }
    if (!byId) return { ok: false, error: '找不到該訓練班（' + wanted + '）' };
    if (row && row.courseId !== byId.courseId) {
      return { ok: false, error: 'API Key 同課程 ID 唔對應——請確認用返該班嘅連線資料' };
    }
    row = byId;
    if (!key) return { ok: false, error: 'Unauthorized: invalid or missing apiKey' };
  }

  if (!row) return { ok: false, error: 'Unauthorized: invalid or missing apiKey' };
  if (row.exec) {
    return { ok: false, error: '呢個班用緊獨立部署（舊制）——請用該班自己嘅 /exec 連線' };
  }
  return { ok: true, row: row };
}

/* keyed lock（CacheService token spin；best-effort）——
 * 真正防覆蓋靠每班 _Sync rev 樂觀鎖；呢度只係減少同班寫入撞車。 */
function hubLock_(courseId, timeoutMs) {
  var k = 'hublock_' + courseId;
  var token = Date.now() + '_' + Math.random();
  var deadline = Date.now() + (timeoutMs || 20000);
  var c = CacheService.getScriptCache();
  while (Date.now() < deadline) {
    if (!c.get(k)) {
      c.put(k, token, 30);
      if (c.get(k) === token) return token;
    }
    Utilities.sleep(100);
  }
  return ''; /* 攞唔到都照行（正確性由 rev 保證） */
}
function hubUnlock_(courseId, token) {
  if (!token) return;
  var c = CacheService.getScriptCache();
  try { if (c.get('hublock_' + courseId) === token) c.remove('hublock_' + courseId); } catch (e) { /* 過期 */ }
}

/* ══════════ Course action 分發（coursev5 合約；CourseSheet.gs 實作）══════════ */

function hubDispatchCourse_(action, row, b) {
  var ss = SpreadsheetApp.openById(row.fileId);
  var lock = null;
  var WRITE = {
    saveCourseBatch: 1, setCourseCells: 1, addReg: 1, setRegStatus: 1,
    addExpenseRow: 1, setCompletionRow: 1, setCertRow: 1,
    setPaymentCheck: 1, setCourseRefund: 1, sendRegNotice: 1,
    submitBudgetVersion: 1, approveBudgetVersion: 1, setPassword: 1
  };
  if (WRITE[action]) lock = hubLock_(row.courseId);
  try {
    switch (action) {
      case 'getCourseSheetRaw':     return hcsGetRaw_(ss);
      case 'getCourseProfile':      return hcsGetProfile_(ss);
      case 'getCourseSummary':      return hcsGetSummary_(ss);
      case 'saveCourseBatch':       return hcsSaveBatch_(ss, b);
      case 'setCourseCells':        return hcsSaveBatch_(ss, b);
      case 'addReg':                return hcsAddReg_(ss, row, b);
      case 'listRegs':              return hcsListRegs_(ss);
      case 'setRegStatus':          return hcsSetRegStatus_(ss, b);
      case 'addExpenseRow':         return hcsAddExpenseRow_(ss, b);
      case 'setCompletionRow':      return hcsSetCompletionRow_(ss, b);
      case 'setCertRow':            return hcsSetCertRow_(ss, b);
      case 'setPaymentCheck':       return hcsSetPaymentCheck_(ss, b);
      case 'setCourseRefund':       return hcsSetCourseRefund_(ss, b);
      case 'sendRegNotice':         return hcsSendRegNotice_(ss, b);
      case 'submitBudgetVersion':   return hcsSubmitBudget_(ss, b);
      case 'listBudgetVersions':    return hcsListBudgets_(ss, b);
      case 'approveBudgetVersion':  return hcsApproveBudget_(ss, b);
      case 'auth':                  return hcsAuth_(row, b);
      case 'setPassword':           return hcsSetPassword_(row, b);
      default: return { ok: false, error: '未知的 action: ' + action };
    }
  } finally {
    if (lock) hubUnlock_(row.courseId, lock);
  }
}

/* ══════════ Hub action：createCourse（CL 新開班；零技術欄位）══════════ */

function hubCreateCourse_(b) {
  b = b || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = hubConfig_(ss);
  var meta = hubMeta_(ss);
  if (cfg.keyHash && hubSha256_(b.masterKey || '') !== cfg.keyHash) {
    return { ok: false, error: '開班授權碼不正確——請同區管理層確認' };
  }
  var nm = String(b.courseName || '').trim();
  if (!nm) return { ok: false, error: '請填課程名稱' };
  var tplId = String(cfg.templateMode || 'auto') === 'manual' && cfg.templateId ? cfg.templateId : meta['模版檔案ID'];
  if (!tplId || !meta['資料夾ID']) {
    return { ok: false, error: '未完成 setup()（欠缺模版／資料夾）——請喺 Apps Script 編輯器手動 run 一次 setup' };
  }

  /* 1. copy 模版（makeCopy 零漂移） */
  var folder = DriveApp.getFolderById(meta['資料夾ID']);
  var file = DriveApp.getFileById(tplId).makeCopy(nm + '（開班文件）', folder);
  if (cfg.opsEmail) { try { file.addEditor(cfg.opsEmail); } catch (e) { /* 唔阻開班 */ } }
  var cs = SpreadsheetApp.openById(file.getId());

  /* 2. 產生三件套：內部課程ID／公開課程ID／API Key */
  var courseId = hubId_('crs_');
  var publicCourseId = hubId_('crs_');
  var apiKey = 'ck_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  var directRegUrl = cfg.memberPortalUrl
    ? cfg.memberPortalUrl + (cfg.memberPortalUrl.indexOf('?') >= 0 ? '&' : '?') + 'courseId=' + encodeURIComponent(publicCourseId)
    : '';

  /* 3. 預填 CL 喺 APP 填嘅基本資料（座標同舊 CourseFactory 完全一致） */
  var in1 = cs.getSheetByName('Input01 訓練班預算');
  if (in1) {
    in1.getRange('B1').setValue(nm);
    if (b.edition) in1.getRange('B4').setValue(Number(b.edition) || b.edition);
    if (b.section) in1.getRange('B5').setValue(b.section);
    if (b.badge) in1.getRange('B6').setValue(b.badge);
    in1.getRange('B8').setValue('訓練班');
    if (b.intake) in1.getRange('B11').setValue(Number(b.intake) || 0);
    if (b.fee) in1.getRange('B12').setValue(Number(b.fee) || 0);
  }
  var in2 = cs.getSheetByName('Input02 訓練班資料');
  if (in2) {
    in2.getRange('B1').setValue(nm);
    if (b.intake) in2.getRange('B4').setValue(Number(b.intake) || 0);
    if (b.fee) in2.getRange('B5').setValue(Number(b.fee) || 0);
    if (b.clName) {
      in2.getRange('A23').setValue('班領導人');
      in2.getRange('B23').setValue(b.clName);
      if (b.clTitle) in2.getRange('C23').setValue(b.clTitle);
    }
    /* 可選：節次（新開班即時填；唔填就入班後喺「開班文件」頁填） */
    if (Array.isArray(b.sessions)) {
      for (var i = 0; i < Math.min(b.sessions.length, 8); i++) {
        var s = b.sessions[i] || {};
        var r = 9 + i;
        if (s.date) in2.getRange(r, 2).setValue(s.date);
        if (s.time) in2.getRange(r, 4).setValue(s.time);
        if (s.venue) in2.getRange(r, 5).setValue(s.venue);
        if (s.onNotice) in2.getRange(r, 8).setValue(true);
      }
    }
  }

  /* 4. 參數分頁（區會批准格＋公開課程ID＋區會常數） */
  var param = cs.getSheetByName('參數') || cs.insertSheet('參數');
  var seeds = [
    ['成員系統報名網址', cfg.memberPortalUrl || ''],
    ['公開課程ID', publicCourseId],
    ['成員系統直接報名連結', directRegUrl],
    ['FPS 識別碼', cfg.fpsId || ''],
    ['FPS 戶口名稱', cfg.fpsName || ''],
    ['區會網址', cfg.districtWeb || ''],
    ['區會批准', ''],
    ['訓練班電郵', '']
  ];
  seeds.forEach(function (p) { hubSetParamCell_(param, p[0], p[1]); });

  /* 5. 登記＋_Auth（明文 key 只存隱藏保護分頁；登記表存 hash） */
  hubAppendRegistry_(ss, {
    courseId: courseId, publicCourseId: publicCourseId, name: nm,
    keyHash: hubSha256_(apiKey), fileId: file.getId(), url: file.getUrl(),
    exec: '', status: 'active', cl: String(b.clName || ''),
    createdAt: new Date().toISOString()
  });
  hubAuthSave_(ss, courseId, { apiKey: apiKey });

  /* 6. 回傳：前端即刻連線（首次密碼 1234） */
  return {
    ok: true,
    data: {
      exec: hubExecUrl_(), apiKey: apiKey,
      courseId: courseId, publicCourseId: publicCourseId,
      directRegUrl: directRegUrl, courseName: nm,
      url: file.getUrl(), firstLogin: true
    }
  };
}

function hubSetParamCell_(param, label, value) {
  var last = Math.max(1, param.getLastRow());
  var found = param.createTextFinder(label).matchEntireCell(true).findNext();
  if (found) {
    if (value !== undefined && String(value) !== '') param.getRange(found.getRow(), 2).setValue(value);
    return found.getRow();
  }
  param.getRange(last + 1, 1, 1, 2).setValues([[label, value == null ? '' : value]]);
  return last + 1;
}

/* ══════════ Hub action：listCourses／connectCourseByPassword ══════════ */

function hubListCourses_(b) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = hubConfig_(ss);
  var canSeeSecrets = !!(cfg.keyHash && hubSha256_((b && b.masterKey) || '') === cfg.keyHash);
  var auths = canSeeSecrets ? hubAuthRows_(ss) : {};
  var rows = hubRegistryRows_(ss);
  return {
    ok: true,
    data: {
      courses: rows.map(function (r) {
        return {
          apiKey: canSeeSecrets ? (auths[r.courseId] || {}).apiKey || '' : '',
          key: canSeeSecrets ? (auths[r.courseId] || {}).apiKey || '' : '',
          courseId: r.courseId,
          publicCourseId: r.publicCourseId,
          name: r.name, courseName: r.name,
          url: canSeeSecrets ? r.url : '',
          gsUrl: canSeeSecrets ? r.url : '',
          exec: r.exec || (canSeeSecrets ? hubExecUrl_() : ''),
          scriptExecUrl: r.exec || (canSeeSecrets ? hubExecUrl_() : ''),
          directRegUrl: '', /* 由成員系統報名網址＋公開課程ID 組成；避免冇設定時回空 */
          status: r.status, cl: r.cl, createdAt: r.createdAt
        };
      })
    }
  };
}

/* 職員選班：揀班名→輸入本班密碼→系統自動取回連線資料（唔使記 key／URL）。
 * 新班＝hub 內部驗證 _Auth；舊班行（有自己 /exec）＝proxy 去該班 /exec。 */
function hubConnectByPassword_(b) {
  b = b || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rows = hubRegistryRows_(ss);
  var wanted = String(b.publicCourseId || b.courseId || b.id || '').trim();
  var password = String(b.password || '');
  if (!wanted) return { ok: false, error: 'missing courseId' };
  if (!password) return { ok: false, error: '請輸入本班密碼' };

  var row = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].publicCourseId === wanted || rows[i].courseId === wanted || rows[i].fileId === wanted) { row = rows[i]; break; }
  }
  if (!row) return { ok: false, error: '找不到該訓練班' };

  /* 舊班（獨立部署）：照舊 proxy */
  if (row.exec) {
    var auth = hubAuthRows_(ss)[row.courseId] || {};
    if (!auth.apiKey) return { ok: false, error: '該舊班未登記 API Key——請用 importCourse 補返' };
    var resp = UrlFetchApp.fetch(row.exec, {
      method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
      payload: JSON.stringify({ action: 'auth', apiKey: auth.apiKey, password: password })
    });
    var data = {};
    try { data = JSON.parse(resp.getContentText() || '{}'); } catch (e) { data = {}; }
    if (!data.ok) return { ok: false, error: (data && data.error) || '密碼不正確／該班後端未支援密碼驗證' };
    return { ok: true, data: hubConnData_(ss, row, auth.apiKey, data.data && data.data.firstLogin) };
  }

  /* 新班：hub 內部驗證（_Auth；錯 5 次鎖 10 分鐘，按班） */
  var v = hubCheckClassPassword_(ss, row.courseId, password);
  if (!v.ok) return { ok: false, error: v.error };
  var auth2 = hubAuthRows_(ss)[row.courseId] || {};
  return { ok: true, data: hubConnData_(ss, row, auth2.apiKey, v.firstLogin) };
}

function hubConnData_(ss, row, apiKey, firstLogin) {
  var exec = row.exec || hubExecUrl_();
  var cfg = hubConfig_(ss);
  var directRegUrl = cfg.memberPortalUrl && row.publicCourseId
    ? cfg.memberPortalUrl + (cfg.memberPortalUrl.indexOf('?') >= 0 ? '&' : '?') + 'courseId=' + encodeURIComponent(row.publicCourseId)
    : '';
  return {
    apiKey: apiKey, key: apiKey,
    courseId: row.courseId, publicCourseId: row.publicCourseId,
    name: row.name, courseName: row.name,
    exec: exec, scriptExecUrl: exec,
    url: row.url, gsUrl: row.url,
    directRegUrl: directRegUrl, status: row.status,
    firstLogin: !!firstLogin
  };
}

/* 班密碼驗證（共用後端版）：_Auth 冇行／冇 hash＝預設 1234＋firstLogin。
 * 「帳號:密碼」＝後備管理員（hub 全域）。 */
function hubCheckClassPassword_(ss, courseId, password) {
  var c = CacheService.getScriptCache();
  if (Date.now() < Number(c.get('hubpwl_' + courseId) || 0)) {
    return { ok: false, error: '嘗試次數太多，請 ' + HUB_PW_LOCK_MINUTES + ' 分鐘後再試' };
  }
  var pw = String(password == null ? '' : password);
  if (pw.indexOf(':') >= 0) {
    var i = pw.indexOf(':');
    if (pw.slice(0, i) === HUB_ADMIN_USER && pw.slice(i + 1) === HUB_ADMIN_PW) {
      c.remove('hubpwf_' + courseId);
      return { ok: true, role: 'admin', firstLogin: false };
    }
    return hubPwFail_(c, courseId);
  }
  var auth = hubAuthRows_(ss)[courseId] || {};
  var target = auth.pwHash || hubSha256_(HUB_DEFAULT_PW);
  if (hubSha256_(pw) === target) {
    c.remove('hubpwf_' + courseId);
    return { ok: true, role: 'staff', firstLogin: !auth.pwHash };
  }
  return hubPwFail_(c, courseId);
}

function hubPwFail_(c, courseId) {
  var n = Number(c.get('hubpwf_' + courseId) || 0) + 1;
  if (n >= HUB_PW_MAX_FAIL) {
    c.put('hubpwl_' + courseId, String(Date.now() + HUB_PW_LOCK_MINUTES * 60 * 1000), 21600);
    c.remove('hubpwf_' + courseId);
    return { ok: false, error: '密碼錯誤。試得太多，已鎖 ' + HUB_PW_LOCK_MINUTES + ' 分鐘' };
  }
  c.put('hubpwf_' + courseId, String(n), 21600);
  return { ok: false, error: '密碼錯誤' };
}

/* ══════════ Hub action：管理／遷移 ══════════ */

function hubAdminOk_(b) {
  return String((b && (b.adminUser || b.user)) || '') === HUB_ADMIN_USER &&
    String((b && (b.adminPassword || b.password)) || '') === HUB_ADMIN_PW;
}

/* 隱藏後台：列出所有已開班（同舊 CourseFactory 回傳結構一致） */
function hubAdminList_(b) {
  if (!hubAdminOk_(b)) return { ok: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var auths = hubAuthRows_(ss);
  var rows = hubRegistryRows_(ss);
  return {
    ok: true,
    data: {
      courses: rows.map(function (r) {
        var key = (auths[r.courseId] || {}).apiKey || '';
        return {
          apiKey: key, key: key,
          courseId: r.courseId, publicCourseId: r.publicCourseId,
          name: r.name, courseName: r.name,
          exec: r.exec || hubExecUrl_(), scriptExecUrl: r.exec || hubExecUrl_(),
          url: r.url, gsUrl: r.url, directRegUrl: '',
          status: r.status, cl: r.cl, createdAt: r.createdAt
        };
      })
    }
  };
}

/* 隱藏後台：刪登記（可同時將 GS 移到 Drive 垃圾桶） */
function hubAdminDelete_(b) {
  if (!hubAdminOk_(b)) return { ok: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rows = hubRegistryRows_(ss);
  var wanted = String((b && (b.apiKey || b.key || b.publicCourseId || b.courseId || b.id)) || '').trim();
  var row = null;
  var kh = wanted ? hubSha256_(wanted) : '';
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].courseId === wanted || rows[i].publicCourseId === wanted ||
      rows[i].fileId === wanted || rows[i].keyHash === kh) { row = rows[i]; break; }
  }
  if (!row) return { ok: false, error: '找不到該訓練班' };
  var trashed = false, trashError = '';
  if (b.trashFile !== false && row.fileId) {
    try { DriveApp.getFileById(row.fileId).setTrashed(true); trashed = true; }
    catch (e) { trashError = String(e && e.message ? e.message : e); }
  }
  hubDeleteRegistryRow_(ss, row.courseId);
  hubAuthDelete_(ss, row.courseId);
  return { ok: true, data: { deleted: true, apiKey: '', name: row.name, trashed: trashed, trashError: trashError } };
}

/* 舊制班登記入原點（遷移）：已有自己 GS／（可選）自己 /exec 嘅班，
 * 登記之後「從登記表選班」就揀到；舊班行會保留該班自己嘅 /exec。 */
function hubImportCourse_(b) {
  if (!hubAdminOk_(b)) return { ok: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fileId = String((b && (b.fileId || b.courseId)) || '').trim();
  var apiKey = String((b && b.apiKey) || '').trim();
  if (!fileId) return { ok: false, error: 'missing fileId' };
  var rows = hubRegistryRows_(ss);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].fileId === fileId) return { ok: false, error: '該班已登記' };
  }
  var name = '', url = '';
  try {
    var f = DriveApp.getFileById(fileId);
    name = String(b.name || f.getName() || '').trim();
    url = f.getUrl();
  } catch (e) {
    name = String(b.name || '').trim();
  }
  var publicCourseId = String(b.publicCourseId || '').trim() || hubId_('crs_');
  var courseId = hubId_('crs_');
  hubAppendRegistry_(ss, {
    courseId: courseId, publicCourseId: publicCourseId, name: name || '（未命名舊班）',
    keyHash: apiKey ? hubSha256_(apiKey) : '',
    fileId: fileId, url: url, exec: String((b && b.scriptExecUrl) || (b && b.exec) || '').trim(),
    status: 'active', cl: String((b && b.cl) || ''), createdAt: new Date().toISOString()
  });
  if (apiKey) hubAuthSave_(ss, courseId, { apiKey: apiKey });
  return { ok: true, data: { imported: true, courseId: courseId, publicCourseId: publicCourseId, name: name } };
}

/* 區管理系統補寫班 GS 參數 label（同舊 CourseFactory.setParamLabel 合約） */
function hubSetParamLabel_(b) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = hubConfig_(ss);
  if (cfg.keyHash && hubSha256_((b && b.masterKey) || '') !== cfg.keyHash) {
    return { ok: false, error: '管理碼不正確' };
  }
  var fileId = String((b && (b.fileId || b.courseId)) || '').trim();
  var label = String((b && b.label) || '').trim();
  if (!fileId || !label) return { ok: false, error: 'missing fileId/label' };
  var cs = SpreadsheetApp.openById(fileId);
  var param = cs.getSheetByName('參數') || cs.insertSheet('參數');
  var row = hubSetParamCell_(param, label, b.value == null ? '' : String(b.value));
  return { ok: true, data: { saved: true, row: row, label: label } };
}

/* ════════════════════ 〔四〕CourseSheet：每班讀寫合約 ════════════════════ */

/*************************************************************
 * CourseHub · CourseSheet（course actions；全部以 `ss` 參數運作）
 *
 * 呢個檔案係 coursev5 合約嘅「共用後端版」實作——同舊制每班
 * bound script（Code.gs.course.js＋Auth/PaymentCheck/Summary/…）
 * 嘅**回應格式完全一致**（見 docs/API.md；mock js/15-mock.js 同合約）。
 * 分別只係：工作簿唔係 getActiveSpreadsheet()，而係
 * CourseHub hubRequireCourse_ 對應出嚟嘅 `SpreadsheetApp.openById(fileId)`。
 *
 * rev 語義（防呆核心）：
 *   - _Sync 隱藏分頁：A1 rev／B1 savedAt／C1 by
 *   - saveCourseBatch／setCompletionRow／setCertRow → 驗 baseRev＋bump rev
 *   - setRegStatus／addReg／addExpenseRow／setPaymentCheck／setCourseRefund
 *     → 唔驗唔 bump（append／identity 性質）
 *************************************************************/

/* 可寫分頁（同前端 MOCK_WRITABLE_TABS／舊 Code.gs 一致） */
var HCS_WRITABLE_TABS = [
  'Input01 訓練班預算', 'Input02 訓練班資料', 'Input03 時間表', 'Input04_Print支出表',
  '表格回應', '參數',
  'Print_通告', 'Print_接納通知書', 'Print_財政預算', 'Print_訓練班完成報告',
  'Print_領取證書紀錄', 'Print_總會資助計劃',
  'Print_取錄名單', 'Print_合格名單', 'Print_學員名單', 'Print_學員出席紀錄',
  'Print_收支紀錄', 'Print_班職員名單'
];

/* ══════════ 工具 ══════════ */

function hcsSyncSheet_(ss) {
  var sh = ss.getSheetByName('_Sync');
  if (!sh) { sh = ss.insertSheet('_Sync'); sh.hideSheet(); }
  if (String(sh.getRange(1, 1).getValue() || '').trim() === '') sh.getRange(1, 1).setValue(0);
  return sh;
}
function hcsSyncState_(ss) {
  var sh = hcsSyncSheet_(ss);
  var savedAt = sh.getRange(1, 2).getValue();
  return {
    rev: Number(sh.getRange(1, 1).getValue()) || 0,
    savedAt: savedAt instanceof Date ? savedAt.toISOString() : String(savedAt || ''),
    by: String(sh.getRange(1, 3).getValue() || '')
  };
}
function hcsBumpRev_(ss, by) {
  var sh = hcsSyncSheet_(ss);
  var rev = (Number(sh.getRange(1, 1).getValue()) || 0) + 1;
  var at = new Date().toISOString();
  sh.getRange(1, 1).setValue(rev);
  sh.getRange(1, 2).setValue(at);
  sh.getRange(1, 3).setValue(String(by || ''));
  return { rev: rev, savedAt: at };
}
function hcsCheckBaseRev_(ss, baseRev) {
  if (baseRev === undefined || baseRev === null || baseRev === '') return null;
  var st = hcsSyncState_(ss);
  if (Number(baseRev) !== Number(st.rev)) {
    return {
      ok: false, conflict: true,
      rev: st.rev, savedAt: st.savedAt, by: st.by,
      error: '有人快咗一步改過（' + (st.by || '另一職員') + (st.savedAt ? '，' + st.savedAt : '') +
        '），請重讀最新再儲存（你今次乜都冇寫入）'
    };
  }
  return null;
}

/* 分頁二維陣列（getValues＝計算值；日期→JSON 變 ISO，前端 normDate 轉港時區） */
function hcsDumpSheet_(ss, name, minRows, minCols) {
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var rows = Math.max(sh.getLastRow(), minRows || 1);
  var cols = Math.max(sh.getLastColumn(), minCols || 1);
  return sh.getRange(1, 1, rows, cols).getValues();
}

/* 表格回應表頭 → 欄號（唔靠硬編碼欄位，舊表新表都啱用） */
function hcsRespMap_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 53);
  var heads = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var m = {};
  heads.forEach(function (h, i) {
    var k = String(h || '').trim();
    if (k && m[k] === undefined) m[k] = i + 1;
  });
  return m;
}

/* ══════════ getCourseSheetRaw／getCourseProfile ══════════ */

function hcsGetRaw_(ss) {
  var st = hcsSyncState_(ss);
  return {
    ok: true,
    data: {
      input01: hcsDumpSheet_(ss, 'Input01 訓練班預算', 105, 13),
      input02: hcsDumpSheet_(ss, 'Input02 訓練班資料', 46, 11),
      input03: hcsDumpSheet_(ss, 'Input03 時間表', 1, 8),
      input04: hcsDumpSheet_(ss, 'Input04_Print支出表', 42, 11),
      resp: hcsDumpSheet_(ss, '表格回應', 1, 44),
      paramsWX: hcsDumpSheet_(ss, '參數', 1, 2),
      notice: hcsDumpSheet_(ss, 'Print_通告', 1, 1),
      attend: hcsDumpSheet_(ss, 'Print_學員出席紀錄', 1, 1),
      accept: [], finance: [],
      completion: hcsDumpSheet_(ss, 'Print_訓練班完成報告', 1, 1),
      cert: hcsDumpSheet_(ss, 'Print_領取證書紀錄', 1, 1),
      subsidy: [],
      pulledAt: new Date().toISOString(),
      rev: st.rev, revSavedAt: st.savedAt, revBy: st.by
    }
  };
}

function hcsGetProfile_(ss) {
  var in2 = ss.getSheetByName('Input02 訓練班資料');
  if (!in2) return { ok: false, error: '找不到 Input02 分頁' };
  var vals = in2.getRange(1, 1, Math.max(in2.getLastRow(), 46), 7).getValues();
  var staff = [];
  for (var r = 23; r <= 42; r++) {
    var row = vals[r - 1] || [];
    var role = String(row[0] || '').trim();
    var name = String(row[1] || '').trim();
    if (role && name) staff.push({ role: role, name: name });
  }
  var leader = null;
  for (var i = 0; i < staff.length; i++) {
    if (staff[i].role === '班領導人') { leader = staff[i]; break; }
  }
  return {
    ok: true,
    data: {
      courseName: String(vals[0][1] || '').trim() || '（未命名訓練班）',
      quota: vals[3][1], fee: vals[4][1],
      staff: staff, leader: leader,
      pulledAt: new Date().toISOString()
    }
  };
}

/* ══════════ saveCourseBatch／setCourseCells（rev 樂觀鎖）══════════ */

function hcsSaveBatch_(ss, b) {
  b = b || {};
  var cells = b.cells || [];
  if (!cells.length) return { ok: false, error: '冇嘢要存（cells 至少帶一樣）' };
  if (cells.length > 1000) return { ok: false, error: '一次最多寫 1000 格' };
  for (var i = 0; i < cells.length; i++) {
    var c = cells[i] || {};
    var r = Number(c.row), col = Number(c.col);
    if (!r || !col || r < 1 || col < 1 || r > 500 || col > 60) {
      return { ok: false, error: '格座標不正確（第 ' + (i + 1) + ' 格）' };
    }
  }
  var stale = hcsCheckBaseRev_(ss, b.baseRev);
  if (stale) return stale;

  var updated = 0, skipped = [];
  cells.forEach(function (c) {
    var tab = String((c || {}).tab || '');
    if (HCS_WRITABLE_TABS.indexOf(tab) < 0) {
      if (tab && skipped.indexOf(tab) < 0) skipped.push(tab);
      return;
    }
    var sh = ss.getSheetByName(tab);
    if (!sh) { if (skipped.indexOf(tab) < 0) skipped.push(tab); return; }
    sh.getRange(Number(c.row), Number(c.col)).setValue(c.value === undefined ? '' : c.value);
    updated++;
  });
  var bump = hcsBumpRev_(ss, b.by);
  return { ok: true, data: { saved: true, updated: updated, skippedTabs: skipped, rev: bump.rev, savedAt: bump.savedAt } };
}

/* ══════════ 收生（成員系統寫入）══════════ */

function hcsAddReg_(ss, row, b) {
  b = b || {};
  if (!b.nameZh || !b.phone || !b.email) return { ok: false, error: '資料不完整' };
  if (!b.receiptDataUrl) return { ok: false, error: '請上傳入數紙截圖。未繳費將不獲處理申請' };
  var sh = ss.getSheetByName('表格回應');
  if (!sh) return { ok: false, error: '找不到「表格回應」分頁' };
  var hmap = hcsRespMap_(sh);
  var cEmail = hmap['電郵地址'] || 2, cStatus = hmap['審批狀態'] || 37;

  /* 防重複（同電郵、未取消） */
  var last = sh.getLastRow();
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, Math.max(hmap['_ref'] || 44, cStatus, cEmail)).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][cEmail - 1] || '').toLowerCase() === String(b.email).toLowerCase() &&
        String(vals[i][cStatus - 1] || '') !== 'cancelled') {
        return { ok: false, error: '此電郵已報名，請勿重複提交。' };
      }
    }
  }

  var ref = 'CRS-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 9000 + 1000);

  /* 入數紙：data: URL 就存入 Drive（best effort）；否則原樣記低 */
  var receipt = String(b.receiptDataUrl || '');
  if (receipt.indexOf('data:') === 0) {
    try {
      var m = receipt.match(/^data:([^;,]+);base64,(.+)$/);
      if (m) {
        var hubMeta = hubMeta_(SpreadsheetApp.getActiveSpreadsheet());
        var parent = hubMeta['資料夾ID'] ? DriveApp.getFolderById(hubMeta['資料夾ID']) : DriveApp.getRootFolder();
        var fname = row.name + '_付款證明';
        var it = parent.getFoldersByName(fname);
        var folder = it.hasNext() ? it.next() : parent.createFolder(fname);
        var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], ref + '.png');
        receipt = folder.createFile(blob).getUrl();
      }
    } catch (e) { /* 上載失敗保留 raw，唔阻報名 */ }
  }

  var width = Math.max(sh.getLastColumn(), 53);
  var out = new Array(width).fill('');
  function put(h, v) { var c = hmap[h]; if (c) out[c - 1] = v; }
  put('時間戳記', new Date().toISOString());
  put('電郵地址', b.email);
  put('中文姓名', b.nameZh);
  put('英文姓名', b.nameEn || '');
  put('聯絡電話', b.phone);
  put('性別', b.gender || '');
  put('出生日期', b.dob || '');
  put('所屬童軍區', b.scoutDistrict || '筲箕灣');
  put('旅團', b.troop || '');
  put('付款方式', b.payMethod || 'FPS');
  put('審批狀態', 'pending');
  put('已繳付訓練班費用截圖', receipt);
  put('_ref', ref);
  put('_courseId', row.publicCourseId || '');
  put('_courseTitle', row.name || '');
  sh.appendRow(out);
  return { ok: true, refCode: ref };
}

function hcsListRegs_(ss) {
  var sh = ss.getSheetByName('表格回應');
  if (!sh) return { ok: false, error: '找不到「表格回應」分頁' };
  var vals = hcsDumpSheet_(ss, '表格回應', 1, 44);
  var heads = (vals[0] || []).map(function (x) { return String(x || '').trim(); });
  var hmap = {};
  heads.forEach(function (h, i) { if (h && hmap[h] === undefined) hmap[h] = i; });
  var g = function (r, h) { return hmap[h] === undefined ? '' : r[hmap[h]]; };
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (String(g(r, '時間戳記') || '').trim() === '') continue;
    out.push({
      id: String(g(r, '時間戳記') || ''),
      refCode: g(r, '_ref') || '',
      nameZh: g(r, '中文姓名'), nameEn: g(r, '英文姓名'),
      phone: g(r, '聯絡電話'), email: g(r, '電郵地址'),
      troop: g(r, '旅團'),
      receiptUrl: g(r, '已繳付訓練班費用截圖'),
      status: String(g(r, '審批狀態') || 'pending').toLowerCase(),
      reviewer: g(r, '批核人') || '', reviewedAt: g(r, '批核時間') || ''
    });
  }
  return { ok: true, data: out.reverse() };
}

/* setRegStatus：identity（時間戳記）對行；唔驗唔 bump rev */
function hcsSetRegStatus_(ss, b) {
  var status = String((b && b.status) || '').toLowerCase();
  if (['pending', 'approved', 'rejected', 'cancelled'].indexOf(status) < 0) {
    return { ok: false, error: '狀態不正確' };
  }
  var sh = ss.getSheetByName('表格回應');
  if (!sh) return { ok: false, error: '找不到「表格回應」分頁' };
  var hmap = hcsRespMap_(sh);
  var cId = hmap['時間戳記'] || 1;
  var id = String((b && b.id) != null ? b.id : '').trim();
  if (!id) return { ok: false, error: 'missing id' };
  var last = sh.getLastRow();
  if (last < 2) return { ok: false, error: '找不到該報名' };
  var ids = sh.getRange(2, cId, last - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() !== id) continue;
    var r = i + 2;
    sh.getRange(r, hmap['審批狀態'] || 37).setValue(status);
    if (hmap['批核人']) sh.getRange(r, hmap['批核人']).setValue(String((b && b.reviewer) || ''));
    if (hmap['批核時間']) sh.getRange(r, hmap['批核時間']).setValue(new Date().toISOString());
    if (hmap['接納']) {
      sh.getRange(r, hmap['接納']).setValue(status === 'approved' ? '✔' : ((status === 'rejected' || status === 'cancelled') ? '✗' : ''));
    }
    return { ok: true, data: { saved: true, id: id, status: status } };
  }
  return { ok: false, error: '找不到該報名' };
}

/* ══════════ 支出（append-only，唔撞 rev）══════════ */

function hcsAddExpenseRow_(ss, b) {
  b = b || {};
  var sh = ss.getSheetByName('Input04_Print支出表');
  if (!sh) return { ok: false, error: '找不到 Input04 分頁' };
  var cols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  var amounts = b.amounts || {};
  var has = cols.some(function (L) { return amounts[L] !== undefined && String(amounts[L]).trim() !== ''; }) ||
    (b.note !== undefined && String(b.note).trim() !== '');
  if (!has) return { ok: false, error: 'amounts／note 至少填一樣' };
  var vals = sh.getRange(8, 1, 35, 11).getValues();
  for (var i = 0; i < vals.length; i++) {
    var empty = true;
    for (var c = 1; c <= 9; c++) {
      if (String(vals[i][c] || '').trim() !== '') { empty = false; break; }
    }
    if (!empty) continue;
    var r = 8 + i;
    cols.forEach(function (L) {
      if (amounts[L] !== undefined && String(amounts[L]).trim() !== '') {
        sh.getRange(r, L.charCodeAt(0) - 64).setValue(amounts[L]);
      }
    });
    if (b.note !== undefined && String(b.note).trim() !== '') sh.getRange(r, 11).setValue(b.note);
    var st = hcsSyncState_(ss);
    return { ok: true, data: { added: true, row: r, receiptNo: String(sh.getRange(r, 1).getDisplayValue() || ''), rev: st.rev, savedAt: new Date().toISOString() } };
  }
  return { ok: false, error: '支出表已滿（35 行收據用晒）' };
}

/* ══════════ 完成／證書（用表格回應搵學員；驗可選 baseRev＋bump rev）══════════ */

function hcsFindReg_(ss, code, name) {
  var vals = hcsDumpSheet_(ss, '表格回應', 1, 44);
  var heads = (vals[0] || []).map(function (x) { return String(x || '').trim(); });
  var hmap = {};
  heads.forEach(function (h, i) { if (h && hmap[h] === undefined) hmap[h] = i; });
  var cNo = hmap['學員編號'], cName = hmap['中文姓名'], cTroop = hmap['旅號'];
  for (var i = 1; i < vals.length; i++) {
    var no = cNo === undefined ? '' : String(vals[i][cNo] == null ? '' : vals[i][cNo]);
    var nm = cName === undefined ? '' : String(vals[i][cName] || '');
    if ((code && no === String(code)) || (!code && name && nm === String(name))) {
      return { no: no, name: nm, troop: cTroop === undefined ? '' : String(vals[i][cTroop] || '') };
    }
  }
  return null;
}

function hcsSetCompletionRow_(ss, b) {
  b = b || {};
  var reg = hcsFindReg_(ss, b.code, b.name);
  if (!reg) return { ok: false, error: '找不到該學員' };
  var stale = hcsCheckBaseRev_(ss, b.baseRev);
  if (stale) return stale;
  var sh = ss.getSheetByName('Print_訓練班完成報告');
  if (!sh) return { ok: false, error: '找不到完成報告分頁' };
  var vals = sh.getRange(10, 1, 33, 6).getValues();
  var row = -1;
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '') === reg.no && String(vals[i][1] || '') === reg.name) { row = 10 + i; break; }
  }
  if (row < 0) {
    for (var j = 0; j < vals.length; j++) {
      if (!String(vals[j].join(''))) { row = 10 + j; break; }
    }
    if (row < 0) return { ok: false, error: '完成報告已滿' };
    sh.getRange(row, 1).setValue(reg.no);
    sh.getRange(row, 2).setValue(reg.name);
    sh.getRange(row, 3).setValue(reg.troop);
  }
  if (b.certNo !== undefined) sh.getRange(row, 4).setValue(b.certNo);
  if (b.pass !== undefined) sh.getRange(row, 5).setValue(b.pass ? '合格' : '不合格');
  if (b.failReason !== undefined) sh.getRange(row, 6).setValue(b.failReason);
  var bump = hcsBumpRev_(ss, b.by || '');
  return { ok: true, data: { updated: true, row: row, rev: bump.rev, savedAt: bump.savedAt } };
}

function hcsSetCertRow_(ss, b) {
  b = b || {};
  var reg = hcsFindReg_(ss, b.code, b.name);
  if (!reg) return { ok: false, error: '找不到該學員' };
  var stale = hcsCheckBaseRev_(ss, b.baseRev);
  if (stale) return stale;
  var sh = ss.getSheetByName('Print_領取證書紀錄');
  if (!sh) return { ok: false, error: '找不到領取證書紀錄分頁' };
  var vals = sh.getRange(7, 1, 36, 7).getValues();
  var row = -1;
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][1] || '') === reg.no && String(vals[i][2] || '') === reg.name) { row = 7 + i; break; }
  }
  if (row < 0) {
    for (var j = 0; j < vals.length; j++) {
      if (!String(vals[j].join(''))) { row = 7 + j; break; }
    }
    if (row < 0) return { ok: false, error: '領取證書紀錄已滿' };
    sh.getRange(row, 2).setValue(reg.no);
    sh.getRange(row, 3).setValue(reg.name);
    sh.getRange(row, 4).setValue(reg.troop);
  }
  if (b.certNo !== undefined) sh.getRange(row, 5).setValue(b.certNo);
  if (b.pickupDate !== undefined) sh.getRange(row, 6).setValue(b.pickupDate);
  if (b.signed !== undefined) sh.getRange(row, 7).setValue(b.signed);
  var bump = hcsBumpRev_(ss, b.by || '');
  return { ok: true, data: { updated: true, row: row, rev: bump.rev, savedAt: bump.savedAt } };
}

/* ══════════ 區管理系統財務（收款核對／退款；identity 定位、唔 bump rev）══════════ */

function hcsFindRespRow_(ss, id) {
  var sh = ss.getSheetByName('表格回應');
  if (!sh) return { sh: null };
  var hmap = hcsRespMap_(sh);
  var cId = hmap['時間戳記'] || 1;
  id = String(id != null ? id : '').trim();
  if (!id) return { sh: sh, hmap: hmap, error: 'missing id' };
  var last = sh.getLastRow();
  if (last < 2) return { sh: sh, hmap: hmap, error: '冇報名資料' };
  var ids = sh.getRange(2, cId, last - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) return { sh: sh, hmap: hmap, row: i + 2 };
  }
  return { sh: sh, hmap: hmap, error: '找不到該報名（時間戳記：' + id + '）' };
}

function hcsSetPaymentCheck_(ss, b) {
  var sh = ss.getSheetByName('表格回應');
  if (sh) {
    /* 自動補表頭（舊表免手動升級） */
    if (String(sh.getRange(1, 45).getDisplayValue() || '').trim() === '') {
      sh.getRange(1, 45, 1, 3).setValues([['已核對收款', '核對人', '核對時間']]);
    }
  }
  var f = hcsFindRespRow_(ss, b && b.id);
  if (!f.sh) return { ok: false, error: '找不到「表格回應」分頁' };
  if (f.error) return { ok: false, error: f.error };
  var verified = !(b && b.verified === false);
  f.sh.getRange(f.row, 45).setValue(verified ? '✔' : '');
  f.sh.getRange(f.row, 46).setValue(verified ? String((b && b.by) || '') : '');
  f.sh.getRange(f.row, 47).setValue(verified ? new Date() : '');
  return { ok: true, data: { saved: true, row: f.row, verified: verified } };
}

function hcsSetCourseRefund_(ss, b) {
  var sh = ss.getSheetByName('表格回應');
  if (sh) {
    if (String(sh.getRange(1, 50).getDisplayValue() || '').trim() === '') {
      sh.getRange(1, 50, 1, 2).setValues([['已退款', '退款核對人']]);
    }
  }
  var f = hcsFindRespRow_(ss, b && b.id);
  if (!f.sh) return { ok: false, error: '找不到「表格回應」分頁' };
  if (f.error) return { ok: false, error: f.error };
  var refunded = !(b && b.refunded === false);
  f.sh.getRange(f.row, 50).setValue(refunded ? '✔' : '');
  f.sh.getRange(f.row, 51).setValue(refunded ? String((b && b.by) || '') : '');
  return { ok: true, data: { saved: true, row: f.row, refunded: refunded } };
}

/* ══════════ auth／setPassword（共用後端版；密碼存原點 _Auth，按班）══════════ */

function hcsAuth_(row, b) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var v = hubCheckClassPassword_(ss, row.courseId, b && b.password);
  if (!v.ok) return { ok: false, error: v.error };
  return { ok: true, data: { role: v.role, firstLogin: !!v.firstLogin, v: HUB_VERSION } };
}

function hcsSetPassword_(row, b) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var c = CacheService.getScriptCache();
  if (Date.now() < Number(c.get('hubpwl_' + row.courseId) || 0)) {
    return { ok: false, error: '嘗試次數太多，請稍後再試' };
  }
  var oldPw = String((b && b.oldPassword) != null ? b.oldPassword : '');
  var newPw = String((b && b.newPassword) != null ? b.newPassword : '');
  var v = hubCheckClassPassword_(ss, row.courseId, oldPw);
  if (!v.ok) return { ok: false, error: v.error };
  if (newPw.length < HUB_PW_MIN_LEN) return { ok: false, error: '新密碼至少 ' + HUB_PW_MIN_LEN + ' 位' };
  if (newPw === HUB_DEFAULT_PW) return { ok: false, error: '新密碼唔可以係預設 1234' };
  if (newPw.indexOf(':') >= 0) return { ok: false, error: '新密碼唔可以有「:」' };
  hubAuthSave_(ss, row.courseId, { pwHash: hubSha256_(newPw) });
  c.remove('hubpwf_' + row.courseId);
  return { ok: true, data: { saved: true } };
}

/* ══════════ getCourseSummary（區管理系統批核用；純讀）══════════
 * 同 apps-script/Summary.gs 完全等效（座標跟 js/00-config.js） */

var HSM = {
  MEAL_ROWS: [32, 33, 34, 35, 36, 37, 38, 39], MEAL_PER: [5, 6, 7, 8, 9], MEAL_WHO: 10,
  RENT_ROWS: [47, 48, 49], RENT_QTY: 6, RENT_PRICE: 8,
  RENT_EXTRA_ROWS: [48, 49, 50], RENT_EXTRA_AMT: 8,
  CAMP_ROWS: [54, 55, 56, 62, 63, 64], CAMP_NIGHTS: 6, CAMP_PEOPLE: 7, CAMP_PRICE: 8,
  TRANS_ROWS: [69, 70, 71, 72, 73, 74], TRANS_BUDGET: 8,
  QP: [
    { key: 'handouts', label: '4. 講義及快勞', rows: [79, 80, 81], mapTo: ['H'] },
    { key: 'programme', label: '5. 節目', rows: [85, 86, 87], mapTo: ['I'] },
    { key: 'admin', label: '6. 行政', rows: [91, 92, 93], mapTo: ['G'] },
    { key: 'souvenir', label: '7. 紀念品', rows: [97, 98], mapTo: ['I'] }
  ],
  QP_QTY: 7, QP_PRICE: 8,
  MISC_ROWS: [102, 103, 104], MISC_AMT: 5,
  SESS_ROWS: [9, 10, 11, 12, 13, 14, 15, 16],
  STAFF_ROWS: [23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42]
};

function hsmNum_(g, r, c) {
  var v = g[r - 1] ? g[r - 1][c - 1] : '';
  if (v instanceof Date) return 0;
  var n = Number(String(v == null ? '' : v).replace(/[$,]/g, ''));
  return isFinite(n) ? n : 0;
}
function hsmTxt_(g, r, c) {
  var v = g[r - 1] ? g[r - 1][c - 1] : '';
  if (v instanceof Date) return hsmNormDate_(v);
  return String(v == null ? '' : v).trim();
}
function hsmNormDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Hong_Kong', 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  var m = s.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  return s;
}

function hcsGetSummary_(ss) {
  var in1 = ss.getSheetByName('Input01 訓練班預算');
  var in2 = ss.getSheetByName('Input02 訓練班資料');
  if (!in1 || !in2) return { ok: false, error: '找不到 Input01/Input02 分頁' };
  var g1 = in1.getRange(1, 1, Math.max(in1.getLastRow(), 120), 10).getValues();
  var g2 = in2.getRange(1, 1, Math.max(in2.getLastRow(), 50), 11).getValues();

  var sessions = [];
  HSM.SESS_ROWS.forEach(function (r) {
    var d = hsmNormDate_(g2[r - 1] ? g2[r - 1][1] : '');
    var t = String((g2[r - 1] || [])[3] || '').trim();
    if (!d && !t) return;
    sessions.push({
      date: d, time: t,
      venue: String((g2[r - 1] || [])[4] || '').trim(),
      onNotice: String((g2[r - 1] || [])[7] || '').trim() !== ''
    });
  });

  var staff = [], leader = null;
  HSM.STAFF_ROWS.forEach(function (r) {
    var row = g2[r - 1] || [];
    var role = String(row[0] || '').trim();
    var name = String(row[1] || '').trim();
    if (!role || !name) return;
    var s = { role: role, name: name, title: String(row[2] || '').trim() };
    staff.push(s);
    if (!leader && role === '班領導人') {
      leader = { name: name, title: s.title, phone: String(row[5] || '').trim(), email: String(row[6] || '').trim() };
    }
  });

  var intakeN = hsmNum_(g1, 11, 2), staffN = hsmNum_(g1, 13, 2);
  var sections = [], total = 0;
  function sec(key, label, mapTo, v) {
    sections.push({ key: key, label: label, mapTo: mapTo, budget: Math.round(v * 100) / 100 });
    total += v;
  }
  var v = 0;
  HSM.MEAL_ROWS.forEach(function (r) {
    var per = 0;
    HSM.MEAL_PER.forEach(function (c) { per += hsmNum_(g1, r, c); });
    if (!per) return;
    var who = String((g1[r - 1] || [])[HSM.MEAL_WHO - 1] || '');
    v += per * (who.indexOf('職員') >= 0 ? staffN : intakeN);
  });
  sec('meal', '1. 膳食', ['B', 'C', 'D'], v);

  v = 0;
  HSM.RENT_ROWS.forEach(function (r) {
    var q = hsmNum_(g1, r, HSM.RENT_QTY), p = hsmNum_(g1, r, HSM.RENT_PRICE);
    if (q && p) v += q * p;
  });
  HSM.RENT_EXTRA_ROWS.forEach(function (r) {
    if (!hsmNum_(g1, r, HSM.RENT_QTY)) v += hsmNum_(g1, r, HSM.RENT_EXTRA_AMT);
  });
  HSM.CAMP_ROWS.forEach(function (r) {
    var n2 = hsmNum_(g1, r, HSM.CAMP_NIGHTS), pp = hsmNum_(g1, r, HSM.CAMP_PEOPLE), pr = hsmNum_(g1, r, HSM.CAMP_PRICE);
    if (n2 && pp && pr) v += n2 * pp * pr;
  });
  sec('rent', '2. 租金（場租＋露營＋住宿）', ['E'], v);

  v = 0;
  HSM.TRANS_ROWS.forEach(function (r) { v += hsmNum_(g1, r, HSM.TRANS_BUDGET); });
  sec('transport', '3. 交通', ['F'], v);

  HSM.QP.forEach(function (q) {
    v = 0;
    q.rows.forEach(function (r) { v += hsmNum_(g1, r, HSM.QP_QTY) * hsmNum_(g1, r, HSM.QP_PRICE); });
    sec(q.key, q.label, q.mapTo, v);
  });

  v = 0;
  HSM.MISC_ROWS.forEach(function (r) { v += hsmNum_(g1, r, HSM.MISC_AMT); });
  sec('misc', '8. 其他', ['I'], v);

  var notice = { fileNo: '', issueDate: '', eligibility: '', feeNote: '', uniform: '' };
  var nsh = ss.getSheetByName('Print_通告');
  if (nsh) {
    notice.fileNo = String(nsh.getRange(12, 7).getValue() || '').trim();
    notice.issueDate = hsmNormDate_(nsh.getRange(13, 7).getValue());
    notice.eligibility = String(nsh.getRange(23, 3).getValue() || '').trim();
    notice.feeNote = String(nsh.getRange(24, 3).getValue() || '').trim();
    notice.uniform = String(nsh.getRange(31, 3).getValue() || '').trim();
  }

  var approved = false, courseEmail = '';
  var psh = ss.getSheetByName('參數');
  if (psh && psh.getLastRow() > 0) {
    psh.getRange(1, 1, psh.getLastRow(), 2).getValues().forEach(function (row) {
      var w = String(row[0] || '').trim(), x = String(row[1] || '').trim();
      if (w.indexOf('區會批准') >= 0) approved = (x === '✔' || x === '是' || x === 'TRUE');
      else if (w.indexOf('訓練班電郵') >= 0) courseEmail = x;
    });
  }

  var regCount = 0;
  var rsh = ss.getSheetByName('表格回應');
  if (rsh && rsh.getLastRow() > 1) {
    rsh.getRange(2, 1, rsh.getLastRow() - 1, 1).getValues().forEach(function (c2) {
      if (String(c2[0] || '').trim() !== '') regCount++;
    });
  }

  return {
    ok: true,
    data: {
      courseName: hsmTxt_(g1, 1, 2),
      edition: hsmTxt_(g1, 4, 2), section: hsmTxt_(g1, 5, 2),
      badge: hsmTxt_(g1, 6, 2), customName: hsmTxt_(g1, 7, 2),
      type1: hsmTxt_(g1, 8, 2), type2: hsmTxt_(g1, 9, 2),
      intake: hsmNum_(g1, 11, 2),
      fee: hsmNum_(g2, 5, 2) || hsmNum_(g1, 12, 2),
      quota: hsmNum_(g2, 4, 2),
      staffCount: staff.length,
      deadline: hsmNormDate_(hsmTxt_(g2, 18, 2)),
      publish: hsmNormDate_(hsmTxt_(g2, 19, 2)),
      sessions: sessions, leader: leader, staff: staff,
      budget: { sections: sections, total: Math.round(total * 100) / 100 },
      notice: notice, courseEmail: courseEmail, approved: approved, regCount: regCount,
      pulledAt: new Date().toISOString()
    }
  };
}

/* ══════════ Budget 版本（同 BudgetVersions.gs；存每班 _BudgetVersions 隱藏分頁）══════════ */

var HBV_HEAD = ['version', 'status', 'createdAt', 'submittedAt', 'submittedBy', 'approvedAt', 'approvedBy', 'reason', 'snapshot'];

function hbvSheet_(ss) {
  var sh = ss.getSheetByName('_BudgetVersions');
  if (!sh) { sh = ss.insertSheet('_BudgetVersions'); sh.hideSheet(); }
  if (sh.getLastRow() < 1 || String(sh.getRange(1, 1).getDisplayValue() || '').trim() !== HBV_HEAD[0]) {
    sh.getRange(1, 1, 1, HBV_HEAD.length).setValues([HBV_HEAD]);
  }
  return sh;
}
function hbvRows_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, HBV_HEAD.length).getValues();
  return vals.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    var snap = {};
    try { snap = JSON.parse(r[8] || '{}'); } catch (e) { snap = {}; }
    return {
      version: Number(r[0]), status: String(r[1] || ''),
      createdAt: r[2], submittedAt: r[3], submittedBy: r[4],
      approvedAt: r[5], approvedBy: r[6], reason: r[7], snapshot: snap
    };
  });
}

function hcsSubmitBudget_(ss, b) {
  var in1 = ss.getSheetByName('Input01 訓練班預算');
  if (!in1) return { ok: false, error: '找不到 Input01 預算分頁' };
  var sh = hbvSheet_(ss);
  var rows = hbvRows_(sh);
  var maxV = 0;
  rows.forEach(function (r) { maxV = Math.max(maxV, Number(r.version) || 0); });
  var v2 = maxV + 1;
  var values = in1.getRange(1, 1, 110, 10).getValues();
  var snap = { version: v2, reason: String((b && b.reason) || ''), capturedAt: new Date().toISOString(), range: 'A1:J110', values: values };
  sh.appendRow([v2, 'pending', new Date(), new Date(), String((b && b.by) || ''), '', '', String((b && b.reason) || ''), JSON.stringify(snap)]);
  return { ok: true, data: { version: v2, status: 'pending', snapshot: snap } };
}

function hcsListBudgets_(ss) {
  var sh = hbvSheet_(ss);
  var rows = hbvRows_(sh);
  var approved = rows.filter(function (r) { return r.status === 'approved'; });
  approved.sort(function (a, b) { return b.version - a.version; });
  return { ok: true, data: { versions: rows, currentApproved: approved[0] || null } };
}

function hcsApproveBudget_(ss, b) {
  var sh = hbvSheet_(ss);
  var version = Number(b && b.version);
  if (!version) return { ok: false, error: 'missing version' };
  var last = sh.getLastRow();
  if (last < 2) return { ok: false, error: '未有 Budget 版本' };
  var vals = sh.getRange(2, 1, last - 1, HBV_HEAD.length).getValues();
  var targetSnap = null, targetIdx = -1;
  for (var i = 0; i < vals.length; i++) {
    if (Number(vals[i][0]) === version) {
      targetIdx = i;
      try { targetSnap = JSON.parse(vals[i][8] || '{}'); } catch (e) { targetSnap = null; }
      break;
    }
  }
  if (targetIdx < 0 || !targetSnap || !targetSnap.values) return { ok: false, error: '找不到 Budget V' + version + ' snapshot' };

  var now = new Date();
  var by = String((b && b.by) || '');
  for (var j = 0; j < vals.length; j++) {
    var rowNo = j + 2;
    if (Number(vals[j][0]) === version) {
      sh.getRange(rowNo, 2).setValue('approved');
      sh.getRange(rowNo, 6).setValue(now);
      sh.getRange(rowNo, 7).setValue(by);
    } else if (String(vals[j][1]).trim() === 'approved') {
      sh.getRange(rowNo, 2).setValue('superseded');
    }
  }

  var in1 = ss.getSheetByName('Input01 訓練班預算');
  if (!in1) return { ok: false, error: '找不到 Input01 預算分頁' };
  var values = targetSnap.values;
  in1.getRange(1, 1, values.length, values[0].length).setValues(values);

  var psh = ss.getSheetByName('參數');
  if (psh) {
    hubSetParamCell_(psh, '目前批准Budget版本', 'V' + version);
    hubSetParamCell_(psh, 'Budget批准時間', now);
    hubSetParamCell_(psh, 'Budget批准人', by);
  }
  return { ok: true, data: { approved: true, version: version, appliedToInput01: true } };
}

/* ══════════ sendRegNotice（接納／不接納通知書；ReplyTo＝訓練班電郵）══════════ */

var HRN = { COL_ID: 1, COL_EMAIL: 2, COL_NAME: 3, COL_ACCEPT: 29, COL_STATUS: 37, COL_NOTICE: 52, COL_NOTICE_AT: 53 };

function hcsSendRegNotice_(ss, b) {
  var sh = ss.getSheetByName('表格回應');
  if (!sh) return { ok: false, error: '找不到「表格回應」分頁' };
  if (String(sh.getRange(1, HRN.COL_NOTICE).getDisplayValue() || '').trim() === '') {
    sh.getRange(1, 50, 1, 4).setValues([['已退款', '退款核對人', '通知書', '通知書寄出時間']]);
  }

  var info = hrnCourseInfo_(ss);
  var replyTo = hrnParam_(ss, '訓練班電郵') || (info.leader && info.leader.email) || '';
  if (!replyTo) return { ok: false, error: '未設定訓練班電郵／班領導人電郵，未能寄出通知書' };

  var ids = {};
  if (b && Array.isArray(b.ids)) {
    b.ids.forEach(function (x) { var s = String(x || '').trim(); if (s) ids[s] = true; });
  }
  var hasFilter = Object.keys(ids).length > 0;

  var last = sh.getLastRow();
  if (last < 2) return { ok: true, data: { sent: 0, skipped: 0, failed: 0, results: [] } };
  var width = Math.max(sh.getLastColumn(), HRN.COL_NOTICE_AT);
  var values = sh.getRange(1, 1, last, width).getValues();

  var sent = 0, skipped = 0, failed = 0, results = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var id = String(row[HRN.COL_ID - 1] || '').trim();
    if (!id || (hasFilter && !ids[id])) continue;
    var name = String(row[HRN.COL_NAME - 1] || '').trim() || '申請人';
    var email = String(row[HRN.COL_EMAIL - 1] || '').trim();
    var status = String(row[HRN.COL_STATUS - 1] || '').trim().toLowerCase();
    if (!status) {
      status = row[HRN.COL_ACCEPT - 1] === '✔' ? 'approved' : (row[HRN.COL_ACCEPT - 1] === '✗' ? 'rejected' : 'pending');
    }
    if (status !== 'approved' && status !== 'rejected') {
      skipped++; results.push({ id: id, skipped: true, reason: '未有接納／不接納決定' }); continue;
    }
    if (String(row[HRN.COL_NOTICE - 1] || '').trim()) {
      skipped++; results.push({ id: id, skipped: true, reason: '已寄過通知書' }); continue;
    }
    if (!email) { failed++; results.push({ id: id, ok: false, error: '沒有申請人電郵' }); continue; }

    var kind = status === 'approved' ? 'accepted' : 'rejected';
    var mail = hrnBuildMail_(kind, name, info, replyTo);
    try {
      MailApp.sendEmail({
        to: email, replyTo: replyTo,
        cc: info.leader && info.leader.email && info.leader.email !== replyTo ? info.leader.email : '',
        name: info.courseName || '筲箕灣區訓練班',
        subject: mail.subject, body: mail.body
      });
      sh.getRange(i + 1, HRN.COL_NOTICE).setValue(kind);
      sh.getRange(i + 1, HRN.COL_NOTICE_AT).setValue(new Date());
      sent++;
      results.push({ id: id, ok: true, kind: kind });
    } catch (e) {
      failed++;
      results.push({ id: id, ok: false, error: String(e && e.message ? e.message : e) });
    }
  }
  return { ok: failed === 0, data: { sent: sent, skipped: skipped, failed: failed, results: results } };
}

function hrnParam_(ss, label) {
  var sh = ss.getSheetByName('參數');
  if (!sh || sh.getLastRow() < 1) return '';
  var vals = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim().indexOf(label) >= 0) return String(vals[i][1] || '').trim();
  }
  return '';
}

function hrnCourseInfo_(ss) {
  var sh = ss.getSheetByName('Input02 訓練班資料');
  var out = { courseName: '', sessions: [], leader: null };
  if (!sh) return out;
  out.courseName = String(sh.getRange(1, 2).getDisplayValue() || '').trim();
  var vals = sh.getRange(9, 1, 8, 11).getDisplayValues();
  for (var i = 0; i < 8; i++) {
    var r = vals[i];
    var on = String(r[7] || '').toUpperCase();
    if (on !== 'TRUE' && on !== '✔' && on !== '✓') continue;
    out.sessions.push({ date: r[8] || r[6] || r[1], time: r[9] || r[3], venue: r[10] || r[4] });
  }
  for (var r0 = 23; r0 <= 42; r0++) {
    var role = String(sh.getRange(r0, 1).getDisplayValue() || '').trim();
    var name = String(sh.getRange(r0, 2).getDisplayValue() || '').trim();
    if (role === '班領導人' || (!out.leader && name)) {
      out.leader = {
        role: role, name: name,
        title: String(sh.getRange(r0, 3).getDisplayValue() || '').trim(),
        phone: String(sh.getRange(r0, 6).getDisplayValue() || '').trim(),
        email: String(sh.getRange(r0, 7).getDisplayValue() || '').trim()
      };
      if (role === '班領導人') break;
    }
  }
  return out;
}

function hrnBuildMail_(kind, name, info, replyTo) {
  var title = info.courseName || '訓練班';
  var leaderName = info.leader ? (info.leader.name + (info.leader.title || '')) : '班領導人';
  if (kind === 'accepted') {
    var lines = [];
    lines.push(name + '：', '');
    lines.push('閣下報名參加「' + title + '」已獲接納。', '');
    if (info.sessions.length) {
      lines.push('訓練班資料：');
      info.sessions.forEach(function (s, i) {
        lines.push((i + 1) + '. ' + [s.date, s.time, s.venue].filter(Boolean).join('　'));
      });
      lines.push('');
    }
    lines.push('如有查詢，請直接回覆本電郵（' + replyTo + '）。', '');
    lines.push(leaderName);
    return { subject: '【接納通知】' + title, body: lines.join('\n') };
  }
  return {
    subject: '【不接納通知】' + title,
    body: [
      name + '：', '',
      '多謝閣下報名參加「' + title + '」。因名額所限／訓練班安排所需，閣下今次未能獲接納。', '',
      '如已繳交訓練班費用，區會將按既定程序辦理退款。歡迎日後再次報名參加本區訓練班。', '',
      '如有查詢，請直接回覆本電郵（' + replyTo + '）。', '',
      leaderName
    ].join('\n')
  };
}
