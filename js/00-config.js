/* ============================================================
 * 00-config.js — 常數・分頁名・欄位座標表
 * 座標全部跟 Code.gs.course.js（v4.13.0 模版）setupCourseSheet 起嘅工作簿：
 *   人手改過嘅舊表唔保證啱位（Script 原註釋都有講）。
 * ============================================================ */

const APP_INFO = {
  name: '訓練班管理系統',
  short: '訓練班',
  version: '1.0.0-phase1',
  defaultPassword: '1234',        // 共用密碼（純前端閘，真正存取權限 = API Key）
  pollMs: 15000,                  // 自動同步間隔
  tz: 'Asia/Hong_Kong',
};

/* ── 分頁名（唔好改！Script 靠呢啲名讀寫） ── */
const TAB = {
  IN1: 'Input01 訓練班預算',
  IN2: 'Input02 訓練班資料',
  IN3: 'Input03 時間表',
  IN4: 'Input04_Print支出表',
  RESP: '表格回應',
  PARAM: '參數',
  NOTICE: 'Print_通告',
  ATTEND: 'Print_學員出席紀錄',
  COMPLETE: 'Print_訓練班完成報告',
  CERT: 'Print_領取證書紀錄',
};

/* ── 表格回應欄（跟模版 44 欄） ── */
const RESP_HEADERS = [
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
  /* coursev5 新增（AS-AW）：45-47 由區管理系統 setPaymentCheck 寫；48-49 由本 APP 職員收表時寫 */
  '已核對收款', '核對人', '核對時間', '已交表格正本（STA）', '收表記錄',
  /* coursev5.2 新增（AX-BA）：由區管理系統退款 tick；由訓練班 APP 寄通知書後記錄 */
  '已退款', '退款核對人', '通知書', '通知書寄出時間',
];
/* 1-based 欄號（對應 saveCourseBatch cells 座標） */
const RC = {};
RESP_HEADERS.forEach((h, i) => { RC[h] = i + 1; });
const RC_ID = RC['時間戳記'];            // 報名唯一 id（setRegStatus 用）
const RC_ACCEPT = RC['接納'];            // ✔ / ✗
const RC_STATUS = RC['審批狀態'];
const RC_REVIEWER = RC['批核人'];
const RC_REVIEWED_AT = RC['批核時間'];
const RC_STUDENT_NO = RC['學員編號'];    // 公式欄（接納✔後自動編號，唔好寫）
const RC_GROUP = RC['分組'];             // 職員人手填
const RC_TROOPNO = RC['旅號'];           // 公式欄（旅團抽數字，唔好寫）
const RC_REFUNDED = RC['已退款'];
const RC_REG_NOTICE = RC['通知書'];

/* ── 審批狀態（同區管理平台一致） ── */
const STATUS_INFO = {
  pending:   { label: '待批',   cls: 'st-pending' },
  approved:  { label: '已取錄', cls: 'st-approved' },
  rejected:  { label: '已拒絕', cls: 'st-rejected' },
  cancelled: { label: '已取消', cls: 'st-cancelled' },
};

/* ── 下拉選項（跟參數分頁） ── */
const BRANCH_OPTIONS = ['小童軍', '幼童軍', '童軍', '深資童軍', '樂行童軍'];
const COURSE_TYPE_OPTIONS = ['工作坊', '訓練班', '會議', '聚會', '比賽'];
const GROUP_OPTIONS = ['第一組', '第二組', '第三組', '第四組', '第五組', '第六組', '第七組', '第八組'];
const MEAL_WHO_OPTIONS = ['職員', '學員'];

