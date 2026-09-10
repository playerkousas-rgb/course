/*************************************************************
 * coursev5 · Auth 模組（v5.0.0）
 * 訓練班管理系統 — 共職員密碼（驗證／更改）＋後備管理員
 *
 * 安裝（詳見 apps-script/COURSEV5-UPGRADE.md）：
 *   1. 喺 GAS 專案「＋檔案」新增 Auth.gs，貼入本檔
 *   2. 喺 Code.gs.course.js 嘅 doPost 分發處（驗完 apiKey 之後）加兩行：
 *        case 'auth':        return doAuth_(msg);
 *        case 'setPassword': return doSetPassword_(msg);
 *   3. 部署 → 管理部署 → 編輯 → 新版本
 *   （if/else 寫法就用同等嘅兩句）
 *
 * 本檔完全自成一體：唔會改任何既有函式、分頁、Script Properties
 * 以外嘅嘢；舊版 action／成員系統 addReg 完全不受影響。
 *************************************************************/

var COURSEV5_VERSION = '5.0.0';

var AUTH5 = {
  DEFAULT_PW: '1234',        // 每班第一次登入密碼（提示改密碼）
  MIN_LEN: 4,
  MAX_FAIL: 5,
  LOCK_MINUTES: 10,
  ADMIN_USER: 'sheep',       // 後備管理員（只寫喺呢度，唔會喺前端／文件顯示）
  ADMIN_PW: '0728'
};

/* ── 工具 ── */
function auth5Sha256_(s) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    String(s == null ? '' : s), Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function auth5Out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
/* 課程密碼 hash；null = 未改過（仲係預設 1234） */
function auth5Hash_() {
  return PropertiesService.getScriptProperties().getProperty('COURSE_PW_HASH');
}
/* 錯誤次數／鎖（CacheService，最多 6 小時） */
function auth5FailState_() {
  var c = CacheService.getScriptCache();
  return {
    c: c,
    fails: Number(c.get('coursev5_auth_fails') || 0),
    locked: Date.now() < Number(c.get('coursev5_auth_lock') || 0)
  };
}
function auth5RecordFail_() {
  var st = auth5FailState_();
  var n = st.fails + 1;
  if (n >= AUTH5.MAX_FAIL) {
    st.c.put('coursev5_auth_lock', String(Date.now() + AUTH5.LOCK_MINUTES * 60 * 1000), 21600);
    st.c.remove('coursev5_auth_fails');
    return { ok: false, error: '密碼錯誤。試得太多，已鎖 ' + AUTH5.LOCK_MINUTES + ' 分鐘' };
  }
  st.c.put('coursev5_auth_fails', String(n), 21600);
  return { ok: false, error: '密碼錯誤' };
}
function auth5ClearFails_() {
  CacheService.getScriptCache().remove('coursev5_auth_fails');
}

/* ── action: auth ──
 * 入參：{ action:'auth', apiKey, password }
 * 密碼格輸入「帳號:密碼」= 後備管理員登入（role:'admin'，唔會提示改密碼）
 * 回應：{ ok:true, data:{ role:'staff'|'admin', firstLogin:bool, v:'5.0.0' } }
 *       firstLogin=true 表示仲用緊預設 1234 → 前端會提示即刻改密碼 */
function doAuth_(msg) {
  var st = auth5FailState_();
  if (st.locked) {
    return auth5Out_({ ok: false, error: '嘗試次數太多，請 ' + AUTH5.LOCK_MINUTES + ' 分鐘後再試' });
  }
  var pw = String(msg && msg.password != null ? msg.password : '');

  if (pw.indexOf(':') >= 0) {
    var i = pw.indexOf(':');
    if (pw.slice(0, i) === AUTH5.ADMIN_USER && pw.slice(i + 1) === AUTH5.ADMIN_PW) {
      auth5ClearFails_();
      return auth5Out_({ ok: true, data: { role: 'admin', firstLogin: false, v: COURSEV5_VERSION } });
    }
    return auth5Out_(auth5RecordFail_());
  }

  var hash = auth5Hash_();
  if (auth5Sha256_(pw) === (hash || auth5Sha256_(AUTH5.DEFAULT_PW))) {
    auth5ClearFails_();
    return auth5Out_({ ok: true, data: { role: 'staff', firstLogin: !hash, v: COURSEV5_VERSION } });
  }
  return auth5Out_(auth5RecordFail_());
}

/* ── action: setPassword ──
 * 入參：{ action:'setPassword', apiKey, oldPassword, newPassword }
 * oldPassword 可以係現時課程密碼，或者「帳號:密碼」（後備管理員幫班重設）
 * 規則：新密碼至少 4 位、唔可以係 1234、唔可以有「:」 */
function doSetPassword_(msg) {
  var st = auth5FailState_();
  if (st.locked) {
    return auth5Out_({ ok: false, error: '嘗試次數太多，請 ' + AUTH5.LOCK_MINUTES + ' 分鐘後再試' });
  }
  var oldPw = String(msg && msg.oldPassword != null ? msg.oldPassword : '');
  var newPw = String(msg && msg.newPassword != null ? msg.newPassword : '');

  var okOld = false;
  if (oldPw.indexOf(':') >= 0) {
    var i = oldPw.indexOf(':');
    okOld = (oldPw.slice(0, i) === AUTH5.ADMIN_USER && oldPw.slice(i + 1) === AUTH5.ADMIN_PW);
  } else {
    var hash = auth5Hash_();
    okOld = (auth5Sha256_(oldPw) === (hash || auth5Sha256_(AUTH5.DEFAULT_PW)));
  }
  if (!okOld) return auth5Out_(auth5RecordFail_());

  if (newPw.length < AUTH5.MIN_LEN) {
    return auth5Out_({ ok: false, error: '新密碼至少 ' + AUTH5.MIN_LEN + ' 位' });
  }
  if (newPw === AUTH5.DEFAULT_PW) {
    return auth5Out_({ ok: false, error: '新密碼唔可以係預設 1234' });
  }
  if (newPw.indexOf(':') >= 0) {
    return auth5Out_({ ok: false, error: '新密碼唔可以有「:」' });
  }

  PropertiesService.getScriptProperties().setProperty('COURSE_PW_HASH', auth5Sha256_(newPw));
  auth5ClearFails_();
  return auth5Out_({ ok: true, data: { saved: true } });
}

/* 重設密碼做預設（CL／ADC 喺 GAS 編輯器手動 run；或者喺專案刪 COURSE_PW_HASH） */
function resetCoursePassword() {
  PropertiesService.getScriptProperties().deleteProperty('COURSE_PW_HASH');
  CacheService.getScriptCache().remove('coursev5_auth_fails');
  CacheService.getScriptCache().remove('coursev5_auth_lock');
}
