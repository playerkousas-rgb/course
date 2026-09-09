/* ============================================================
 * 90-bootstrap.js — 啟動
 * 支援網址參數：?exec=…&key=…&name=…（區管理系統/CL 出職員連結，一按即入）
 * ============================================================ */

function boot() {
  Store.init();

  /* 網址參數 → 自動加/切換課程 */
  try {
    const q = new URLSearchParams(location.search);
    const exec = q.get('exec'), key = q.get('key'), name = q.get('name');
    if (exec && key) {
      const id = Store.addCourse({ exec: exec, key: key, name: name || '' });
      if (Store.config.activeId !== id) Store.setActive(id);
    }
  } catch (e) { /* 忽略 */ }

  UI.render();

  /* 有未儲存草稿時，閂頁前提醒 */
  window.addEventListener('beforeunload', (e) => {
    if (Store.activeCourse() && Store.isUnlocked() && Store.draftCount()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* 全域錯誤唔好靜靜死 */
  window.addEventListener('error', (e) => {
    console.error(e);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
