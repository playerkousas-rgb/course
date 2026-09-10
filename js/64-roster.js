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

  /* ── 取錄名單（放區網頁用；跟 Print_取錄名單 版面：兩欄 編號/姓名/旅別） ── */
  function admitList() {
    const items = approved.map(r => ({ no: r.studentNo, name: r.nameZh, troop: r['旅團'] || '—' }));
    const half = Math.ceil(items.length / 2);
    const left = items.slice(0, half), right = items.slice(half);
    const leader = (st.info && st.info.leader) || null;
    const notice = '請獲接納之學員按接納通知書上指示，準時到訓練班場地報到。如名單上沒有閣下之姓名，表示該申請未獲接納，本區會即時辦理退款並銷毀個人資料。如有任何疑問，請電郵至 ' +
      ((leader && leader.email) || '（班領導人電郵）') + ' 或致電 ' + ((leader && leader.phone) || '（電話）') + ' 與本人聯絡。';
    const plain = (st.info.name || '') + '　取錄名單\n' +
      items.map(i => i.no + '．' + i.name + '（' + i.troop + '）').join('\n');
    const rows = [];
    for (let i = 0; i < half; i++) {
      rows.push(h('tr', null,
        h('td', { class: 'td-idx' }, esc(left[i] ? left[i].no : '')),
        h('td', { class: 'td-strong' }, esc(left[i] ? left[i].name : '')),
        h('td', null, esc(left[i] ? left[i].troop : '')),
        h('td', { class: 'td-idx' }, esc(right[i] ? right[i].no : '')),
        h('td', { class: 'td-strong' }, esc(right[i] ? right[i].name : '')),
        h('td', null, esc(right[i] ? right[i].troop : ''))));
    }
    modal({ title: '🚩 取錄名單（' + items.length + ' 人）', wide: true, body: h('div', {},
      h('div', { class: 'doc-page' },
        h('div', { class: 'doc-center doc-title' }, esc(st.info.name || '')),
        h('div', { class: 'doc-center doc-h2' }, '取　錄　名　單'),
        h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, ['編號', '姓名', '旅別', '編號', '姓名', '旅別'].map(t => h('th', null, t)))),
          h('tbody', null, rows)),
        h('div', { class: 'doc-note' }, notice),
        h('div', { class: 'doc-sign' }, '班領導人　' + esc((leader && leader.name) || '＿＿＿＿＿＿'))),
      h('div', { class: 'btn-row no-print', style: { marginTop: '10px' } },
        h('button', { class: 'btn', onclick: () => {
          if (navigator.clipboard) navigator.clipboard.writeText(plain).then(() => toast('✅ 純文字名單已複製——可直接貼去區網頁', 'ok'));
        } }, '📋 複製文字版（區網頁用）'),
        h('button', { class: 'btn btn-primary', onclick: () => window.print() }, '🖨️ 列印'))) });
  }

  /* ── 參加名單（俾參加者知自己隊友；跟 Print_學員名單 欄位） ── */
  function joinList() {
    const useGroups = approved.some(r => r.group);
    const row = (r) => h('tr', null,
      h('td', null, esc(r.group || '—')),
      h('td', { class: 'td-idx' }, esc(r.studentNo)),
      h('td', { class: 'td-strong' }, esc(r.nameZh)),
      h('td', null, esc(r['性別'] || '—')),
      h('td', null, esc(r['旅團'] || '—')));
    let bodyRows;
    if (useGroups) {
      bodyRows = [];
      GROUP_OPTIONS.forEach((g) => {
        const members = approved.filter(r => r.group === g);
        if (!members.length) return;
        bodyRows.push(h('tr', { class: 'group-row' }, h('td', { colspan: '5' }, '【' + g + '】共 ' + members.length + ' 人')));
        members.forEach(r => bodyRows.push(row(r)));
      });
      const noGroup = approved.filter(r => !r.group);
      if (noGroup.length) {
        bodyRows.push(h('tr', { class: 'group-row' }, h('td', { colspan: '5' }, '【未分組】' + noGroup.length + ' 人')));
        noGroup.forEach(r => bodyRows.push(row(r)));
      }
    } else {
      bodyRows = approved.map(row);
    }
    const plain = (st.info.name || '') + '　參加名單' + (useGroups ? '（分組）' : '') + '\n' +
      (useGroups
        ? GROUP_OPTIONS.filter(g => approved.some(r => r.group === g)).map(g =>
            g + '：' + approved.filter(r => r.group === g).map(r => r.nameZh).join('、')).join('\n')
        : approved.map(r => (r.studentNo || '') + '．' + r.nameZh).join('\n'));
    modal({ title: '👥 參加名單（' + approved.length + ' 人' + (useGroups ? '・分組版' : '・全班一版') + '）', wide: true, body: h('div', {},
      h('div', { class: 'doc-page' },
        h('div', { class: 'doc-center doc-title' }, esc(st.info.name || '')),
        h('div', { class: 'doc-center doc-h2' }, '參加名單' + (useGroups ? '（分組）' : '')),
        h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, ['分組', '學員編號', '中文姓名', '性別', '旅團'].map(t => h('th', null, t)))),
          h('tbody', null, bodyRows))),
      h('div', { class: 'btn-row no-print', style: { marginTop: '10px' } },
        h('button', { class: 'btn', onclick: () => {
          if (navigator.clipboard) navigator.clipboard.writeText(plain).then(() => toast('✅ 已複製——可 Send 俾參加者（WhatsApp）', 'ok'));
        } }, '📋 複製文字版'),
        h('button', { class: 'btn btn-primary', onclick: () => window.print() }, '🖨️ 列印'))) });
  }

  /* ── 緊急聯絡清單（活動時職員隨身） ── */
  function emergencyList() {
    modal({ title: '🚨 緊急聯絡清單', wide: true, body: h('div', {},
      h('div', { class: 'row-sub' }, '活動期間職員隨身用；按分組／編號排序，家長電話一搵就到'),
      h('div', { class: 'doc-page' },
        h('div', { class: 'doc-center doc-title' }, esc(st.info.name || '')),
        h('div', { class: 'doc-center doc-h2' }, '緊急聯絡清單'),
        h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, ['組別', '編號', '學員', '學員電話', '家長／監護人', '家長電話', '旅領袖'].map(t => h('th', null, t)))),
          h('tbody', null, approved.map(r => h('tr', null,
            h('td', null, esc(r.group || '—')),
            h('td', { class: 'td-idx' }, esc(r.studentNo)),
            h('td', { class: 'td-strong' }, esc(r.nameZh)),
            h('td', null, esc(r['聯絡電話'] || '—')),
            h('td', null, esc((r['家長/監護人姓名'] || '—') + (r['與申請人關係'] ? '（' + r['與申請人關係'] + '）' : ''))),
            h('td', { class: 'td-strong' }, esc(r['家長/監護人聯絡電話'] || '—')),
            h('td', null, esc(r['領袖姓名（中文全名）'] || '—')))))),
      h('div', { class: 'btn-row no-print', style: { marginTop: '10px' } },
        h('button', { class: 'btn btn-primary', onclick: () => window.print() }, '🖨️ 列印')))) });
  }

  /* ── 收表（STA 正本）核對 ── */
  function staCollect() {
    const m2 = modal({ title: '📄 收表核對（STA 表格正本）', wide: true, body: h('div', {},
      h('div', { class: 'row-sub' }, '上課時收返報名表正本——tick 一下會做草稿（記錄收表人＋時間），撳💾先寫入，多人同時收都唔會撞'),
      h('div', { class: 'table-scroll' },
        h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, ['✔ 已收', '編號', '姓名', '旅團', '截圖（對一對）'].map(t => h('th', null, t)))),
          h('tbody', null, approved.map(r => {
            const cb = h('input', { type: 'checkbox' });
            cb.checked = Store.effectiveRegValue(r, '已交表格正本（STA）') === '✔';
            cb.addEventListener('change', () => {
              if (cb.checked) {
                Store.addRegDraft(r, '已交表格正本（STA）', '✔', r.nameZh + ' 收STA正本');
                Store.addRegDraft(r, '收表記錄', (Store.staffName() || '') + ' ' + fmtDT(new Date().toISOString()), r.nameZh + ' 收表記錄');
              } else {
                Store.addRegDraft(r, '已交表格正本（STA）', '', r.nameZh + ' 收STA正本');
                Store.addRegDraft(r, '收表記錄', '', r.nameZh + ' 收表記錄');
              }
              UI.updateHeader();
            });
            return h('tr', null,
              h('td', null, cb),
              h('td', { class: 'td-idx' }, esc(r.studentNo)),
              h('td', { class: 'td-strong' }, esc(r.nameZh)),
              h('td', null, esc(r['旅團'] || '—')),
              h('td', null, r.formUrl
                ? h('a', { href: r.formUrl, target: '_blank', rel: 'noopener', class: 'btn btn-sm' }, '🔍 截圖')
                : h('span', { class: 'dim' }, '—')));
          })))),
      h('div', { class: 'btn-row', style: { marginTop: '10px' } },
        h('button', { class: 'btn btn-primary', onclick: () => { Sync.saveAll(); } }, '💾 儲存已收名單'),
        h('button', { class: 'btn btn-ghost', onclick: () => m2.close() }, '關閉'))) });
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