/* 專章清單（= 參數 D2:D111 下拉；格式「組別 - 名稱」，其他獎章直名） */
const BADGE_RAW = {
  '興趣': ['釣魚', '愛護動物', '射箭', '藝術', '運動', '營地烹飪', '獨木舟', '搜集', '電腦', '單車', '龍舟', '步操', '地質', '騎術', '風箏', '圖書管理', '氣象', '模型製作', '音樂', '自然', '公園定向', '攝影', '划艇', '風帆', '農務', '游泳', '旅遊', '滑浪風帆'],
  '技能': ['射箭', '天象', '航空領航', '原野烹飪', '露營', '獨木舟水球', '獨木舟', '通訊', '烹飪（中式）', '手藝', '電子', '探險', '模擬飛行', '步操', '獨木舟國際賽艇', '地圖繪製', '地圖閱讀', '射擊', '技擊', '機械', '氣象', '多媒體創作', '領航', '觀察', '野外定向', '先鋒工程', '編程', '風帆賽艇舵手', '風帆', '徒手潛水', '艇長', '體育', '樹木護理', '國際友誼'],
  '服務': ['營地管理', '獨木舟救生', '公民', '護養', '共融', '消防', '急救', '指引', '語言', '工藝', '拯溺', '精神健康', '食物營養', '領港', '公共衛生', '物資管理', '秘書'],
  '教導': ['單車', '攝影', '風帆', '游泳', '天象', '原野烹飪', '露營', '通訊', '烹飪（中式）', '模擬飛行', '地圖繪製', '機械', '氣象', '多媒體創作', '觀察', '野外定向', '先鋒工程', '樹木護理', '護養', '拯溺'],
};
const BADGE_EXTRA = ['領導才', '繩結', '艇工', '水手', '水手長', '初級航空活動章', '中級航空活動章', '高級航空活動章', '社區參與章', '維護自然世界', '世界童軍環境章'];
const BADGE_OPTIONS = []
  .concat(Object.keys(BADGE_RAW).reduce((acc, g) => acc.concat(BADGE_RAW[g].map(n => g + ' - ' + n)), []))
  .concat(BADGE_EXTRA);

/* ============================================================
 * Input01 訓練班預算 — 座標表
 * ============================================================ */
const IN1_CELLS = {
  name:      { r: 1,  c: 2, label: '活動/訓練班名稱', type: 'text' },
  edition:   { r: 4,  c: 2, label: '屆別', type: 'number' },
  section:   { r: 5,  c: 2, label: '支部', type: 'select', options: BRANCH_OPTIONS },
  badge:     { r: 6,  c: 2, label: '專章', type: 'badge' },
  customName:{ r: 7,  c: 2, label: '自定義名稱', type: 'text' },
  type1:     { r: 8,  c: 2, label: '形式-1', type: 'select', options: COURSE_TYPE_OPTIONS },
  type2:     { r: 9,  c: 2, label: '形式-2', type: 'select', options: COURSE_TYPE_OPTIONS },
  intake:    { r: 11, c: 2, label: '預計收生人數', type: 'number' },
  fee:       { r: 12, c: 2, label: '預計收費（元）', type: 'number' },
  staff:     { r: 13, c: 2, label: '職員人數（不計講師）', type: 'number' },
};

/* 活動日期及場地：列 16–24（B 日期 / C 時間 / E 場地） */
const IN1_DATES = {
  rows: [16, 17, 18, 19, 20, 21, 22, 23, 24],
  date: 2, time: 3, venue: 5,
  labels: { date: '日期', time: '時間 (0000-2359)', venue: '場地' },
};

/* 1. 膳食：列 32–39（B 日期 / C 時間 / E早 F午 G晚 H茶點 I飲用水 人均 / J 職員學員） */
const IN1_MEALS = {
  rows: [32, 33, 34, 35, 36, 37, 38, 39],
  date: 2, time: 3, breakfast: 5, lunch: 6, dinner: 7, snack: 8, water: 9, who: 10,
  guide: '區指引人均預算：早餐 $25・午餐 $55・晚餐 $65・茶點 $10',
};

/* 2.1 場租：列 47–49（B 地點 / C 時段 / F 數量 / H 單價）；其他收費 48–50（H 金額） */
const IN1_RENT = { rows: [47, 48, 49], venue: 2, slot: 3, qty: 6, price: 8 };
const IN1_RENT_EXTRA = { rows: [48, 49, 50], amount: 8 };
/* 2.2 露營 54–56；2.3 住宿 62–64（B 地點 / C 營期 / F 日晚數 / G 人數 / H 價格） */
const IN1_CAMP = { rows: [54, 55, 56], venue: 2, period: 3, nights: 6, people: 7, price: 8 };
const IN1_LODGE = { rows: [62, 63, 64], venue: 2, period: 3, nights: 6, people: 7, price: 8 };

