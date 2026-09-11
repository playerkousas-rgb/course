/**
 * CourseFactory.gs — 區級「開班工廠」（獨立 Apps Script 專案，部署一次）
 *
 * 用途：取代舊版 CS 起表工序——CL 喺 APP「🆕 新開班」填基本資料，
 *       本 Script 用自己嘅 Drive 權限 copy 開班文件模版、預填資料、
 *       產 apiKey，回傳俾 APP 直接連線。CL 唔使係區管理層、唔使有 Drive 權限。
 * 之後區管理層照舊流程：連結 GS → 睇「開班審核摘要」→ 一鍵批核掛載通告（成員系統報名）。
 *
 * ── 最簡部署（區管理層只需要 SET 一張 Sheet）──
 * 1. 開一張「CourseFactory控制台」Google Sheet → 擴充功能 → Apps Script → 貼入本檔
 * 2. Sheet 入面建「設定」分頁，A欄/B欄填：
 *      模版GS檔案ID、開班文件資料夾ID、課程API網址、成員系統報名網址（可留空）、區管理電郵（可留空）
 *      開班碼／開班碼SHA256 可留空；留空即新開空白班唔需要開班碼。
 * 3. 部署為網頁應用程式（執行身分：我自己；存取：任何人）
 * 4. 將本廠 /exec 網址放入前端。之後日常只改 Sheet，不入 Script Properties。
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

/* ── 後台清理入口（只放 GS 後端；前端不顯示帳密） ── */
var FACTORY_ADMIN_USER = 'sheep';
var FACTORY_ADMIN_PW = '0728';

/* ── 設定：以「設定」Sheet 為主；Script Properties 只係進階覆蓋（可不用）。 ── */
var FACTORY_CONFIG_SHEET = '設定';
var FACTORY_REGISTRY_SHEET = '訓練班登記';

