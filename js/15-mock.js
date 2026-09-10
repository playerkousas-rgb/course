/* ============================================================
 * 15-mock.js — 演示後端（mock）
 * 完全照 Code.gs.course.js 合約實作（rev 樂觀鎖／ScriptLock 排隊／
 * setRegStatus 唔 bump rev／支出 append-only 等語義一致），
 * 令你冇真 Sheet 都可以即刻試晒成個流程＋防呆機制。
 * 狀態存 localStorage（重新整理唔會走）；設定可以重設。
 * ============================================================ */

const MOCK_API_KEY = 'ck_demo_key_2026';

/* 可寫分頁（同 COURSE_WRITABLE_TABS） */
const MOCK_WRITABLE_TABS = [
  TAB.IN1, TAB.IN2, TAB.IN3, TAB.IN4, TAB.RESP, TAB.PARAM,
  'Print_通告', 'Print_接納通知書', 'Print_財政預算', 'Print_訓練班完成報告',
  'Print_領取證書紀錄', 'Print_總會資助計劃',
  'Print_取錄名單', 'Print_合格名單', 'Print_學員名單', 'Print_學員出席紀錄',
  'Print_收支紀錄', 'Print_班職員名單',
];

function mockGrid(rows, cols) {
  const g = [];
  for (let i = 0; i < rows; i++) g.push(new Array(cols).fill(''));
  return g;
}
function mockSet(g, r, c, v) { if (g[r - 1]) g[r - 1][c - 1] = v; }