/* 3. 交通（C 說明 / H 預算） */
const IN1_TRANSPORT = [
  { key: 'equip', label: '3.1 器材', rows: [69, 70] },
  { key: 'staff', label: '3.2 職員', rows: [71, 72] },
  { key: 'cand',  label: '3.3 學員', rows: [73, 74] },
];
const IN1_TRANSPORT_COLS = { desc: 3, budget: 8 };

/* 4–7：講義/節目/行政/紀念品（B 項目名 / G 數量 / H 單價） */
const IN1_HANDOUTS = { rows: [79, 80, 81], labels: ['影印 Photocopy', '光碟 CD Rom', '快勞 File'], name: 2, qty: 7, price: 8 };
const IN1_PROGRAMME = { rows: [85, 86, 87], name: 2, qty: 7, price: 8 };
const IN1_ADMIN = { rows: [91, 92, 93], labels: ['攝影 Photo', '印刷及郵費 Printing & Postage', '文具 Stationery'], name: 2, qty: 7, price: 8 };
const IN1_SOUVENIR = { rows: [97, 98], labels: ['紀念品 Souvenir（需填寫 Print_財政預算 申請訂造）', '獎品 Prize'], name: 2, qty: 7, price: 8 };

/* 8. 其他：列 102–104（B 項目 / E 金額） */
const IN1_MISC = { rows: [102, 103, 104], name: 2, amount: 5 };

/* ============================================================
 * Input02 訓練班資料 — 座標表
 * ============================================================ */
/* B1/B4/B5/B6 係黃格（公式由預算帶入）；寫入會蓋掉公式 — UI 要 confirm */
const IN2_CELLS = {
  name:   { r: 1,  c: 2, label: '活動/訓練班名稱', type: 'text',   auto: true },
  quota:  { r: 4,  c: 2, label: '名額', type: 'number', auto: true },
  fee:    { r: 5,  c: 2, label: '預計收費（元）', type: 'number', auto: true },
  staff:  { r: 6,  c: 2, label: '職員人數（不計講師）', type: 'number', auto: true },
};

/* 節次：列 9–16。C 橫跨 / H ✓上通告 係剔格；G 自動中文日期係公式（只讀）；I 預設公式（覆寫要 confirm） */
const IN2_SESSIONS = {
  rows: [9, 10, 11, 12, 13, 14, 15, 16],
  date: 2, cross: 3, time: 4, venue: 5, autoCN: 7, onNotice: 8, dispDate: 9, dispTime: 10, dispVenue: 11,
};

const IN2_DEADLINE = { r: 18, c: 2, label: '截止報名日期', type: 'date' };
const IN2_PUBLISH = { r: 19, c: 2, label: '最遲公佈取錄名單日', type: 'date' };

/* 職員表：列 23–42（A 職位 / B 姓名 / C 稱謂 / D 單位職銜 / E 資格 / F 電話 / G 電郵） */
const IN2_STAFF = {
  rows: [23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42],
  role: 1, name: 2, title: 3, unit: 4, qual: 5, phone: 6, email: 7,
};
const STAFF_ROLE_DEFAULTS = [
  '班領導人', '副班領導人', '副班領導人', '助理班領導人',
  '小隊導師', '小隊導師', '小隊導師', '小隊導師',
  '團隊長', '團隊長', '班務行政', '物資管理', '物資管理',
  '講師', '講師', '講師', '講師', '講師', '講師', '講師',
];
const IN2_RESIDENT = { r: 46, c: 2, label: '常駐班職員人數', type: 'number' };

/* ============================================================
 * Print_通告 — 可編欄位（其餘係公式自動帶入）
 * ============================================================ */
