/**
 * CourseFactory.gs — 區級「開班工廠」（獨立 Apps Script 專案，部署一次）
 *
 * 用途：取代舊版 CS 起表工序——CL 喺 APP「🆕 新開班」填基本資料，
 *       本 Script 用自己嘅 Drive 權限 copy 開班文件模版、預填資料、
 *       產 apiKey，回傳俾 APP 直接連線。CL 唔使係區管理層、唔使有 Drive 權限。
 * 之後區管理層照舊流程：連結 GS → 睇「開班審核摘要」→ 一鍵批核掛載通告（成員系統報名）。
 *
 * ── 部署（區管理層做一次）──
 * 1. 新增獨立 Apps Script 專案，貼入本檔
 * 2. Script Properties 設定：
 *      FACTORY_KEY_HASH = SHA-256(開班碼)          ← 開班碼只發俾 CL（季度更換）
 *      TEMPLATE_FILE_ID = 開班文件模版 GS 檔 id     ← Drive「開班文件_Template」夾入面嗰張
 *      FOLDER_ID        = 開班文件存放夾 id         ← 例：2026-27 開班文件
 *      COURSE_API_EXEC  = 逐班 API 嘅 /exec 網址    ← coursev5 課程 Script 部署後嘅網址（見下）
 * 3. 部署為網頁應用程式（執行身分：我自己；存取：任何人）
 * 4. 將本廠 /exec 網址＋開班碼交俾 CL（APP「🆕 新開班 → 🏛 連區會起表」用）
 *
 * ── apiKey bootstrap（配合 coursev5 課程 Script）──
 * 模版 GS 連 bound script 一齊 copy，但 Script Properties 唔會跟住 copy。
 * 所以本廠將新 apiKey 寫入新 GS 嘅 _Sync!A5；課程 Script（v5.1+）喺每次請求前
 * ensureApiKey()：見 A5 有 key 就 SHA-256 存入 Script Properties 然後清除 A5。
 * （課程 Script 加呢段就得，見 COURSEV5-UPGRADE.md「CL 起表」章）
 *
 * ── 多班共用 API 選項（可選，規模大啲先做）──
 * 如果唔想逐班部署，可以將本廠擴充做共用 Course API：
 * registry 記 {apiKey → fileId}，所有 action 用 SpreadsheetApp.openById(fileId) 行
 * Code.gs.course.js 同一套 router。CL 完全唔使掂部署。
 */

/* ── 設定（可以用 Script Properties 覆蓋，方便改模版唔使改 code） ── */
function factoryProps() {
  const p = PropertiesService.getScriptProperties();
  return {
    keyHash: p.getProperty('FACTORY_KEY_HASH') || '',
    templateId: p.getProperty('TEMPLATE_FILE_ID') || '',
    folderId: p.getProperty('FOLDER_ID') || '',
    courseExec: p.getProperty('COURSE_API_EXEC') || '',
  };
}

function sha256hex(s) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s || ''), Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.action === 'createCourse') return jsonOut(createCourse(b));
    if (b.action === 'listCourses') return jsonOut(listCourses(b));
    return jsonOut({ ok: false, error: '未知 action：' + b.action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ── 起表 ── */
function createCourse(b) {
  const cfg = factoryProps();
  if (!cfg.keyHash || sha256hex(b.masterKey || '') !== cfg.keyHash) {
    return { ok: false, error: '開班碼不正確——請同區管理層確認' };
  }
  const nm = String(b.courseName || '').trim();
  if (!nm) return { ok: false, error: '請填課程名稱' };

  /* 1. copy 模版（連 bound 課程 Script 一齊 copy） */
  const tpl = DriveApp.getFileById(cfg.templateId);
  const folder = DriveApp.getFolderById(cfg.folderId);
  const file = tpl.makeCopy(nm + '（開班文件）', folder);
  const ss = SpreadsheetApp.openById(file.getId());

  /* 2. apiKey bootstrap：寫 _Sync!A5（課程 Script 首次接觸會 adopt＋rotate＋清除） */
  const apiKey = 'ck_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  const sync = ss.getSheetByName('_Sync') || ss.insertSheet('_Sync');
  sync.getRange('A5').setValue(apiKey);
  sync.hideSheet();

  /* 2.5 參數分頁預留「區會批准」格（區管理層批核寫,CL 喺 APP 只讀;通告 URL 係區管理系統內部嘢,唔喺呢度） */
  const param = ss.getSheetByName('參數');
  if (param) {
    const last = param.getLastRow();
    const labels = ['區會批准'];
    labels.forEach(function (t) {
      const found = param.createTextFinder(t).matchEntireCell(true).findNext();
      if (!found) param.getRange(last + 1, 1, 1, 2).setValues([[t, '']]);
    });
  }

  /* 3. 預填 CL 喺 APP 填嘅基本資料（Input01 B1-B13 + Input02 班領導人） */
  const in1 = ss.getSheetByName('Input01 預算');
  if (in1) {
    in1.getRange('B1').setValue(nm);
    if (b.edition) in1.getRange('B4').setValue(Number(b.edition) || b.edition);
    if (b.section) in1.getRange('B5').setValue(b.section);
    if (b.badge) in1.getRange('B6').setValue(b.badge);
    in1.getRange('B8').setValue('訓練班');
    if (b.intake) in1.getRange('B11').setValue(Number(b.intake) || 0);
    if (b.fee) in1.getRange('B12').setValue(Number(b.fee) || 0);
  }
  const in2 = ss.getSheetByName('Input02 班資料');
  if (in2) {
    in2.getRange('B1').setValue(nm);
    if (b.intake) in2.getRange('B4').setValue(Number(b.intake) || 0);
    if (b.fee) in2.getRange('B5').setValue(Number(b.fee) || 0);
    if (b.clName) {
      in2.getRange('A23').setValue('班領導人');
      in2.getRange('B23').setValue(b.clName);
      if (b.clTitle) in2.getRange('C23').setValue(b.clTitle);
    }
  }

  /* 4. 註冊（區管理層 listCourses 對帳／日後掛載用） */
  const props = PropertiesService.getScriptProperties();
  const reg = JSON.parse(props.getProperty('COURSES_REGISTRY') || '{}');
  reg[apiKey] = {
    fileId: file.getId(), name: nm, url: file.getUrl(),
    cl: String(b.clName || ''), createdAt: new Date().toISOString(),
  };
  props.setProperty('COURSES_REGISTRY', JSON.stringify(reg));

  /* 5. 回傳：APP 用 courseExec + apiKey即刻連線（首次密碼 1234） */
  return {
    ok: true,
    data: {
      exec: cfg.courseExec, apiKey: apiKey, courseId: file.getId(),
      courseName: nm, url: file.getUrl(), firstLogin: true,
    },
  };
}

/* ── 區管理層：列已起嘅班（驗開班碼） ── */
function listCourses(b) {
  const cfg = factoryProps();
  if (!cfg.keyHash || sha256hex(b.masterKey || '') !== cfg.keyHash) {
    return { ok: false, error: '開班碼不正確' };
  }
  const reg = JSON.parse(PropertiesService.getScriptProperties().getProperty('COURSES_REGISTRY') || '{}');
  return { ok: true, data: { courses: Object.keys(reg).map(function (k) { return reg[k]; }) } };
}