/* ── 種子資料：攝影專科徽章訓練班 ── */
function mockSeedState() {
  const IN1 = mockGrid(105, 13);
  mockSet(IN1, 1, 1, '活動/訓練班名稱'); mockSet(IN1, 1, 2, '攝影專科徽章訓練班');
  mockSet(IN1, 4, 1, '屆別'); mockSet(IN1, 4, 2, 3); mockSet(IN1, 4, 3, '屆');
  mockSet(IN1, 5, 1, '支部'); mockSet(IN1, 5, 2, '童軍');
  mockSet(IN1, 6, 1, '專章'); mockSet(IN1, 6, 2, '興趣 - 攝影');
  mockSet(IN1, 8, 1, '形式-1'); mockSet(IN1, 8, 2, '訓練班');
  mockSet(IN1, 11, 1, '預計收生人數'); mockSet(IN1, 11, 2, 24); mockSet(IN1, 11, 3, '名');
  mockSet(IN1, 12, 1, '預計收費'); mockSet(IN1, 12, 2, 60); mockSet(IN1, 12, 3, '元');
  mockSet(IN1, 13, 1, '職員人數'); mockSet(IN1, 13, 2, 6); mockSet(IN1, 13, 3, '人 (不計算講師)');
  mockSet(IN1, 15, 2, 'dd/mm/yyyy'); mockSet(IN1, 15, 3, '0000 - 2359'); mockSet(IN1, 15, 5, '場地');
  mockSet(IN1, 16, 1, '活動日期及場地');
  mockSet(IN1, 16, 2, '2026-10-17'); mockSet(IN1, 16, 3, '1930 - 2130'); mockSet(IN1, 16, 5, '筲箕灣區總部');
  mockSet(IN1, 17, 2, '2026-10-24'); mockSet(IN1, 17, 3, '1930 - 2130'); mockSet(IN1, 17, 5, '筲箕灣區總部');
  mockSet(IN1, 18, 2, '2026-11-01'); mockSet(IN1, 18, 3, '0900 - 1700'); mockSet(IN1, 18, 5, '鰂魚涌海濱公園');
  mockSet(IN1, 29, 1, '1. 膳食 Catering');
  mockSet(IN1, 32, 2, '2026-10-17'); mockSet(IN1, 32, 8, 10); mockSet(IN1, 32, 10, '學員');
  mockSet(IN1, 33, 2, '2026-11-01'); mockSet(IN1, 33, 6, 55); mockSet(IN1, 33, 8, 10); mockSet(IN1, 33, 10, '學員');
  mockSet(IN1, 44, 1, '2. 租金Rent');
  mockSet(IN1, 67, 1, '3. 交通/運輸Transportation');
  mockSet(IN1, 101, 1, '8. 其他 Miscelleous (請註明 Please specify)');
  mockSet(IN1, 102, 2, '打印墨水及相紙'); mockSet(IN1, 102, 5, 40);

  const IN2 = mockGrid(46, 11);
  mockSet(IN2, 1, 1, '活動/訓練班名稱'); mockSet(IN2, 1, 2, '攝影專科徽章訓練班');
  mockSet(IN2, 4, 1, '名額'); mockSet(IN2, 4, 2, 24); mockSet(IN2, 4, 3, '名');
  mockSet(IN2, 5, 1, '預計收費'); mockSet(IN2, 5, 2, 60); mockSet(IN2, 5, 3, '元');
  mockSet(IN2, 6, 1, '職員人數'); mockSet(IN2, 6, 2, 6); mockSet(IN2, 6, 3, '人 (不計算講師)');
  mockSet(IN2, 8, 2, 'dd/mm/yyyy'); mockSet(IN2, 8, 3, '橫跨至下一日?'); mockSet(IN2, 8, 4, '0000 - 2359');
  mockSet(IN2, 8, 5, '場地'); mockSet(IN2, 8, 7, '（自動）'); mockSet(IN2, 8, 8, '✓上通告');
  mockSet(IN2, 8, 9, '通告顯示日期'); mockSet(IN2, 8, 10, '通告顯示時間'); mockSet(IN2, 8, 11, '通告顯示地點');
  mockSet(IN2, 9, 1, '活動日期及場地');
  const sess = [
    [9,  '2026-10-17', '1930 - 2130', '筲箕灣區總部', true,  '2026年10月17日（星期六）', '下午7時30分至9時30分', '筲箕灣區總部'],
    [10, '2026-10-24', '1930 - 2130', '筲箕灣區總部', true,  '2026年10月24日（星期六）', '下午7時30分至9時30分', '筲箕灣區總部'],
    [11, '2026-11-01', '0900 - 1700', '鰂魚涌海濱公園', true, '2026年11月1日（星期日）', '上午9時至下午5時', '鰂魚涌海濱公園'],
  ];
  sess.forEach((s) => {
    mockSet(IN2, s[0], 2, s[1]); mockSet(IN2, s[0], 4, s[2]); mockSet(IN2, s[0], 5, s[3]);
    mockSet(IN2, s[0], 8, s[4]); mockSet(IN2, s[0], 9, s[5]); mockSet(IN2, s[0], 10, s[6]); mockSet(IN2, s[0], 11, s[7]);
  });
  mockSet(IN2, 18, 1, '截止報名日期'); mockSet(IN2, 18, 2, '2026-10-05');
  mockSet(IN2, 19, 1, '最遲公佈取錄名單日'); mockSet(IN2, 19, 2, '2026-10-08');
  mockSet(IN2, 21, 1, '職員資料');
  ['職位', '姓名', '稱謂', '所屬單位 / 職銜', '資格標註', '電話', '電郵'].forEach((h, i) => mockSet(IN2, 22, i + 1, h));
  const staff = [
    [23, '班領導人', '陳大文', '先生', '筲箕灣區童軍會', '攝影專章導師', '91234567', 'david.chan@example.hk'],
    [24, '副班領導人', '李美芬', '小姐', '筲箕灣區童軍會', '', '92345678', 'mf.lee@example.hk'],
    [25, '副班領導人', '', '', '', '', '', ''],
    [26, '助理班領導人', '', '', '', '', '', ''],
    [27, '小隊導師', '吳家麗', '小姐', '港島第82旅', '深資童軍', '93456789', 'kl.ng@example.hk'],
    [28, '小隊導師', '', '', '', '', '', ''],
    [31, '團隊長', '周志強', '先生', '港島第215旅', '', '94567890', 'ck.chau@example.hk'],
    [33, '班務行政', '何詠恩', '小姐', '筲箕灣區童軍會', '', '95678901', 'wing.wan@example.hk'],
    [36, '講師', '麥俊杰', '先生', '—', '專業攝影師（HPV）', '96789012', 'kk.mak@example.hk'],
  ];
  staff.forEach((s) => { for (let i = 1; i <= 7; i++) mockSet(IN2, s[0], i, s[i]); });
  mockSet(IN2, 45, 1, '班職員總人數'); mockSet(IN2, 45, 2, 6);
  mockSet(IN2, 46, 1, '常駐班職員人數'); mockSet(IN2, 46, 2, 4);

  /* 表格回應 */
  const RESP = [RESP_HEADERS.slice()];
  const mkReg = (o) => {
    const r = new Array(RESP_HEADERS.length).fill('');
    const put = (h, v) => { r[RC[h] - 1] = v; };
    put('時間戳記', o.ts); put('電郵地址', o.email); put('中文姓名', o.nameZh); put('英文姓名', o.nameEn || '');
    put('聯絡電話', o.phone); put('性別', o.gender); put('出生日期', o.dob || '');
    put('所屬童軍區', o.district || '筲箕灣'); put('旅團', o.troop);
    put('童軍成員編號（ScoutID）', o.scoutId || ''); put('童軍職位', o.position || '隊員');
    put('家長／監護人同意參與有關活動。', o.gConsent === false ? '' : 'TRUE');
    put('家長/監護人姓名', o.gName || ''); put('與申請人關係', o.gRel || '母子');
    put('家長/監護人聯絡電郵', o.gEmail || ''); put('家長/監護人聯絡電話', o.gPhone || '');
    put('所屬童軍旅領袖同意參與有關活動。', o.lConsent === false ? '' : 'TRUE');
    put('領袖姓名（中文全名）', o.lName || '陳領袖'); put('領袖職位', o.lPos || '助理旅團領袖');
    put('領袖聯絡電郵', o.lEmail || 'leader82@example.hk');
    put('付款方式', 'FPS'); put('付款人姓名', o.payer || ''); put('付款帳戶', o.payAcc || '102866183');
    put('已繳付訓練班費用截圖', 'https://drive.google.com/file/d/demo-' + o.nameZh + '/view');
    put('是否需要收據', o.receipt || '否'); put('備註', o.note || '');
    put('附加資料(有助訓練班取錄之原因)', o.extra || '');
    put('審批狀態', o.status || 'pending');
    put('批核人', o.reviewer || ''); put('批核時間', o.reviewedAt || '');
    put('接納', o.status === 'approved' ? '✔' : (o.status === 'rejected' || o.status === 'cancelled' ? '✗' : ''));
    put('分組', o.group || '');
    put('已核對收款', o.pcheck ? '✔' : ''); put('核對人', o.pcheck ? (o.pcBy || '區會財務（演示）') : '');
    put('核對時間', o.pcheck ? (o.pcAt || '2026-09-26T09:00:00.000Z') : '');
    put('_courseId', 'demo-course'); put('_courseTitle', '攝影專科徽章訓練班');
    put('_section', '童軍'); put('_badgeCode', 'SPG'); put('_ref', o.ref);
    return r;
  };
  [
    { ts: '2026-09-20T08:15:00.000Z', email: 'siuming@example.hk', nameZh: '王小明', nameEn: 'Wong Siu Ming', gender: '男', dob: '2008-04-12', troop: '港島第82旅', scoutId: '2026082012', phone: '61234567', gName: '王陳秀珍', gPhone: '91230001', payer: '王太太', status: 'approved', reviewer: '陳大文', reviewedAt: '2026-09-22T10:00:00.000Z', group: '第一組', pcheck: true, ref: 'CRS-20260920-1234' },
    { ts: '2026-09-20T09:02:00.000Z', email: 'kaChun@example.hk', nameZh: '李嘉俊', nameEn: 'Lee Ka Chun', gender: '男', dob: '2008-11-03', troop: '港島第82旅', scoutId: '2026082035', phone: '61234568', gName: '李先生', gPhone: '91230002', payer: '李先生', status: 'approved', reviewer: '陳大文', reviewedAt: '2026-09-22T10:01:00.000Z', group: '第二組', pcheck: true, ref: 'CRS-20260920-2345' },
    { ts: '2026-09-21T11:40:00.000Z', email: 'meikei@example.hk', nameZh: '陳美琪', nameEn: 'Chan Mei Kei', gender: '女', dob: '2009-01-25', troop: '港島第215旅', scoutId: '2026082177', phone: '61234569', gName: '陳太', gPhone: '91230003', payer: '陳太', status: 'approved', reviewer: '李美芬', reviewedAt: '2026-09-23T09:00:00.000Z', group: '第二組', receipt: '是', ref: 'CRS-20260921-3456' },
    { ts: '2026-09-21T14:22:00.000Z', email: 'kahojacob@example.hk', nameZh: '張家豪', nameEn: 'Cheung Ka Ho', gender: '男', dob: '2008-07-18', troop: '港島第12旅', scoutId: '2026080119', phone: '61234570', status: 'pending', ref: 'CRS-20260921-4567' },
    { ts: '2026-09-22T07:55:00.000Z', email: 'wingyan@example.hk', nameZh: '黃詠恩', nameEn: 'Wong Wing Yan', gender: '女', dob: '2009-03-08', troop: '港島第82旅', scoutId: '2026082042', phone: '61234571', status: 'pending', extra: '校內攝影學會成員，曾獲學界攝影比賽亞軍', pcheck: true, ref: 'CRS-20260922-5678' },
    { ts: '2026-09-22T16:30:00.000Z', email: 'tszechin@example.hk', nameZh: '周子軒', nameEn: 'Chau Tsz Hin', gender: '男', dob: '2008-09-30', troop: '東九龍第54旅', scoutId: '2026E54033', phone: '61234572', district: '觀塘', status: 'pending', note: '跨區報名，請導師留意', ref: 'CRS-20260922-6789' },
    { ts: '2026-09-23T10:05:00.000Z', email: 'sintung@example.hk', nameZh: '吳倩彤', nameEn: 'Ng Sin Tung', gender: '女', dob: '2009-06-14', troop: '港島第215旅', scoutId: '2026082183', phone: '61234573', status: 'pending', ref: 'CRS-20260923-7890' },
    { ts: '2026-09-23T18:44:00.000Z', email: 'howin@example.hk', nameZh: '鄭浩然', nameEn: 'Cheng Ho Yin', gender: '男', dob: '2008-02-21', troop: '港島第27旅', scoutId: '2026080266', phone: '61234574', status: 'rejected', reviewer: '陳大文', reviewedAt: '2026-09-24T09:12:00.000Z', note: '未附入數紙，已通知補交但截止前未收到', ref: 'CRS-20260923-8901' },
    { ts: '2026-09-24T09:18:00.000Z', email: 'hiutung@example.hk', nameZh: '林曉彤', nameEn: 'Lam Hiu Tung', gender: '女', dob: '2009-08-02', troop: '港島第12旅', scoutId: '2026080150', phone: '61234575', status: 'cancelled', reviewer: '陳大文', reviewedAt: '2026-09-25T08:00:00.000Z', note: '學員自行電郵取消', ref: 'CRS-20260924-9012' },
    { ts: '2026-09-25T21:10:00.000Z', email: 'longyin@example.hk', nameZh: '何朗賢', nameEn: 'Ho Long Yin', gender: '男', dob: '2008-12-09', troop: '港島第82旅', scoutId: '2026082088', phone: '61234576', status: 'pending', ref: 'CRS-20260925-1122' },
  ].forEach((o) => RESP.push(mkReg(o)));

  /* Print_通告（可編欄有料；公式欄由 app 自己組版） */
  const NOTICE = mockGrid(46, 7);
  mockSet(NOTICE, 12, 7, '檔案編號: 26XX');
  mockSet(NOTICE, 15, 1, '攝影專科徽章訓練班');
  mockSet(NOTICE, 17, 2, '日期'); mockSet(NOTICE, 17, 3, '時間'); mockSet(NOTICE, 17, 4, '地點');
  mockSet(NOTICE, 22, 2, '班領導人：');
  mockSet(NOTICE, 23, 2, '參加資格：'); mockSet(NOTICE, 23, 3, '已宣誓及持有有效紀錄冊之支部成員（港島地域成員將獲優先取錄）');
  mockSet(NOTICE, 24, 2, '費 用：'); mockSet(NOTICE, 24, 3, '活動費用港幣60元正（包括行政、茶點等）。');
  mockSet(NOTICE, 28, 2, '名 額：'); mockSet(NOTICE, 29, 2, '截止日期：');
  mockSet(NOTICE, 30, 2, '報名辦法：'); mockSet(NOTICE, 31, 2, '服 裝：'); mockSet(NOTICE, 31, 3, '整齊童軍制服');
  mockSet(NOTICE, 32, 2, '備 註：');
  NOTICE_REMARK_DEFAULTS.forEach((t, i) => mockSet(NOTICE, 32 + i, 3, t));
  mockSet(NOTICE, 39, 2, '查 詢：');
  mockSet(NOTICE, 42, 2, '掃描付款'); mockSet(NOTICE, 42, 5, '區總監'); mockSet(NOTICE, 44, 2, 'QR Code'); mockSet(NOTICE, 45, 5, '（　　　　代行）');

  /* Input04 支出表（收據 1–35 行；已有一筆） */
  const IN4 = mockGrid(46, 11);
  mockSet(IN4, 1, 1, '筲箕灣童軍區會'); mockSet(IN4, 2, 1, '活動支出');
  mockSet(IN4, 6, 1, '類別'); mockSet(IN4, 6, 2, '茶　點'); mockSet(IN4, 6, 3, '膳食津貼');
  mockSet(IN4, 6, 4, '職員膳食'); mockSet(IN4, 6, 5, '住　宿'); mockSet(IN4, 6, 6, '交通');
  mockSet(IN4, 6, 7, '行　政'); mockSet(IN4, 6, 8, '講義及快勞'); mockSet(IN4, 6, 9, '其　他');
  mockSet(IN4, 6, 10, '設　備'); mockSet(IN4, 6, 11, '備註');
  mockSet(IN4, 7, 1, '收據編號');
  for (let r = 8; r <= 42; r++) mockSet(IN4, r, 1, r - 7);
  mockSet(IN4, 8, 2, 120); mockSet(IN4, 8, 11, '10月17日茶點（24人×$5）');

  /* Print_學員出席紀錄（coursev5 數碼版式：第4行日期、第5行表頭、6行起學員、職員區喺 28 行） */
  const ATT = mockGrid(64, 16);
  mockSet(ATT, 4, 5, '2026-10-17'); mockSet(ATT, 4, 6, '2026-10-24'); mockSet(ATT, 4, 7, '2026-11-01');
  mockSet(ATT, 5, 1, '分組'); mockSet(ATT, 5, 2, '學員編號'); mockSet(ATT, 5, 3, '中文姓名'); mockSet(ATT, 5, 4, '英文姓名');
  mockSet(ATT, 6, 1, '第一組'); mockSet(ATT, 6, 2, 1); mockSet(ATT, 6, 3, '王小明'); mockSet(ATT, 6, 4, 'Wong Siu Ming'); mockSet(ATT, 6, 5, '✔');
  mockSet(ATT, 7, 1, '第二組'); mockSet(ATT, 7, 2, 2); mockSet(ATT, 7, 3, '李嘉俊'); mockSet(ATT, 7, 4, 'Lee Ka Chun'); mockSet(ATT, 7, 5, '✔');
  mockSet(ATT, 8, 1, '第二組'); mockSet(ATT, 8, 2, 3); mockSet(ATT, 8, 3, '陳美琪'); mockSet(ATT, 8, 4, 'Chan Mei Kei'); mockSet(ATT, 8, 5, '✗');
  mockSet(ATT, 28, 1, '職員出席（服務時數自動計）');
  mockSet(ATT, 29, 1, '職位'); mockSet(ATT, 29, 2, '姓名'); mockSet(ATT, 29, 3, '稱謂');
  mockSet(ATT, 30, 1, '班領導人'); mockSet(ATT, 30, 2, '陳大文'); mockSet(ATT, 30, 3, '先生'); mockSet(ATT, 30, 5, '✔');
  mockSet(ATT, 31, 1, '副班領導人'); mockSet(ATT, 31, 2, '李美芬'); mockSet(ATT, 31, 3, '小姐');

  /* Print_訓練班完成報告 + Print_領取證書紀錄（王小明已評合格） */
  const COMP = mockGrid(46, 8);
  mockSet(COMP, 1, 1, '攝影專科徽章訓練班'); mockSet(COMP, 2, 1, '訓練班完成報告');
  mockSet(COMP, 4, 1, '舉辦日期：'); mockSet(COMP, 4, 3, '2026/10/17, 2026/10/24, 2026/11/1');
  mockSet(COMP, 5, 1, '報班人數（本區）：'); mockSet(COMP, 5, 5, '報班人數（他區）：');
  mockSet(COMP, 6, 1, '接納人數（本區）：'); mockSet(COMP, 6, 5, '接納人數（他區）：');
  mockSet(COMP, 7, 1, '完成人數：'); mockSet(COMP, 7, 5, '合格人數：');
  ['學員編號', '中文姓名', '旅號', '證書編號', '合格與否', '不合格原因'].forEach((t, i) => mockSet(COMP, 9, i + 1, t));
  mockSet(COMP, 10, 1, 1); mockSet(COMP, 10, 2, '王小明'); mockSet(COMP, 10, 3, '82');
  mockSet(COMP, 10, 4, 'SPG-2026-001'); mockSet(COMP, 10, 5, '合格');

  const CERT = mockGrid(44, 8);
  mockSet(CERT, 1, 2, '領取證書紀錄');
  mockSet(CERT, 3, 4, '舉辦日期：'); mockSet(CERT, 3, 7, '2026/10/17, 2026/10/24, 2026/11/1');
  mockSet(CERT, 4, 4, '班領導人：'); mockSet(CERT, 4, 7, '陳大文');
  ['學員編號', '中文姓名', '旅號', '證書編號', '領取日期', '簽收'].forEach((t, i) => mockSet(CERT, 6, i + 2, t));
  mockSet(CERT, 7, 2, 1); mockSet(CERT, 7, 3, '王小明'); mockSet(CERT, 7, 4, '82'); mockSet(CERT, 7, 5, 'SPG-2026-001');

  /* 參數分頁（區會常數＋「區會批准」格——區管理層批核寫呢度,CL 喺 APP 見到 ✔ 先出通告） */
  const PARAM = [
    ['區會常數（唔好改名）', ''],
    ['成員系統報名網址', 'https://member-portal-sigma-swart.vercel.app/training'],
    ['FPS 識別碼', '102866183'],
    ['FPS 戶口名稱', 'SCOUT ASSOCIATION OF HONG KONG - SHAU KEI WAN DISTRICT'],
    ['區會網址', 'www.skwscout.org.hk'],
    ['區會批准', '✔'],
  ];

  const st = {
    rev: 0, savedAt: '', by: '',
    sheets: {},
  };
  st.sheets[TAB.IN1] = IN1; st.sheets[TAB.IN2] = IN2;
  st.sheets[TAB.IN4] = IN4; st.sheets[TAB.RESP] = RESP; st.sheets[TAB.NOTICE] = NOTICE;
  /* Input03 時間表（每節 10 行 block:R2 起;每節 5 行 rundown） */
  const IN3 = mockGrid(95, 8);
  const in3Block = (head, date, time, venue, dress, items) => {
    mockSet(IN3, head, 2, '日期：'); mockSet(IN3, head, 3, date);
    mockSet(IN3, head, 5, '地點：'); mockSet(IN3, head, 6, venue);
    mockSet(IN3, head + 1, 2, '時間：'); mockSet(IN3, head + 1, 3, time);
    mockSet(IN3, head + 1, 5, '服裝：'); mockSet(IN3, head + 1, 6, dress);
    ['時 間', '需時（分鐘）', '項目', '負責人'].forEach((t, i) => mockSet(IN3, head + 3, i + 2, t));
    items.forEach((it, i) => {
      mockSet(IN3, head + 4 + i, 2, it[0]); mockSet(IN3, head + 4 + i, 3, it[1]);
      mockSet(IN3, head + 4 + i, 4, it[2]); mockSet(IN3, head + 4 + i, 5, it[3]);
    });
  };
  in3Block(2, '2026-10-17', '1930 - 2130', '筲箕灣區總部', '童軍制服', [
    ['1930', 5, '報到', '班務行政'], ['1935', 20, '攝影基礎理論', '陳大文'],
    ['1955', 45, '光圈・快門・構圖實作', '麥俊杰'], ['2040', 40, '分組實習拍攝', '麥俊杰'],
    ['2135', 20, '作品分享＋宣布事項及解散', '陳大文'],
  ]);
  in3Block(12, '2026-10-24', '1930 - 2130', '筲箕灣區總部', '童軍制服', [
    ['1930', 5, '報到', '班務行政'], ['1935', 30, '夜景長曝技巧', '麥俊杰'],
    ['2005', 45, '外影實習（區總部外圍）', '陳大文'], ['2050', 40, '照片整理＋後製', '李美芬'],
  ]);
  in3Block(22, '2026-11-01', '0900 - 1700', '鰂魚涌海濱公園', '便服（旅巾）', [
    ['0900', 10, '集合點名', '班務行政'], ['0910', 60, '外影主題講解', '麥俊杰'],
    ['1010', 120, '戶外實習拍攝', '全體職員'], ['1310', 90, '午膳＋作品篩選', '李美芬'],
    ['1440', 60, '作品評審＋頒發結業', '陳大文'],
  ]);
  st.sheets[TAB.IN3] = IN3;
  st.sheets[TAB.PARAM] = PARAM;
  st.sheets[TAB.ATTEND] = ATT;
  st.sheets[TAB.COMPLETE] = COMP;
  st.sheets[TAB.CERT] = CERT;
  return st;
}

