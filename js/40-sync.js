/* ============================================================
 * 40-sync.js — 同步引擎（防呆核心）
 *  - 定期 getCourseSheetRaw（rev + 全文），暫停於分頁隱藏／儲存中
 *  - 儲存：草稿一次過 saveCourseBatch（帶 baseRev 樂觀鎖）
 *  - 衝突：重新讀取 → 非重疊自動合併重試；同一格先彈對話框
 * ============================================================ */

const Sync = {
  timer: null,
  inflight: false,
  saving: false,
  lastState: 'idle',   // idle | ok | syncing | error
  lastError: '',
  lastFetchAt: '',

  start: function () {
    this.stop();
    const ms = (Store.config && Store.config.pollMs) || APP_INFO.pollMs;
    this.timer = setInterval(() => this.tick(), Math.min(ms, 60000));
  },
  stop: function () { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
  tick: function () {
    if (typeof document !== 'undefined' && document.hidden) return;   // 慳 quota：唔喺前面唔同步
    if (this.inflight || this.saving) return;
    this.refresh('poll');
  },

  setIndicator: function (state) {
    this.lastState = state;
    if (typeof UI !== 'undefined' && UI.updateSyncIndicator) UI.updateSyncIndicator();
  },

  refresh: async function (reason) {
    if (!Store.activeCourse() || !Store.isUnlocked()) return { ok: false };
    if (this.inflight) return { ok: false, busy: true };
    this.inflight = true;
    this.setIndicator('syncing');
    const res = await apiCall('getCourseSheetRaw', {});
    if (res && res.ok) {
      const info = Store.applyRaw(res.data);
      this.lastError = '';
      this.lastFetchAt = new Date().toISOString();
      this.setIndicator('ok');

      if (info.revChanged && info.revBy && reason !== 'save' && reason !== 'conflict' && reason !== 'boot') {
        if (typeof toast === 'function') toast('📊 ' + info.revBy + ' 儲存咗修訂（rev ' + info.rev + '），已為你同步', 'info');
      }
      (info.newRegs || []).forEach((n) => { if (typeof toast === 'function') toast('📥 新報名：' + n, 'info'); });

      /* 草稿體檢：同值取消／撞格警示 */
      const r = Store.resolveAgainstFresh();
      if (r.drop.length) {
        Store.clearDrafts(r.drop.map(d => d.key));
        if (typeof toast === 'function') toast('✅ ' + r.drop.length + ' 項草稿已有同樣改動（其他職員做咗），自動取消', 'info');
      }
      if (typeof UI !== 'undefined' && UI.setConflictBanner) UI.setConflictBanner(r.conflict.length);
      if (typeof UI !== 'undefined' && UI.rerenderPage && reason !== 'silent') UI.rerenderPage();
      this.inflight = false;
      return { ok: true, info: info };
    }
    this.lastError = (res && res.error) || '未知錯誤';
    this.setIndicator('error');
    if (reason === 'manual' && typeof toast === 'function') toast('⚠️ 同步失敗：' + this.lastError, 'err');
    this.inflight = false;
    return { ok: false, error: this.lastError };
  },

  /* 儲存全部草稿（衝突自動合併；同一格先問人） */
  saveAll: async function () {
    if (this.saving || !Store.draftCount()) return;
    const staff = Store.staffName() || '未知職員';
    this.saving = true;
    this.setIndicator('syncing');
    if (typeof UI !== 'undefined' && UI.setSaving) UI.setSaving(true);
    try {
      let attempt = 0;
      while (attempt < 4) {
        attempt++;
        const all = Store.drafts();
        if (!all.length) break;
        const built = Store.buildCellsPayload(all);
        /* reg 被刪等 missing 項 → 直接當衝突處理 */
        if (!built.cells.length) {
          if (typeof UI !== 'undefined' && UI.showConflictDialog) UI.showConflictDialog(built.missing, []);
          break;
        }
        const res = await apiCall('saveCourseBatch', {
          cells: built.cells, baseRev: Store.state.rev, by: staff,
        });
        if (res && res.ok) {
          Store.clearDrafts(all.map(d => d.key));
          Store.pushLog('save', '批次儲存 ' + built.cells.length + ' 格（rev ' + (res.data && res.data.rev) + '）');
          if (typeof toast === 'function') toast('💾 已儲存 ' + built.cells.length + ' 項修改', 'ok');
          await this.refresh('save');
          break;
        }
        if (res && res.conflict) {
          if (typeof toast === 'function') toast('⚠️ ' + (res.by || '另一職員') + ' 快咗一步——重新讀取最新資料…', 'warn');
          await this.refresh('conflict');
          const r = Store.resolveAgainstFresh();
          if (r.drop.length) Store.clearDrafts(r.drop.map(d => d.key));
          if (!r.conflict.length && r.keep.length) {
            continue;   /* 冇重疊 → 自動用新 rev 重試（自動合併） */
          }
          if (r.conflict.length) {
            if (typeof UI !== 'undefined' && UI.showConflictDialog) UI.showConflictDialog(r.conflict, r.keep);
            break;      /* 等用戶揀完，對話框會再行 saveAll */
          }
          if (!r.keep.length) break;  /* 冇嘢剩 */
          break;
        }
        /* 其他錯誤 */
        if (typeof toast === 'function') toast('❌ 儲存失敗：' + ((res && res.error) || '未知錯誤'), 'err');
        break;
      }
    } finally {
      this.saving = false;
      if (typeof UI !== 'undefined' && UI.setSaving) UI.setSaving(false);
      this.setIndicator(Store.state ? 'ok' : 'idle');
    }
  },
};