function factoryBook_() {
  try { return SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { return null; }
}

function factoryConfigFromSheet_() {
  var ss = factoryBook_();
  var out = {};
  if (!ss) return out;
  var sh = ss.getSheetByName(FACTORY_CONFIG_SHEET) || ss.getSheetByName('Factory設定') || ss.getSheetByName('Config');
  if (!sh) return out;
  var values = sh.getDataRange().getValues();
  var aliases = {
    '開班碼SHA256': 'keyHash', 'FACTORY_KEY_HASH': 'keyHash',
    '開班碼': 'plainKey', '管理碼': 'plainKey',
    '模版GS檔案ID': 'templateId', '模版檔案ID': 'templateId', 'TEMPLATE_FILE_ID': 'templateId',
    '開班文件資料夾ID': 'folderId', '存放資料夾ID': 'folderId', 'FOLDER_ID': 'folderId',
    '課程API網址': 'courseExec', 'Course API /exec': 'courseExec', 'COURSE_API_EXEC': 'courseExec',
    '區管理電郵': 'opsEmail', 'OPS_EMAIL': 'opsEmail',
    '成員系統報名網址': 'memberPortalUrl', 'MEMBER_PORTAL_URL': 'memberPortalUrl'
  };
  values.forEach(function (row) {
    var label = String(row[0] || '').trim();
    if (!label) return;
    var key = aliases[label] || label;
    out[key] = String(row[1] || '').trim();
  });
  if (!out.keyHash && out.plainKey) out.keyHash = sha256hex(out.plainKey);
  return out;
}

function factoryProps() {
  var p = PropertiesService.getScriptProperties();
  var s = factoryConfigFromSheet_();
  function v(prop, key) { return p.getProperty(prop) || s[key] || ''; }
  return {
    keyHash: v('FACTORY_KEY_HASH', 'keyHash'),          // 留空 = 不需要開班碼
    templateId: v('TEMPLATE_FILE_ID', 'templateId'),
    folderId: v('FOLDER_ID', 'folderId'),
    courseExec: v('COURSE_API_EXEC', 'courseExec'),
    opsEmail: v('OPS_EMAIL', 'opsEmail'),
    memberPortalUrl: v('MEMBER_PORTAL_URL', 'memberPortalUrl')
  };
}

function factoryRegistryHeaders_() {
  return ['API Key','公開課程ID','課程名稱','GS檔案ID','GS網址','Script /exec','直接報名連結','狀態','班領導人','建立時間'];
}
function factoryRegistrySheet_() {
  var ss = factoryBook_();
  if (!ss) return null;
  var sh = ss.getSheetByName(FACTORY_REGISTRY_SHEET);
  if (!sh) { sh = ss.insertSheet(FACTORY_REGISTRY_SHEET); sh.getRange(1, 1, 1, factoryRegistryHeaders_().length).setValues([factoryRegistryHeaders_()]); }
  return sh;
}
function factoryRegistryFromSheet_() {
  var sh = factoryRegistrySheet_();
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, factoryRegistryHeaders_().length).getValues();
  values.forEach(function (r) {
    var k = String(r[0] || '').trim();
    if (!k) return;
    out[k] = {
      publicCourseId: String(r[1] || ''), name: String(r[2] || ''), fileId: String(r[3] || ''),
      url: String(r[4] || ''), scriptExecUrl: String(r[5] || ''), exec: String(r[5] || ''),
      directRegUrl: String(r[6] || ''), status: String(r[7] || 'active'), cl: String(r[8] || ''), createdAt: String(r[9] || '')
    };
  });
  return out;
}
function factoryRegistry_() {
  var propReg = {};
  try { propReg = JSON.parse(PropertiesService.getScriptProperties().getProperty('COURSES_REGISTRY') || '{}'); } catch (e) { propReg = {}; }
  var sheetReg = factoryRegistryFromSheet_();
  Object.keys(sheetReg).forEach(function (k) { propReg[k] = sheetReg[k]; });
  return propReg;
}
function factorySaveRegistry_(apiKey, row) {
  var props = PropertiesService.getScriptProperties();
  var reg = {};
  try { reg = JSON.parse(props.getProperty('COURSES_REGISTRY') || '{}'); } catch (e) { reg = {}; }
  reg[apiKey] = row;
  props.setProperty('COURSES_REGISTRY', JSON.stringify(reg));
  var sh = factoryRegistrySheet_();
  if (sh) sh.appendRow([apiKey, row.publicCourseId || '', row.name || '', row.fileId || row.courseId || '', row.url || '', row.scriptExecUrl || row.exec || '', row.directRegUrl || '', row.status || 'active', row.cl || '', row.createdAt || '']);
}
function factoryDeleteRegistryRow_(found) {
  var sh = factoryRegistrySheet_();
  if (!sh || sh.getLastRow() < 2) return;
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, factoryRegistryHeaders_().length).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    var r = values[i];
    if (String(r[0]) === found.key || String(r[1]) === String(found.row.publicCourseId || '') || String(r[3]) === String(found.row.fileId || found.row.courseId || '')) {
      sh.deleteRow(i + 2);
    }
  }
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
    if (b.action === 'setParamLabel') return jsonOut(setParamLabel(b));
    if (b.action === 'connectCourseByPassword') return jsonOut(connectCourseByPassword(b));
    if (b.action === 'adminListCourses') return jsonOut(adminListCourses(b));
    if (b.action === 'adminDeleteCourse') return jsonOut(adminDeleteCourse(b));
    return jsonOut({ ok: false, error: '未知 action：' + b.action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ── 起表 ── */
function createCourse(b) {
  const cfg = factoryProps();
  if (cfg.keyHash && sha256hex(b.masterKey || '') !== cfg.keyHash) {
    return { ok: false, error: '開班授權碼不正確——請同區管理層確認' };
  }
  const nm = String(b.courseName || '').trim();
  if (!nm) return { ok: false, error: '請填課程名稱' };

  /* 1. copy 模版（連 bound 課程 Script 一齊 copy） */
  const tpl = DriveApp.getFileById(cfg.templateId);
  const folder = DriveApp.getFolderById(cfg.folderId);
  const file = tpl.makeCopy(nm + '（開班文件）', folder);
  if (cfg.opsEmail) {
    try { file.addEditor(cfg.opsEmail); } catch (e) { /* share 失敗唔阻止開班；區系統仍可 fallback /exec */ }
  }
  const ss = SpreadsheetApp.openById(file.getId());

  /* 2. apiKey bootstrap：寫 _Sync!A5（課程 Script 首次接觸會 adopt＋rotate＋清除） */
  const apiKey = 'ck_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  const publicCourseId = 'crs_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  const directRegUrl = cfg.memberPortalUrl
    ? cfg.memberPortalUrl + (cfg.memberPortalUrl.indexOf('?') >= 0 ? '&' : '?') + 'courseId=' + encodeURIComponent(publicCourseId)
    : '';
  const sync = ss.getSheetByName('_Sync') || ss.insertSheet('_Sync');
  sync.getRange('A5').setValue(apiKey);
  sync.hideSheet();

  /* 2.5 參數分頁預留「區會批准」＋「訓練班電郵」格
     （批准=區管理層批核寫,CL 喺 APP 只讀;電郵=管理層告知 CL 先填,通告查詢行用;
      通告 URL 係區管理系統內部嘢,唔喺呢度） */
  const param = ss.getSheetByName('參數');
  if (param) {
    const labels = [
      ['區會批准', ''],
      ['訓練班電郵', ''],
      ['公開課程ID', publicCourseId],
      ['成員系統直接報名連結', directRegUrl],
    ];
    labels.forEach(function (pair) {
      factorySetParam_(param, pair[0], pair[1]);
    });
  }

  /* 3. 預填 CL 喺 APP 填嘅基本資料（Input01 B1-B13 + Input02 班領導人） */
  const in1 = ss.getSheetByName('Input01 預算') || ss.getSheetByName('Input01 訓練班預算');
  if (in1) {
    in1.getRange('B1').setValue(nm);
    if (b.edition) in1.getRange('B4').setValue(Number(b.edition) || b.edition);
    if (b.section) in1.getRange('B5').setValue(b.section);
    if (b.badge) in1.getRange('B6').setValue(b.badge);
    in1.getRange('B8').setValue('訓練班');
    if (b.intake) in1.getRange('B11').setValue(Number(b.intake) || 0);
    if (b.fee) in1.getRange('B12').setValue(Number(b.fee) || 0);
  }
  const in2 = ss.getSheetByName('Input02 班資料') || ss.getSheetByName('Input02 訓練班資料');
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
  factorySaveRegistry_(apiKey, {
    fileId: file.getId(), name: nm, url: file.getUrl(),
    scriptExecUrl: cfg.courseExec, exec: cfg.courseExec,
    publicCourseId: publicCourseId, directRegUrl: directRegUrl,
    status: 'active', cl: String(b.clName || ''), createdAt: new Date().toISOString()
  });

  /* 5. 回傳：APP 用 courseExec + apiKey即刻連線（首次密碼 1234） */
  return {
    ok: true,
    data: {
      exec: cfg.courseExec, apiKey: apiKey, courseId: file.getId(), publicCourseId: publicCourseId, directRegUrl: directRegUrl,
      courseName: nm, url: file.getUrl(), firstLogin: true,
    },
  };
}

function factorySetParam_(param, label, value) {
  const last = Math.max(1, param.getLastRow());
  const found = param.createTextFinder(label).matchEntireCell(true).findNext();
  if (found) {
    if (value !== undefined && value !== '') param.getRange(found.getRow(), 2).setValue(value);
    return found.getRow();
  }
  param.getRange(last + 1, 1, 1, 2).setValues([[label, value || '']]);
  return last + 1;
}

/* 區管理系統需要補寫參數 label 時用（例如訓練班電郵、直接報名連結）。 */
function setParamLabel(b) {
  const cfg = factoryProps();
  if (cfg.keyHash && sha256hex(b.masterKey || '') !== cfg.keyHash) {
    return { ok: false, error: '管理碼不正確' };
  }
  const fileId = String(b.fileId || b.courseId || '').trim();
  const label = String(b.label || '').trim();
  if (!fileId || !label) return { ok: false, error: 'missing fileId/label' };
  const ss = SpreadsheetApp.openById(fileId);
  const param = ss.getSheetByName('參數') || ss.insertSheet('參數');
  const row = factorySetParam_(param, label, b.value == null ? '' : String(b.value));
  return { ok: true, data: { saved: true, row: row, label: label } };
}

/* 職員選班：用班密碼驗證後，才回傳該班 /exec + API Key。 */
function connectCourseByPassword(b) {
  const cfg = factoryProps();
  const reg = factoryRegistry_();
  const wanted = String(b.publicCourseId || b.courseId || b.id || '').trim();
  const password = String(b.password || '');
  if (!wanted) return { ok: false, error: 'missing courseId' };
  if (!password) return { ok: false, error: '請輸入本班密碼' };

  let apiKey = '', r = null;
  Object.keys(reg).some(function (k) {
    const x = reg[k] || {};
    if (String(x.publicCourseId || '') === wanted || String(x.fileId || x.courseId || '') === wanted || String(k) === wanted) {
      apiKey = k; r = x; return true;
    }
    return false;
  });
  if (!r || !apiKey) return { ok: false, error: '找不到該訓練班' };
  const exec = r.scriptExecUrl || r.exec || cfg.courseExec || '';
  if (!exec) return { ok: false, error: '該訓練班未設定 Script /exec' };

  const resp = UrlFetchApp.fetch(exec, {
    method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
    payload: JSON.stringify({ action: 'auth', apiKey: apiKey, password: password })
  });
  let data = {};
  try { data = JSON.parse(resp.getContentText() || '{}'); } catch (e) { data = {}; }
  if (!data.ok) return { ok: false, error: (data && data.error) || '密碼不正確／該班後端未支援密碼驗證' };
  return { ok: true, data: {
    apiKey: apiKey, key: apiKey,
    courseId: r.fileId || r.courseId || '', publicCourseId: r.publicCourseId || '',
    name: r.name || '', courseName: r.name || '',
    exec: exec, scriptExecUrl: exec,
    url: r.url || '', gsUrl: r.url || '',
    directRegUrl: r.directRegUrl || '', status: r.status || 'active',
    firstLogin: data.data && data.data.firstLogin
  } };
}


function factoryAdminOk_(b) {
  return String((b && (b.adminUser || b.user)) || '') === FACTORY_ADMIN_USER &&
    String((b && (b.adminPassword || b.password)) || '') === FACTORY_ADMIN_PW;
}
function factoryFindCourse_(reg, wanted) {
  wanted = String(wanted || '').trim();
  var out = { key: '', row: null };
  if (!wanted) return out;
  Object.keys(reg).some(function (k) {
    var r = reg[k] || {};
    if (String(k) === wanted || String(r.publicCourseId || '') === wanted || String(r.fileId || r.courseId || '') === wanted) {
      out.key = k; out.row = r; return true;
    }
    return false;
  });
  return out;
}

/* 隱藏後台：列出所有已開班，供刪走開錯班。 */
function adminListCourses(b) {
  if (!factoryAdminOk_(b)) return { ok: false, error: 'Unauthorized' };
  var cfg = factoryProps();
  var reg = factoryRegistry_();
  return { ok: true, data: { courses: Object.keys(reg).map(function (k) {
    var r = reg[k] || {};
    return {
      apiKey: k, key: k,
      courseId: r.fileId || r.courseId || '', publicCourseId: r.publicCourseId || '',
      name: r.name || '', courseName: r.name || '',
      exec: r.scriptExecUrl || r.exec || cfg.courseExec || '', scriptExecUrl: r.scriptExecUrl || r.exec || cfg.courseExec || '',
      url: r.url || '', gsUrl: r.url || '', directRegUrl: r.directRegUrl || '',
      status: r.status || 'active', cl: r.cl || '', createdAt: r.createdAt || ''
    };
  }) } };
}

/* 隱藏後台：刪登記；可選同時將開錯嘅 GS 移到 Drive 垃圾桶。 */
function adminDeleteCourse(b) {
  if (!factoryAdminOk_(b)) return { ok: false, error: 'Unauthorized' };
  var props = PropertiesService.getScriptProperties();
  var reg = factoryRegistry_();
  var found = factoryFindCourse_(reg, b.apiKey || b.key || b.publicCourseId || b.courseId || b.id);
  if (!found.key || !found.row) return { ok: false, error: '找不到該訓練班' };
  var r = found.row;
  var trashed = false, trashError = '';
  if (b.trashFile !== false && (r.fileId || r.courseId)) {
    try { DriveApp.getFileById(r.fileId || r.courseId).setTrashed(true); trashed = true; }
    catch (e) { trashError = String(e && e.message ? e.message : e); }
  }
  delete reg[found.key];
  props.setProperty('COURSES_REGISTRY', JSON.stringify(reg));
  factoryDeleteRegistryRow_(found);
  return { ok: true, data: { deleted: true, apiKey: found.key, name: r.name || '', trashed: trashed, trashError: trashError } };
}


/* ── 區管理層／職員：列已起嘅班。無管理碼時只回公開資料，不回 API Key／Script URL。 ── */
function listCourses(b) {
  const cfg = factoryProps();
  const canSeeSecrets = !!(cfg.keyHash && sha256hex(b.masterKey || '') === cfg.keyHash);
  const reg = factoryRegistry_();
  return { ok: true, data: { courses: Object.keys(reg).map(function (k) {
    const r = reg[k] || {};
    return {
      apiKey: canSeeSecrets ? k : '',
      key: canSeeSecrets ? k : '',
      courseId: canSeeSecrets ? (r.fileId || r.courseId || '') : (r.publicCourseId || ''),
      publicCourseId: r.publicCourseId || '',
      name: r.name || '',
      courseName: r.name || '',
      url: canSeeSecrets ? (r.url || '') : '',
      gsUrl: canSeeSecrets ? (r.url || '') : '',
      exec: canSeeSecrets ? (r.scriptExecUrl || r.exec || cfg.courseExec || '') : '',
      scriptExecUrl: canSeeSecrets ? (r.scriptExecUrl || r.exec || cfg.courseExec || '') : '',
      directRegUrl: r.directRegUrl || '',
      status: r.status || 'active',
      cl: r.cl || '',
      createdAt: r.createdAt || ''
    };
  }) } };
}