/* ── 空白模版 state（createCourse 用:全部分頁齊、基本資料預填） ── */
function mockBlankState(nm, b) {
  b = b || {};
  const IN1 = mockGrid(105, 13);
  mockSet(IN1, 1, 2, nm);
  if (b.edition) mockSet(IN1, 4, 2, b.edition);
  if (b.section) mockSet(IN1, 5, 2, b.section);
  if (b.badge) mockSet(IN1, 6, 2, b.badge);
  mockSet(IN1, 8, 2, '訓練班');
  if (b.intake) mockSet(IN1, 11, 2, b.intake);
  if (b.fee) mockSet(IN1, 12, 2, b.fee);
  if (b.staffN) mockSet(IN1, 13, 2, b.staffN);

  const IN2 = mockGrid(50, 12);
  mockSet(IN2, 1, 2, nm);
  if (b.intake) mockSet(IN2, 4, 2, b.intake);
  if (b.fee) mockSet(IN2, 5, 2, b.fee);
  if (b.staffN) mockSet(IN2, 6, 2, b.staffN);
  ['職位', '姓名', '稱謂', '所屬單位 / 職銜', '資格標註', '電話', '電郵'].forEach((h, i) => mockSet(IN2, 22, i + 1, h));
  if (b.clName) {
    mockSet(IN2, 23, 1, '班領導人'); mockSet(IN2, 23, 2, b.clName); mockSet(IN2, 23, 3, b.clTitle || '');
  }

  const IN3 = mockGrid(95, 8);
  for (let i = 0; i < IN3_LAYOUT.maxBlocks; i++) {
    const head = IN3_LAYOUT.firstHead + i * IN3_LAYOUT.blockRows;
    mockSet(IN3, head, 2, '日期：'); mockSet(IN3, head, 5, '地點：');
    mockSet(IN3, head + 1, 2, '時間：'); mockSet(IN3, head + 1, 5, '服裝：');
    ['時 間', '需時（分鐘）', '項目', '負責人'].forEach((t, j) => mockSet(IN3, head + 3, j + 2, t));
  }

  const IN4 = mockGrid(46, 11);
  mockSet(IN4, 1, 1, '筲箕灣童軍區會'); mockSet(IN4, 2, 1, '活動支出');
  ['類別', '茶　點', '膳食津貼', '職員膳食', '住　宿', '交通', '行　政', '講義及快勞', '其　他', '設　備', '備註']
    .forEach((t, i) => mockSet(IN4, 6, i + 1, t));
  mockSet(IN4, 7, 1, '收據編號');
  for (let r = 8; r <= 42; r++) mockSet(IN4, r, 1, r - 7);

  const PARAM = [
    ['區會常數（唔好改名）', ''],
    ['成員系統報名網址', 'https://member-portal-sigma-swart.vercel.app/training'],
    ['FPS 識別碼', '102866183'],
    ['FPS 戶口名稱', 'SCOUT ASSOCIATION OF HONG KONG - SHAU KEI WAN DISTRICT'],
    ['區會網址', 'www.skwscout.org.hk'],
    ['區會批准', ''],
  ];
  const st = { rev: 0, savedAt: '', by: '', sheets: {} };
  st.sheets[TAB.IN1] = IN1; st.sheets[TAB.IN2] = IN2;
  st.sheets[TAB.PARAM] = PARAM;
  st.sheets[TAB.IN3] = IN3; st.sheets[TAB.IN4] = IN4;
  st.sheets[TAB.RESP] = [RESP_HEADERS.slice()];
  st.sheets[TAB.NOTICE] = mockGrid(48, 8);
  st.sheets[TAB.ATTEND] = mockGrid(64, 16);
  st.sheets[TAB.COMPLETE] = mockGrid(46, 8);
  st.sheets[TAB.CERT] = mockGrid(44, 8);
  return st;
}

