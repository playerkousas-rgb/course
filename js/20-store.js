/* ============================================================
 * 20-store.js — 狀態倉庫（唔掂 DOM）
 *  - config：多班連線設定（localStorage）
 *  - state：最新 raw dump 經 parseAll 嘅視圖
 *  - drafts：未儲存草稿（分 fixed-cell / reg-field 兩種；
 *    reg-field 以報名 id 定位，唔怕有新報名插入令行號移位）
 *  防呆：草稿恆存本機；refresh 時自動偵測同其他人撞唔撞。
 * ============================================================ */

function lsGet(k, fallback) {
  try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); }
  catch (e) { return fallback; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
}
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ } }

function courseHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return 'c' + Math.abs(h).toString(36);
}

const Store = {
  config: null,
  state: null,          // parseAll 結果
  _drafts: new Map(),
  _prevRegIds: null,
  notify: null,         // UI 註冊：草稿變更回呼

  /* ── 設定 ── */
  init: function () {
    this.config = lsGet(LS.config, null) || { v: 1, password: APP_INFO.defaultPassword, pollMs: APP_INFO.pollMs, courses: [], activeId: null };
  },
  saveConfig: function () { lsSet(LS.config, this.config); },
  courses: function () { return (this.config && this.config.courses) || []; },
  activeCourse: function () {
    const id = this.config && this.config.activeId;
    return this.courses().filter(c => c.id === id)[0] || null;
  },
  addCourse: function (o) {
    const id = o.mock ? (o.id || 'demo') : courseHash((o.exec || '') + '|' + (o.key || ''));
    const existing = this.courses().filter(c => c.id === id)[0];
    if (existing) {
      existing.name = o.name || existing.name;
      existing.exec = o.exec || existing.exec;
      existing.key = o.key || existing.key;
      existing.gsUrl = o.gsUrl || existing.gsUrl;
      existing.directRegUrl = o.directRegUrl || existing.directRegUrl;
      existing.publicCourseId = o.publicCourseId || existing.publicCourseId;
    } else {
      this.config.courses.push({ id: id, name: o.name || '未命名訓練班', exec: o.exec || '', key: o.key || '', gsUrl: o.gsUrl || '', directRegUrl: o.directRegUrl || '', publicCourseId: o.publicCourseId || '', mock: !!o.mock, fresh: !!o.fresh, savedAt: new Date().toISOString() });
    }
    this.saveConfig();
    return id;
  },

  archiveCourse: function (id, archived) {
    const c = this.courses().filter(x => x.id === id)[0];
    if (!c) return false;
    if (archived === false) { delete c.archivedAt; c.archived = false; }
    else { c.archived = true; c.archivedAt = new Date().toISOString(); if (this.config.activeId === id) this.config.activeId = null; }
    this.saveConfig();
    return true;
  },

  removeCourse: function (id) {
    this.config.courses = this.courses().filter(c => c.id !== id);
    if (this.config.activeId === id) this.config.activeId = this.courses()[0] ? this.courses()[0].id : null;
    this.saveConfig();
    lsDel(LS.drafts(id)); lsDel(LS.oplog(id)); lsDel(LS.staff(id));
  },
  setActive: function (id) {
    this.config.activeId = id;
    this.saveConfig();
    this.state = null; this._drafts = new Map(); this._prevRegIds = null;
    this.loadDrafts();
  },

  /* ── 解鎖閘（純前端；session 級） ── */
  isUnlocked: function () {
    try { return sessionStorage.getItem(SS_UNLOCKED) === (this.config && this.config.activeId); }
    catch (e) { return false; }
  },
  setUnlocked: function () {
    try { sessionStorage.setItem(SS_UNLOCKED, this.config.activeId); } catch (e) { /* 忽略 */ }
  },
  lock: function () {
    try { sessionStorage.removeItem(SS_UNLOCKED); } catch (e) { /* 忽略 */ }
  },

  /* ── 職員身份 ── */
  staffName: function () {
    const c = this.activeCourse();
    return c ? (lsGet(LS.staff(c.id), '') || '') : '';
  },
  setStaffName: function (n) {
    const c = this.activeCourse();
    if (c) lsSet(LS.staff(c.id), String(n || '').trim());
  },

  /* ── FPS QR（只存本機，列印通告用） ── */
  qrData: function () { const c = this.activeCourse(); return c ? lsGet(LS.qr(c.id), '') : ''; },
  setQr: function (dataUrl) { const c = this.activeCourse(); if (c) lsSet(LS.qr(c.id), dataUrl); },

  /* ── raw 快照 ── */
  rawTab: function (name) {
    if (!this.state || !this.state.raw) return null;
    for (const k in RAW_TAB_MAP) {
      if (RAW_TAB_MAP[k] === name) return this.state.raw[k];
    }
    return null;
  },
  applyRaw: function (raw) {
    const prev = this.state;
    this.state = parseAll(raw);
    let newRegs = [];
    const ids = {};
    this.state.regs.forEach(r => { ids[r.id] = r.nameZh; });
    if (this._prevRegIds) {
      Object.keys(ids).forEach(id => { if (!(id in this._prevRegIds)) newRegs.push(ids[id]); });
    }
    this._prevRegIds = ids;
    return {
      revChanged: !prev || prev.rev !== this.state.rev,
      revBy: this.state.revBy, rev: this.state.rev,
      newRegs: newRegs,
    };
  },

  snapshotCell: function (tab, r, c) { return shCell(this.rawTab(tab), r, c); },

  /* ── 草稿 ── */
  draftKey: function (tab, r, c) { return 'cell|' + tab + '|' + r + '|' + c; },
  regDraftKey: function (regId, header) { return 'reg|' + regId + '|' + header; },
  draftAt: function (tab, r, c) { return this._drafts.get(this.draftKey(tab, r, c)) || null; },
  draftCount: function () { return this._drafts.size; },
  drafts: function () { return Array.from(this._drafts.values()); },

  effectiveCell: function (tab, r, c) {
    const d = this.draftAt(tab, r, c);
    return d ? d.value : this.snapshotCell(tab, r, c);
  },
  effectiveRegValue: function (reg, header) {
    if (!reg) return '';
    const d = this._drafts.get(this.regDraftKey(reg.id, header));
    return d ? d.value : (reg[header] == null ? '' : reg[header]);
  },

  addCellDraft: function (tab, r, c, value, label) {
    const snap = this.snapshotCell(tab, r, c);
    const key = this.draftKey(tab, r, c);
    if (normVal(value) === normVal(snap)) {
      this._drafts.delete(key);           // 改返同快照一樣 = 撤銷草稿
    } else {
      this._drafts.set(key, { key: key, kind: 'cell', tab: tab, row: r, col: c, value: value, baseValue: snap, label: label || (tab + ' R' + r + 'C' + c) });
    }
    this.persistDrafts();
    if (this.notify) this.notify();
  },
  addRegDraft: function (reg, header, value, label) {
    const cur = reg[header] == null ? '' : reg[header];
    const key = this.regDraftKey(reg.id, header);
    if (normVal(value) === normVal(cur)) {
      this._drafts.delete(key);
    } else {
      this._drafts.set(key, { key: key, kind: 'regField', regId: reg.id, header: header, value: value, baseValue: cur, label: label || (reg.nameZh + ' ' + header) });
    }
    this.persistDrafts();
    if (this.notify) this.notify();
  },
  removeDraft: function (key) { this._drafts.delete(key); this.persistDrafts(); if (this.notify) this.notify(); },
  clearDrafts: function (keys) {
    if (!keys) this._drafts.clear();
    else keys.forEach(k => this._drafts.delete(k));
    this.persistDrafts();
    if (this.notify) this.notify();
  },
  persistDrafts: function () {
    const c = this.activeCourse();
    if (c) lsSet(LS.drafts(c.id), this.drafts());
  },
  loadDrafts: function () {
    this._drafts = new Map();
    const c = this.activeCourse();
    if (!c) return;
    (lsGet(LS.drafts(c.id), []) || []).forEach(d => { if (d && d.key) this._drafts.set(d.key, d); });
  },

  /* 對新快照逐項草稿體檢：
     keep=可以照寫；drop=對方已做同樣改動；conflict=同一格俾人改咗第個值 */
  resolveAgainstFresh: function () {
    const keep = [], drop = [], conflict = [];
    this._drafts.forEach(d => {
      let fresh;
      if (d.kind === 'cell') fresh = this.snapshotCell(d.tab, d.row, d.col);
      else {
        const reg = this.state.regs.filter(r => r.id === d.regId)[0];
        if (!reg) { d.conflictInfo = '搵唔到該報名（可能已被刪除）'; conflict.push(d); return; }
        fresh = reg[d.header] == null ? '' : reg[d.header];
      }
      if (normVal(fresh) === normVal(d.value)) drop.push(d);
      else if (normVal(fresh) === normVal(d.baseValue)) keep.push(d);
      else { d.conflictInfo = '對方已改做「' + fresh + '」'; conflict.push(d); }
    });
    return { keep: keep, drop: drop, conflict: conflict };
  },

  /* 草稿 → saveCourseBatch cells（reg-field 用最新快照以 id 重新對行） */
  buildCellsPayload: function (list) {
    const cells = [], missing = [];
    list.forEach(d => {
      if (d.kind === 'cell') {
        cells.push({ tab: d.tab, row: d.row, col: d.col, value: d.value });
      } else {
        const reg = this.state.regs.filter(r => r.id === d.regId)[0];
        if (!reg) { missing.push(d); return; }
        const col = RC[d.header];
        if (!col) { missing.push(d); return; }
        cells.push({ tab: TAB.RESP, row: reg.__row, col: col, value: d.value });
      }
    });
    return { cells: cells, missing: missing };
  },

  /* ── 操作紀錄（本機） ── */
  pushLog: function (kind, summary) {
    const c = this.activeCourse();
    if (!c) return;
    const log = lsGet(LS.oplog(c.id), []) || [];
    log.unshift({ t: new Date().toISOString(), staff: this.staffName(), kind: kind, summary: summary });
    if (log.length > 200) log.length = 200;
    lsSet(LS.oplog(c.id), log);
  },
  logs: function () {
    const c = this.activeCourse();
    return c ? (lsGet(LS.oplog(c.id), []) || []) : [];
  },
};