const NOTICE_EDIT = {
  fileNo:     { r: 12, c: 7, label: '檔案編號', type: 'text', hint: '區會編，等 ADC 通知先填（例：檔案編號: 2627）' },
  issueDate:  { r: 13, c: 7, label: '發出日期', type: 'date' },
  eligibility:{ r: 23, c: 3, label: '參加資格', type: 'textarea', hint: '例：已宣誓及持有有效紀錄冊之支部成員（港島地域成員將獲優先取錄）' },
  feeNote:    { r: 24, c: 3, label: '費用說明', type: 'textarea', hint: '例：活動費用港幣60元正（包括行政、茶點等）。' },
  uniform:    { r: 31, c: 3, label: '服裝', type: 'text', hint: '例：整齊童軍制服' },
  remark1:    { r: 32, c: 3, label: '備註 1', type: 'textarea' },
  remark2:    { r: 33, c: 3, label: '備註 2', type: 'textarea' },
  remark3:    { r: 34, c: 3, label: '備註 3', type: 'textarea' },
  remark4:    { r: 35, c: 3, label: '備註 4', type: 'textarea' },
  remark5:    { r: 36, c: 3, label: '備註 5', type: 'textarea' },
  remark6:    { r: 37, c: 3, label: '備註 6', type: 'textarea' },
  signer:     { r: 43, c: 5, label: '區總監署名（姓名）', type: 'text' },
  deputy:     { r: 45, c: 5, label: '代行（姓名）', type: 'text', hint: '區總監授權他人代簽先填' },
};
const NOTICE_REMARK_DEFAULTS = [
  '1. 報名前須獲得家長及旅團領袖同意並於網上表格提供有關資料包括其姓名及電郵等；',
  '2. 報名前須先以轉數快繳付有關費用並截圖紀錄；',
  '3. 取錄與否，一概以電郵通知及公佈於筲箕灣區網頁（www.skwscout.org.hk）；',
  '4. 學員必須全期出席訓練班，不得遲到或早退，並完成指定事工，始獲考慮頒發證書；',
  '5. 筲箕灣區合資格學員可獲「章」有進步訓練班資助計劃資助，詳情請參考本區通告（ ）號；',
  '6. 有經濟需要之青少年成員可根據「學生隊員訓練資助計劃」申請資助參加本訓練班，詳情請參閱總會行政通告第（ ）號。',
];

/* raw dump key → 分頁名（getCourseSheetRaw 回傳嘅欄位） */
const RAW_TAB_MAP = {
  input01: TAB.IN1, input02: TAB.IN2, input03: TAB.IN3, input04: TAB.IN4,
  resp: TAB.RESP, notice: TAB.NOTICE, attend: TAB.ATTEND,
  completion: TAB.COMPLETE, cert: TAB.CERT,
};

/* ── localStorage 鍵 ── */
/* Input03 時間表:每節一個 10 行 block,第 1 節 R2 起(block i head 行 = 2+(i-1)×10)
   R(head):B「日期:」C 值・E「地點:」F 值;R(head+1):B「時間:」C 值・E「服裝:」F 值
   R(head+3) 表頭;R(head+4 至 head+8) rundown:B 時間・C 需時(分鐘)・D 項目・E 負責人 */
const IN3_LAYOUT = {
  firstHead: 2, blockRows: 10, items: 5, maxBlocks: 9,
  date:  { dr: 0, c: 3 }, venue: { dr: 0, c: 6 },
  time:  { dr: 1, c: 3 }, dress: { dr: 1, c: 6 },
  item:  { start: 2, mins: 3, name: 4, owner: 5 },
};

const LS = {
  config: 'courseapp.config.v1',
  drafts: id => 'courseapp.drafts.' + id,
  oplog: id => 'courseapp.oplog.' + id,
  staff: id => 'courseapp.staff.' + id,
  qr: id => 'courseapp.qr.' + id,
  mock: 'courseapp.mock.v1',
  mockCourses: 'courseapp.mockcourses.v1',
  mockRegistry: 'courseapp.mockregistry.v1',   /* hub 登記表（對應之源）鏡像 */
};
const SS_UNLOCKED = 'courseapp.unlocked';
