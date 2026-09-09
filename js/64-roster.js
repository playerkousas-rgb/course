/* ============================================================
 * 64-roster.js — 取錄學員名單：分組・聯絡・CSV 匯出・列印
 * 分組寫入「表格回應」分組欄（草稿→💾 批次儲存，防撞）
 * ============================================================ */

regPage('roster', function (root) {
  const st = Store.state;
  if (!st) { root.appendChild(h('div', { class: 'card' }, '載入中…')); return; }

  const approved = st.regs.filter(r => r.status === 'approved')
    .sort((a, b) => {
      const na = Number(a.studentNo), nb = Number(b.studentNo);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      if (Number.isFinite(na)) return -1;
      if (Number.isFinite(nb)) return 1;
      return a.__row - b.__row;
    });

  if (!approved.length) {
    root.appendChild(h('div', { class: 'card empty' }, '仲未有取錄學員——去「收生」先做接納'));
    return;
  }

  const male = approved.filter(r => String(r['性別']).indexOf('男') >= 0).length;
  const female = approved.filter(r => String(r['性別']).indexOf('女') >= 0).length;
  const grouped = approved.filter(r => r.group).length;
  const needReceipt = approved.filter(r => String(r['是否需要收據'] || '') === '是').length;

  /* 自動分組（草稿） */
  function autoGroup() {
    const sel = h('select', { class: 'input' }, [2, 3, 4, 5, 6, 7, 8].map(n => h('option', { value: n }, n + ' 組')));
    const m = modal({ title: '🔀 自動分組', body: h('div', {},
      h('div', { class: 'row-sub' }, '按學員編號順序梅花間竹分組（只會產生草稿，撳💾先寫入；已有分組會被覆蓋）'),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '分組數目'), sel)),
      actions: [
        h('button', { class: 'btn', onclick: () => m.close() }, '取消'),
        h('button', { class: 'btn btn-primary', onclick: () => {
          const n = Number(sel.value);
          approved.forEach((r, i) => {
            Store.addRegDraft(r, '分組', GROUP_OPTIONS[i % n], r.nameZh + ' 分組');
          });
          m.close();
          toast('✅ 已產生 ' + approved.length + ' 個分組草稿——撳右上角 💾 儲存先寫入', 'ok');
          UI.rerenderPage();
        } }, '產生草稿'),
      ] });
  }

  /* CSV */
  function exportCSV() {
    const head = ['學員編號', '中文姓名', '英文姓名', '性別', '出生日期', '所屬童軍區', '旅團', '旅號', '聯絡電話', '家長電話', '家長電郵', '學員電郵', '分組', '需要收據'];
    const rows = approved.map(r => [
      r.studentNo, r.nameZh, r.nameEn, r['性別'], r['出生日期'], r['所屬童軍區'], r['旅團'], r.troopNo,
      r['聯絡電話'], r['家長/監護人聯絡電話'], r['家長/監護人聯絡電郵'], r['電郵地址'],
      Store.effectiveRegValue(r, '分組'), r['是否需要收據'],
    ]);
    const csv = '\uFEFF' + [head].concat(rows).map(row =>
      row.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: (st.info.name || '學員名單') + '—學員名單.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    toast('✅ CSV 已下載', 'ok');
  }

  root.appendChild(h('div', { class: 'page-head no-print' },
    h('div', { class: 'card-title' }, '👥 取錄學員（' + approved.length + '）'),
    h('div', { class: 'stat-row' },
      h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(male)), h('div', { class: 'stat-l' }, '男')),
      h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(female)), h('div', { class: 'stat-l' }, '女')),
      h('div', { class: 'stat ' + (grouped === approved.length ? 'green' : 'amber') }, h('div', { class: 'stat-n' }, grouped + '/' + approved.length), h('div', { class: 'stat-l' }, '已分組')),
      h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(needReceipt)), h('div', { class: 'stat-l' }, '需收據'))),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn btn-sm', onclick: autoGroup }, '🔀 自動分組'),
      h('button', { class: 'btn btn-sm', onclick: exportCSV }, '⬇ 匯出 CSV'),
      h('button', { class: 'btn btn-sm', onclick: () => window.print() }, '🖨️ 列印名單'))));

  const table = h('table', { class: 'data-table print-doc' },
    h('thead', null, h('tr', null,
      ['編號', '姓名', '性別', '旅團', '旅號', '聯絡電話', '家長電話', '電郵', '分組'].map(t => h('th', null, t)))),
    h('tbody', null, approved.map(r => {
      const groupSel = h('select', { class: 'input s' }, h('option', { value: '' }, '—'));
      GROUP_OPTIONS.forEach(g => groupSel.appendChild(h('option', { value: g }, g)));
      groupSel.value = String(Store.effectiveRegValue(r, '分組') || '');
      groupSel.addEventListener('change', () => {
        Store.addRegDraft(r, '分組', groupSel.value, r.nameZh + ' 分組');
        toast('✏️ ' + r.nameZh + ' 分組草稿：' + (groupSel.value || '（清空）') + '——撳💾 儲存');
      });
      return h('tr', null,
        h('td', { class: 'td-idx' }, esc(r.studentNo)),
        h('td', { class: 'td-strong' }, esc(r.nameZh)),
        h('td', null, esc(r['性別'] || '—')),
        h('td', null, esc(r['旅團'] || '—')),
        h('td', null, esc(r.troopNo || '—')),
        h('td', null, esc(r['聯絡電話'] || '—')),
        h('td', null, esc(r['家長/監護人聯絡電話'] || '—')),
        h('td', { class: 'td-small' }, esc(r['電郵地址'] || '—')),
        h('td', null, groupSel));
    })));
  root.appendChild(h('div', { class: 'card' }, h('div', { class: 'table-scroll' }, table)));
});