/* ── 狀態存取（demo 主班 + CL 起表嘅新班 registry） ── */
let MOCK_STATE = null;
let MOCK_CUR = { key: null, state: null };   /* 當次 call 緊嘅課程（新班 persist 用） */
function mockCourses() {
  try { return JSON.parse(localStorage.getItem(LS.mockCourses) || '{}') || {}; } catch (e) { return {}; }
}
function mockSaveCourses(reg) {
  try { localStorage.setItem(LS.mockCourses, JSON.stringify(reg)); } catch (e) { /* 忽略 */ }
}
function mockResolveState(apiKey) {
  const k = String(apiKey || '');
  if (k && k !== MOCK_API_KEY) {
    const reg = mockCourses();
    if (reg[k]) return reg[k];
  }
  return mockLoad();
}
function mockLoad() {
  if (MOCK_STATE) return MOCK_STATE;
  try {
    const s = localStorage.getItem(LS.mock);
    if (s) { MOCK_STATE = JSON.parse(s); mockMigrate(MOCK_STATE); return MOCK_STATE; }
  } catch (e) { /* 忽略 */ }
  MOCK_STATE = mockSeedState();
  mockPersist();
  return MOCK_STATE;
}
function mockPersist() {
  try {
    if (MOCK_CUR.key && MOCK_CUR.state) {
      const reg = mockCourses();
      reg[MOCK_CUR.key] = MOCK_CUR.state;
      localStorage.setItem(LS.mockCourses, JSON.stringify(reg));
    } else localStorage.setItem(LS.mock, JSON.stringify(mockLoad()));
  } catch (e) { /* 忽略 */ }
}
function mockReset() {
  MOCK_STATE = mockSeedState(); MOCK_CUR = { key: null, state: null };
  mockSaveCourses({});
  mockPersist();
}

