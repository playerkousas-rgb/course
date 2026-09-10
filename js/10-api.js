/* ============================================================
 * 10-api.js — GAS 客戶端
 * 用 text/plain POST（唔觸發 CORS preflight；Apps Script doPost 讀 e.postData.contents）
 * 錯誤統一正規化做 {ok:false,error,conflict?,rev?,by?,savedAt?}
 * ============================================================ */

function apiNormalizeError(data) {
  if (!data) return { ok: false, error: '後台冇回應' };
  if (data.ok === false && /invalid or missing apiKey/i.test(String(data.error || ''))) {
    return Object.assign({}, data, { error: 'API Key 不正確——請喺「設定」重新輸入，或同 ADC 確認最新 Key' });
  }
  return data;
}

async function apiCall(action, payload) {
  payload = payload || {};
  const course = Store.activeCourse();
  if (!course) return { ok: false, error: '未連線' };

  /* 演示模式 → mock 後端（同一合約） */
  if (course.mock) {
    try {
      return await MockAPI.call(action, Object.assign({ apiKey: MOCK_API_KEY }, payload));
    } catch (e) {
      return { ok: false, error: '演示後台錯誤：' + (e && e.message) };
    }
  }

  const body = Object.assign({ action: action }, payload);
  body.apiKey = course.key;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let resp;
  try {
    resp = await fetch(course.exec, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: '連線失敗——請檢查網絡，或 /exec 網址係咪正確（部署存取權要設「任何人」）' };
  }
  clearTimeout(timer);

  let data;
  try {
    data = await resp.json();
  } catch (e) {
    return { ok: false, error: '後台回應格式不正確——請確認已部署為網頁應用程式（執行身分：我自己；存取：任何人）' };
  }
  return apiNormalizeError(data);
}

/* 便捷封裝 */
const api = {
  raw: () => apiCall('getCourseSheetRaw', {}),
  profile: () => apiCall('getCourseProfile', {}),
  listRegs: () => apiCall('listRegs', {}),
  setRegStatus: (id, status, reviewer) => apiCall('setRegStatus', { id, status, reviewer }),
  batch: (cells, baseRev, by) => apiCall('saveCourseBatch', { cells, baseRev, by }),
  auth: (password) => apiCall('auth', { password: password }),
  setPassword: (oldPassword, newPassword) => apiCall('setPassword', { oldPassword: oldPassword, newPassword: newPassword }),
};