/* ── 公式模擬（dump時計算值） ── */
function mockDumpResp(state) {
  const src = state.sheets[TAB.RESP];
  const out = src.map((r) => r.slice());
  let tick = 0;
  for (let i = 1; i < out.length; i++) {
    const troop = String(out[i][RC['旅團'] - 1] || '');
    out[i][RC['旅號'] - 1] = (troop.match(/\d+/) || [''])[0];
    if (out[i][RC['接納'] - 1] === '✔') { tick++; out[i][RC['學員編號'] - 1] = tick; }
    else out[i][RC['學員編號'] - 1] = '';
  }
  return out;
}
function mockDumpIn2(state) {
  const src = state.sheets[TAB.IN2];
  const out = src.map((r) => r.slice());
  IN2_SESSIONS.rows.forEach((r) => {
    const d = normDate(out[r - 1][IN2_SESSIONS.date - 1]);
    out[r - 1][IN2_SESSIONS.autoCN - 1] = d ? fmtCNDate(d) : '';
  });
  return out;
}

function mockOk(d) { return { ok: true, data: d }; }
function mockErr(m) { return { ok: false, error: m }; }
function mockAuth(b) {
  const k = String((b && b.apiKey) || '');
  if (k === MOCK_API_KEY) return null;
  if (k && mockCourses()[k]) return null;
  return mockErr('Unauthorized: invalid or missing apiKey');
}
function mockDelay() {
  return new Promise((res) => setTimeout(res, 220 + Math.floor(Math.random() * 260)));
}
function mockBumpRev(state, by) {
  state.rev = (Number(state.rev) || 0) + 1;
  state.savedAt = new Date().toISOString();
  state.by = String(by || '');
}
function mockConflict(state) {
  return {
    ok: false, conflict: true,
    rev: state.rev, savedAt: state.savedAt, by: state.by,
    error: '有人快咗一步改過（' + (state.by || '另一職員') + (state.savedAt ? '，' + state.savedAt : '') +
      '），請重讀最新再儲存（你今次乜都冇寫入）',
  };
}
function mockCheckBaseRev(state, baseRev) {
  if (baseRev === undefined || baseRev === null || baseRev === '') return null;
  if (Number(baseRev) !== Number(state.rev)) return mockConflict(state);
  return null;
}

/* ── 合約實作 ── */
const MockAPI = {
  call: async function (action, b) {
    await mockDelay();
    const isNewCourse = !!(b && b.apiKey && b.apiKey !== MOCK_API_KEY && mockCourses()[b.apiKey]);
    MOCK_CUR = isNewCourse ? { key: b.apiKey, state: mockCourses()[b.apiKey] } : { key: null, state: null };
    const state = isNewCourse ? MOCK_CUR.state : mockLoad();
    const authFail = mockAuth(b);
    if (authFail && action !== 'getCourseProfile' && action !== 'createCourse') return authFail;
    if (action === 'createCourse') {
      /* 區級 CourseFactory 合約:CL 起表（copy 模版 → 新 apiKey → 空白模版） */
      const nm = String(b.courseName || '').trim();
      if (!nm) return mockErr('請填課程名稱');
      const key = 'ck_new_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const reg = mockCourses();
      reg[key] = mockBlankState(nm, b);
      mockSaveCourses(reg);
      return mockOk({
        exec: 'mock', apiKey: key, courseId: key, courseName: nm, firstLogin: true,
        url: 'https://docs.google.com/spreadsheets/d/mock-' + Date.now().toString(36),
      });
    }
    if (action === 'getCourseProfile') {
      /* 連線測試用：唔驗 key 都回基本料（方便手快貼錯都知） */
      const in2 = state.sheets[TAB.IN2];
      const staffRows = [];
      IN2_STAFF.rows.forEach((r) => {
        const role = String(shCell(in2, r, IN2_STAFF.role) || '').trim();
        const name = String(shCell(in2, r, IN2_STAFF.name) || '').trim();
        if (role && name) staffRows.push({ role, name });
      });
      return mockOk({
        courseName: String(shCell(in2, 1, 2) || '').trim() || '（未命名訓練班）',
        quota: shCell(in2, 4, 2), fee: shCell(in2, 5, 2),
        staff: staffRows,
        leader: staffRows.filter((s) => s.role === '班領導人')[0] || null,
        pulledAt: new Date().toISOString(),
      });
    }
    if (action === 'auth') return mockPwAuth(state, b);
    if (action === 'setPassword') return mockPwSet(state, b);
    if (action === 'setPaymentCheck') return mockPaymentCheck(state, b);
    if (action === 'setCompletionRow') return mockSetCompletionRow(state, b);
    if (action === 'setCertRow') return mockSetCertRow(state, b);
    if (action === 'getCourseSheetRaw') {
      return mockOk({
        input01: state.sheets[TAB.IN1], input02: mockDumpIn2(state),
        input03: state.sheets[TAB.IN3], input04: state.sheets[TAB.IN4],
        resp: mockDumpResp(state),
        paramsWX: Array.isArray(state.sheets[TAB.PARAM]) && state.sheets[TAB.PARAM].length
          ? state.sheets[TAB.PARAM]
          : [
              ['區會常數（唔好改名）', ''],
              ['成員系統報名網址', 'https://member-portal-sigma-swart.vercel.app/training'],
              ['FPS 識別碼', '102866183'],
              ['FPS 戶口名稱', 'SCOUT ASSOCIATION OF HONG KONG - SHAU KEI WAN DISTRICT'],
              ['區會網址', 'www.skwscout.org.hk'],
            ],
        notice: state.sheets[TAB.NOTICE],
        attend: state.sheets[TAB.ATTEND] || [],
        accept: [], finance: [], completion: state.sheets[TAB.COMPLETE], cert: state.sheets[TAB.CERT], subsidy: [],
        pulledAt: new Date().toISOString(),
        rev: state.rev, revSavedAt: state.savedAt, revBy: state.by,
      });
    }
    if (action === 'listRegs') {
      const rows = mockDumpResp(state);
      const out = [];
      for (let i = 1; i < rows.length; i++) {
        const o = {}; rows[0].forEach((h, j) => { o[h] = rows[i][j]; });
        out.push({
          id: String(o['時間戳記'] || ''), refCode: o['_ref'] || '',
          nameZh: o['中文姓名'], nameEn: o['英文姓名'], phone: o['聯絡電話'], email: o['電郵地址'],
          troop: o['旅團'], receiptUrl: o['已繳付訓練班費用截圖'],
          status: String(o['審批狀態'] || 'pending').toLowerCase(),
          reviewer: o['批核人'] || '', reviewedAt: o['批核時間'] || '',
        });
      }
      return mockOk(out.reverse());
    }
    if (action === 'setRegStatus') {
      const status = String(b.status || '').toLowerCase();
      if (['pending', 'approved', 'rejected', 'cancelled'].indexOf(status) < 0) return mockErr('狀態不正確');
      const resp = state.sheets[TAB.RESP];
      let idx = -1;
      for (let i = 1; i < resp.length; i++) {
        if (String(resp[i][RC_ID - 1]).trim() === String(b.id).trim()) { idx = i; break; }
      }
      if (idx < 0) return mockErr('找不到該報名');
      resp[idx][RC_STATUS - 1] = status;
      resp[idx][RC_REVIEWER - 1] = b.reviewer || '';
      resp[idx][RC_REVIEWED_AT - 1] = new Date().toISOString();
      resp[idx][RC_ACCEPT - 1] = status === 'approved' ? '✔' : ((status === 'rejected' || status === 'cancelled') ? '✗' : '');
      mockPersist();
      return mockOk({ saved: true, id: b.id, status: status });
    }
    if (action === 'addReg') {
      if (!b.nameZh || !b.phone || !b.email) return mockErr('資料不完整');
      if (!b.receiptDataUrl) return mockErr('請上傳入數紙截圖。未繳費將不獲處理申請');
      const resp = state.sheets[TAB.RESP];
      for (let i = 1; i < resp.length; i++) {
        if (String(resp[i][RC['電郵地址'] - 1]).toLowerCase() === String(b.email).toLowerCase()
          && String(resp[i][RC_STATUS - 1]) !== 'cancelled') return mockErr('此電郵已報名，請勿重複提交。');
      }
      const ref = 'CRS-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 9000 + 1000);
      const row = new Array(RESP_HEADERS.length).fill('');
      const put = (h, v) => { row[RC[h] - 1] = v; };
      put('時間戳記', new Date().toISOString()); put('電郵地址', b.email); put('中文姓名', b.nameZh);
      put('英文姓名', b.nameEn || ''); put('聯絡電話', b.phone); put('性別', b.gender || '');
      put('出生日期', b.dob || ''); put('所屬童軍區', b.scoutDistrict || '筲箕灣'); put('旅團', b.troop || '');
      put('付款方式', b.payMethod || 'FPS'); put('審批狀態', 'pending');
      put('已繳付訓練班費用截圖', 'https://drive.google.com/file/d/demo-' + encodeURIComponent(b.nameZh) + '/view');
      put('_ref', ref); put('_courseId', 'demo-course'); put('_courseTitle', '攝影專科徽章訓練班');
      resp.push(row); mockPersist();
      return { ok: true, refCode: ref };
    }
    if (action === 'setCourseCells') return mockBatchWrite(state, { cells: b.cells, baseRev: b.baseRev, by: b.by });
    if (action === 'saveCourseBatch') return mockBatchWrite(state, b);
    if (action === 'addExpenseRow') {
      const in4 = state.sheets[TAB.IN4];
      const cols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      const amounts = b.amounts || {};
      const has = cols.some((L) => amounts[L] !== undefined && String(amounts[L]).trim() !== '') ||
        (b.note !== undefined && String(b.note).trim() !== '');
      if (!has) return mockErr('amounts／note 至少填一樣');
      for (let r = 8; r <= 42; r++) {
        let empty = true;
        for (let c = 2; c <= 10; c++) if (String(in4[r - 1][c - 1] || '').trim() !== '') { empty = false; break; }
        if (empty) {
          cols.forEach((L) => {
            if (amounts[L] !== undefined && String(amounts[L]).trim() !== '') in4[r - 1][L.charCodeAt(0) - 65] = amounts[L];
          });
          if (b.note !== undefined && String(b.note).trim() !== '') in4[r - 1][10] = b.note;
          mockPersist();
          return mockOk({ added: true, row: r, receiptNo: String(in4[r - 1][0] || ''), rev: state.rev, savedAt: new Date().toISOString() });
        }
      }
      return mockErr('支出表已滿（35 行收據用晒）');
    }
    return mockErr('未知的 action: ' + action);
  },
};

/* ── coursev5 密碼系統（同 Auth.gs 合約一致） ──
 * 每班第一次登入 1234（firstLogin）→ 提示改密碼；
 * 密碼格輸入「帳號:密碼」= 後備管理員登入（真後備帳號只寫喺 GS Auth.gs，mock 用 MockDemo.setAdmin 設定嚟測試） */
const MOCK_BACKEND_V = '5.0.0';
function mockPwAuth(state, b) {
  const a = state.auth || (state.auth = { fails: 0, lockUntil: 0 });
  if (Date.now() < (a.lockUntil || 0)) {
    return mockErr('嘗試次數太多，請 ' + Math.ceil((a.lockUntil - Date.now()) / 60000) + ' 分鐘後再試');
  }
  const pw = String(b.password == null ? '' : b.password);
  if (pw.indexOf(':') >= 0) {
    const i = pw.indexOf(':');
    const adm = state.admin;
    if (adm && pw.slice(0, i) === adm.user && pw.slice(i + 1) === adm.pw) {
      return mockOk({ role: 'admin', firstLogin: false, v: MOCK_BACKEND_V });
    }
    return mockPwFail(state, a);
  }
  const cur = state.pw ? String(state.pw.current) : '1234';
  if (pw !== cur) return mockPwFail(state, a);
  a.fails = 0;
  return mockOk({ role: 'staff', firstLogin: !(state.pw && state.pw.changed), v: MOCK_BACKEND_V });
}
function mockPwFail(state, a) {
  a.fails = (a.fails || 0) + 1;
  let out;
  if (a.fails >= 5) { a.lockUntil = Date.now() + 10 * 60 * 1000; a.fails = 0; out = mockErr('密碼錯誤。試得太多，已鎖 10 分鐘'); }
  else out = mockErr('密碼錯誤');
  mockPersist();
  return out;
}
function mockPwSet(state, b) {
  const a = state.auth || (state.auth = { fails: 0, lockUntil: 0 });
  if (Date.now() < (a.lockUntil || 0)) return mockErr('嘗試次數太多，請稍後再試');
  const oldPw = String(b.oldPassword == null ? '' : b.oldPassword);
  const newPw = String(b.newPassword == null ? '' : b.newPassword);
  let okOld = false;
  if (oldPw.indexOf(':') >= 0) {
    const i = oldPw.indexOf(':');
    const adm = state.admin;
    okOld = !!(adm && oldPw.slice(0, i) === adm.user && oldPw.slice(i + 1) === adm.pw);
  } else {
    okOld = oldPw === (state.pw ? String(state.pw.current) : '1234');
  }
  if (!okOld) return mockPwFail(state, a);
  if (newPw.length < 4) return mockErr('新密碼至少 4 位');
  if (newPw === '1234') return mockErr('新密碼唔可以係預設 1234');
  if (newPw.indexOf(':') >= 0) return mockErr('新密碼唔可以有「:」');
  state.pw = { current: newPw, changed: true };
  a.fails = 0; a.lockUntil = 0;
  mockPersist();
  return mockOk({ saved: true });
}

/* setCompletionRow / setCertRow（完成評核＋領取證書；bump rev，baseRev 可選） */
/* 用 dump 版（mockDumpResp 補 學員編號/旅號 公式值）搵學員 */
function mockFindReg(state, code, name) {
  const resp = mockDumpResp(state);
  for (let i = 1; i < resp.length; i++) {
    const no = String(resp[i][RC['學員編號'] - 1] || '');
    const nm = String(resp[i][RC['中文姓名'] - 1] || '');
    if ((code && no === String(code)) || (!code && name && nm === String(name))) return resp[i];
  }
  return null;
}
function mockSetCompletionRow(state, b) {
  const reg = mockFindReg(state, b.code, b.name);
  if (!reg) return mockErr('找不到該學員');
  const cf = mockCheckBaseRev(state, b.baseRev);
  if (cf) return cf;
  const sheet = state.sheets[TAB.COMPLETE];
  let row = -1;
  for (let r = 10; r <= 42; r++) {
    if (String(sheet[r - 1][0] || '') === String(reg[RC['學員編號'] - 1] || '') && String(sheet[r - 1][1] || '') === reg[RC['中文姓名'] - 1]) { row = r; break; }
  }
  if (row < 0) {
    for (let r = 10; r <= 42; r++) if (!String(sheet[r - 1].join(''))) { row = r; break; }
    if (row < 0) return mockErr('完成報告已滿');
    mockSet(sheet, row, 1, reg[RC['學員編號'] - 1] || '');
    mockSet(sheet, row, 2, reg[RC['中文姓名'] - 1] || '');
    mockSet(sheet, row, 3, reg[RC['旅號'] - 1] || '');
  }
  if (b.certNo !== undefined) mockSet(sheet, row, 4, b.certNo);
  if (b.pass !== undefined) mockSet(sheet, row, 5, b.pass ? '合格' : '不合格');
  if (b.failReason !== undefined) mockSet(sheet, row, 6, b.failReason);
  mockBumpRev(state, b.by || '');
  mockPersist();
  return mockOk({ updated: true, row: row, rev: state.rev, savedAt: state.savedAt });
}
function mockSetCertRow(state, b) {
  const reg = mockFindReg(state, b.code, b.name);
  if (!reg) return mockErr('找不到該學員');
  const cf = mockCheckBaseRev(state, b.baseRev);
  if (cf) return cf;
  const sheet = state.sheets[TAB.CERT];
  let row = -1;
  for (let r = 7; r <= 42; r++) {
    if (String(sheet[r - 1][1] || '') === String(reg[RC['學員編號'] - 1] || '') && String(sheet[r - 1][2] || '') === reg[RC['中文姓名'] - 1]) { row = r; break; }
  }
  if (row < 0) {
    for (let r = 7; r <= 42; r++) if (!String(sheet[r - 1].join(''))) { row = r; break; }
    if (row < 0) return mockErr('領取證書紀錄已滿');
    mockSet(sheet, row, 2, reg[RC['學員編號'] - 1] || '');
    mockSet(sheet, row, 3, reg[RC['中文姓名'] - 1] || '');
    mockSet(sheet, row, 4, reg[RC['旅號'] - 1] || '');
  }
  if (b.certNo !== undefined) mockSet(sheet, row, 5, b.certNo);
  if (b.pickupDate !== undefined) mockSet(sheet, row, 6, b.pickupDate);
  if (b.signed !== undefined) mockSet(sheet, row, 7, b.signed);
  mockBumpRev(state, b.by || '');
  mockPersist();
  return mockOk({ updated: true, row: row, rev: state.rev, savedAt: state.savedAt });
}

/* setPaymentCheck（區管理系統核對收款用；同 setRegStatus 一樣 identity 定位、唔 bump rev） */
function mockPaymentCheck(state, b) {
  const resp = state.sheets[TAB.RESP];
  let idx = -1;
  for (let i = 1; i < resp.length; i++) {
    if (String(resp[i][RC_ID - 1]).trim() === String(b.id).trim()) { idx = i; break; }
  }
  if (idx < 0) return mockErr('找不到該報名');
  const ok = b.verified !== false;
  resp[idx][RC['已核對收款'] - 1] = ok ? '✔' : '';
  resp[idx][RC['核對人'] - 1] = ok ? (b.by || '') : '';
  resp[idx][RC['核對時間'] - 1] = ok ? new Date().toISOString() : '';
  mockPersist();
  return mockOk({ saved: true, id: b.id, verified: ok });
}

/* saveCourseBatch 核心（setCourseCells 同一條路） */
function mockBatchWrite(state, b) {
  const cells = b.cells || [];
  if (!cells.length) return mockErr('冇嘢要存（cells 至少帶一樣）');
  if (cells.length > 1000) return mockErr('一次最多寫 1000 格');
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i] || {};
    const tab = String(c.tab || '');
    if (MOCK_WRITABLE_TABS.indexOf(tab) < 0) continue;
    const r = Number(c.row), col = Number(c.col);
    if (!r || !col || r < 1 || col < 1 || r > 500 || col > 60) return mockErr('格座標不正確（第 ' + (i + 1) + ' 格）');
  }
  const stale = mockCheckBaseRev(state, b.baseRev);
  if (stale) return stale;
  let updated = 0; const skipped = [];
  cells.forEach((c) => {
    const tab = String((c || {}).tab || '');
    if (MOCK_WRITABLE_TABS.indexOf(tab) < 0) { if (tab && skipped.indexOf(tab) < 0) skipped.push(tab); return; }
    const sh = state.sheets[tab];
    if (!sh) { if (skipped.indexOf(tab) < 0) skipped.push(tab); return; }
    const r = Number(c.row), col = Number(c.col);
    while (sh.length < r) sh.push(new Array(sh[0] ? sh[0].length : 30).fill(''));
    sh[r - 1][col - 1] = c.value === undefined ? '' : c.value;
    updated++;
  });
  mockBumpRev(state, b.by);
  mockPersist();
  return mockOk({ saved: true, updated: updated, skippedTabs: skipped, rev: state.rev, savedAt: state.savedAt });
}

/* ── 演示工具（唔屬 GAS 合約；設定頁用） ── */
/* 攞/寫指定班 state（CL 起表嘅新班用;唔帶 key = demo 主班） */
function mockCourseState(key) {
  if (!key) return { state: mockLoad(), save: mockPersist };
  const reg = mockCourses();
  if (!reg[key]) throw new Error('搵唔到呢個班（' + key + '）');
  return {
    state: reg[key],
    save: function () { const r2 = mockCourses(); r2[key] = reg[key]; mockSaveCourses(r2); },
  };
}

const MockDemo = {
  /* 模擬區管理層批核：tick 訓練班 GS 參數分頁「區會批准」格（CL 喺 APP 見到 ✔ 先出通告） */
  approveCourse: function (key) {
    const h = mockCourseState(key);
    const p = h.state.sheets[TAB.PARAM];
    for (let i = 0; i < p.length; i++) {
      if (String(p[i][0] || '').indexOf('區會批准') >= 0) { p[i][1] = '✔'; break; }
    }
    h.save();
  },
  /* 模擬另一職員儲存：bump rev＋改一格 → 觸發你部機嘅衝突偵測 */
  otherStaffSave: function () {
    const state = mockLoad();
    const in2 = state.sheets[TAB.IN2];
    const v = shCell(in2, 4, 2);
    mockSet(in2, 4, 2, String(v) === '24' ? 20 : 24); // 名額改動
    mockBumpRev(state, '李美芬（另一職員）');
    mockPersist();
    return { changed: 'Input02 名額 B4', rev: state.rev };
  },
  /* 模擬新報名（成員系統→Script addReg） */
  newReg: function (key) {
    const pool = [
      { nameZh: '馮樂瑤', nameEn: 'Fung Lok Yiu', gender: '女', troop: '港島第82旅' },
      { nameZh: '蔡卓霖', nameEn: 'Choey Cheuk Lam', gender: '男', troop: '港島第215旅' },
      { nameZh: '許靜怡', nameEn: 'Hui Ching Yi', gender: '女', troop: '港島第12旅' },
      { nameZh: '杜俊豪', nameEn: 'To Chun Ho', gender: '男', troop: '柴灣第10旅' },
    ];
    const p = pool[Math.floor(Math.random() * pool.length)];
    const h = mockCourseState(key);
    const state = h.state;
    const resp = state.sheets[TAB.RESP];
    const row = new Array(RESP_HEADERS.length).fill('');
    const put = (h, v) => { row[RC[h] - 1] = v; };
    const ts = new Date().toISOString();
    put('時間戳記', ts); put('電郵地址', 'demo.' + Date.now() + '@example.hk');
    put('中文姓名', p.nameZh); put('英文姓名', p.nameEn); put('性別', p.gender);
    put('出生日期', '2009-05-20'); put('聯絡電話', '61' + Math.floor(Math.random() * 9000000 + 1000000));
    put('所屬童軍區', '筲箕灣'); put('旅團', p.troop); put('童軍職位', '隊員');
    put('家長／監護人同意參與有關活動。', 'TRUE');
    put('所屬童軍旅領袖同意參與有關活動。', 'TRUE');
    put('付款方式', 'FPS'); put('審批狀態', 'pending');
    put('已繳付訓練班費用截圖', 'https://drive.google.com/file/d/demo-' + encodeURIComponent(p.nameZh) + '/view');
    put('_ref', 'CRS-' + ts.slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 9000 + 1000));
    put('_courseId', 'demo-course'); put('_courseTitle', '攝影專科徽章訓練班');
    resp.push(row); h.save();
    return { name: p.nameZh, ts };
  },
  reset: mockReset,
  /* 模擬區管理系統核對收款（tick 下一筆未核對嘅待批報名） */
  paymentCheck: function () {
    const state = mockLoad();
    const resp = state.sheets[TAB.RESP];
    for (let i = 1; i < resp.length; i++) {
      if (String(resp[i][RC_STATUS - 1]) === 'pending' && String(resp[i][RC['已核對收款'] - 1] || '') !== '✔') {
        resp[i][RC['已核對收款'] - 1] = '✔';
        resp[i][RC['核對人'] - 1] = '區會財務（演示）';
        resp[i][RC['核對時間'] - 1] = new Date().toISOString();
        mockPersist();
        return { name: String(resp[i][RC['中文姓名'] - 1] || ''), ts: String(resp[i][RC_ID - 1]) };
      }
    }
    return null;
  },
  /* 設定 mock 管理員帳號（測試「帳號:密碼」登入用；真後備帳號只寫喺 GS Auth.gs） */
  setAdmin: function (user, pw) { const s = mockLoad(); s.admin = { user: user, pw: pw }; mockPersist(); },
  /* 重設密碼狀態（等於 GS 刪 COURSE_PW_HASH → 回復 1234） */
  resetPw: function () { const s = mockLoad(); s.pw = { current: '1234', changed: false }; s.auth = { fails: 0, lockUntil: 0 }; mockPersist(); },
};
