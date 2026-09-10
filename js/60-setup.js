/* ============================================================
 * 60-setup.js — 開班文件（Input01 預算 + Input02 班資料）
 * 全部修改先入草稿；右上角 💾 一掣批次寫入 Sheet（防多人撞車）
 * 座標跟 Code.gs.course.js v4.13.0 模版
 * ============================================================ */

/* ── 表單工具（61-notice 都會用） ── */
function fieldCommitValue(type, raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (s === '') return '';
  if (type === 'number') {
    const n = Number(s);
    return Number.isFinite(n) ? n : s;
  }
  if (type === 'date') return normDate(s);
  return s;
}
function fieldDisplayValue(type, cur) {
  if (type === 'date') return normDate(cur);
  return String(cur == null ? '' : cur);
}

/* 一格輸入（綁草稿）；opts.formula=true → 覆寫公式格要 confirm */
function cellField(tab, spec, opts) {
  opts = opts || {};
  const cur = Store.effectiveCell(tab, spec.r, spec.c);
  let input;
  if (spec.type === 'select') {
    input = h('select', { class: 'input' }, h('option', { value: '' }, '—'));
    (spec.options || []).forEach(o => input.appendChild(h('option', { value: o }, o)));
    input.value = String(cur == null ? '' : cur).trim();
  } else if (spec.type === 'textarea') {
    input = h('textarea', { class: 'input', rows: 2 }, String(cur == null ? '' : cur));
  } else if (spec.type === 'badge') {
    if (!document.getElementById('dl-badges')) {
      document.body.appendChild(h('datalist', { id: 'dl-badges' }, BADGE_OPTIONS.map(o => h('option', { value: o }))));
    }
    input = h('input', { class: 'input', type: 'text', list: 'dl-badges', value: String(cur == null ? '' : cur).trim() });
  } else {
    input = h('input', {
      class: 'input',
      type: spec.type === 'date' ? 'date' : (spec.type === 'number' ? 'number' : 'text'),
      step: spec.type === 'number' ? 'any' : null,
      value: fieldDisplayValue(spec.type, cur),
    });
  }
  input.addEventListener('change', async () => {
    let v = spec.type === 'select' ? input.value : fieldCommitValue(spec.type, input.value);
    if ((spec.auto || opts.formula) && String(v) !== String(fieldDisplayValue('text', cur))) {
      if (!input.dataset.ovrOK) {
        const ok = await confirmDlg('覆蓋自動帶入值？',
          '「' + spec.label + '」呢格原本係公式（自動由預算帶入）。寫入會蓋掉公式，之後唔會再自動更新。',
          { okText: '覆蓋公式', danger: true });
        if (!ok) { input.value = fieldDisplayValue(spec.type, cur); return; }
        input.dataset.ovrOK = '1';
      }
    }
    Store.addCellDraft(tab, spec.r, spec.c, v, (opts.section ? opts.section + '・' : '') + spec.label);
    updateSetupTotals();
  });
  return h('div', { class: 'field' + (spec.auto ? ' field-auto' : '') },
    h('label', { class: 'flabel' }, spec.label, spec.auto || opts.formula ? h('span', { class: 'tag tag-amber', title: '公式自動帶入；直接改會蓋掉公式' }, '⚡自動') : null),
    input,
    spec.hint ? h('div', { class: 'fhint' }, spec.hint) : null);
}

function checkField(tab, r, c, label) {
  const cur = Store.effectiveCell(tab, r, c) === true;
  const input = h('input', { type: 'checkbox' });
  input.checked = cur;
  input.addEventListener('change', () => {
    Store.addCellDraft(tab, r, c, input.checked, label);
  });
  return h('label', { class: 'check' }, input, label);
}

/* 表格用細輸入 */
function smallInput(tab, r, c, type, label, section) {
  const cur = Store.effectiveCell(tab, r, c);
  const input = h('input', {
    class: 'input s', type: type === 'date' ? 'date' : (type === 'number' ? 'number' : 'text'),
    step: type === 'number' ? 'any' : null,
    value: fieldDisplayValue(type, cur),
  });
  input.addEventListener('change', () => {
    Store.addCellDraft(tab, r, c, fieldCommitValue(type, input.value), (section ? section + '・' : '') + label);
    updateSetupTotals();
  });
  return input;
}
function smallCheck(tab, r, c, label) {
  const input = h('input', { type: 'checkbox' });
  input.checked = Store.effectiveCell(tab, r, c) === true;
  input.addEventListener('change', () => Store.addCellDraft(tab, r, c, input.checked, label));
  return h('label', { class: 'check' }, input, label);
}
function smallSelect(tab, r, c, options, label, section) {
  const sel = h('select', { class: 'input s' }, h('option', { value: '' }, '—'));
  options.forEach(o => sel.appendChild(h('option', { value: o }, o)));
  sel.value = String(Store.effectiveCell(tab, r, c) || '').trim();
  sel.addEventListener('change', () => Store.addCellDraft(tab, r, c, sel.value, (section ? section + '・' : '') + label));
  return sel;
}

/* 即時小計（顯示用，同 Sheet 公式等效） */
function updateSetupTotals() {
  document.querySelectorAll('[data-total]').forEach((el) => {
    const kind = el.getAttribute('data-total');
    const r = Number(el.getAttribute('data-r'));
    const g = (c) => Number(Store.effectiveCell(TAB.IN1, r, c)) || 0;
    const intake = Number(Store.effectiveCell(TAB.IN1, IN1_CELLS.intake.r, IN1_CELLS.intake.c)) || 0;
    const staff = Number(Store.effectiveCell(TAB.IN1, IN1_CELLS.staff.r, IN1_CELLS.staff.c)) || 0;
    if (kind === 'meal') {
      const who = String(Store.effectiveCell(TAB.IN1, r, IN1_MEALS.who) || '');
      const people = who === '職員' ? staff : intake;
      const sum = g(IN1_MEALS.breakfast) + g(IN1_MEALS.lunch) + g(IN1_MEALS.dinner) + g(IN1_MEALS.snack) + g(IN1_MEALS.water);
      el.textContent = sum && people ? '$' + (sum * people).toLocaleString() : '';
    } else if (kind === 'mul3') {
      el.textContent = (g(IN1_CAMP.nights) && g(IN1_CAMP.people) && g(IN1_CAMP.price)) ? '$' + (g(IN1_CAMP.nights) * g(IN1_CAMP.people) * g(IN1_CAMP.price)).toLocaleString() : '';
    } else if (kind === 'mul2') {
      const qty = Number(el.getAttribute('data-qty-c')) || 0;
      const price = Number(el.getAttribute('data-price-c')) || 0;
      const q = Number(Store.effectiveCell(TAB.IN1, r, qty)) || 0;
      const p = Number(Store.effectiveCell(TAB.IN1, r, price)) || 0;
      el.textContent = (q && p) ? '$' + (q * p).toLocaleString() : '';
    }
  });
}

/* ============================================================ */

regPage('setup', function (root) {
  const st = Store.state;
  if (!st) { root.appendChild(h('div', { class: 'card' }, '載入中…')); return; }

  let sub = 'in1';
  const holder = h('div', { id: 'setupHolder' });
  const segIn1 = h('button', { class: 'seg-btn' }, '💰 Input01 預算');
  const segIn2 = h('button', { class: 'seg-btn' }, '📋 Input02 班資料');
  const segIn3 = h('button', { class: 'seg-btn' }, '🗓 時間表');
  const segRev = h('button', { class: 'seg-btn' }, '📤 區會審核');
  function paintSeg() {
    segIn1.classList.toggle('active', sub === 'in1');
    segIn2.classList.toggle('active', sub === 'in2');
    segIn3.classList.toggle('active', sub === 'in3');
    segRev.classList.toggle('active', sub === 'rev');
  }
  segIn1.addEventListener('click', () => { sub = 'in1'; paintSeg(); renderSub(); });
  segIn2.addEventListener('click', () => { sub = 'in2'; paintSeg(); renderSub(); });
  segIn3.addEventListener('click', () => { sub = 'in3'; paintSeg(); renderSub(); });
  segRev.addEventListener('click', () => { sub = 'rev'; paintSeg(); renderSub(); });

  root.appendChild(h('div', { class: 'page-note no-print' }, '✏️ 所有修改先存本機草稿——撳右上角 💾 先一次過寫入 Sheet（防多位職員同時改撞車）。'));
  root.appendChild(h('div', { class: 'seg no-print', style: { flexWrap: 'wrap' } }, segIn1, segIn2, segIn3, segRev));
  root.appendChild(holder);

  function renderSub() {
    holder.innerHTML = '';
    if (sub === 'in1') renderIn1(holder);
    else if (sub === 'in2') renderIn2(holder);
    else if (sub === 'in3') renderIn3(holder);
    else renderReview(holder);
    updateSetupTotals();
  }
  renderSub();
});

/* ── Input01 預算 ── */
function renderIn1(root) {
  /* 基本 */
  root.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '🧾 基本資料（Input01）'),
    h('div', { class: 'grid-2c' },
      cellField(TAB.IN1, IN1_CELLS.name),
      cellField(TAB.IN1, IN1_CELLS.edition),
      cellField(TAB.IN1, IN1_CELLS.section),
      cellField(TAB.IN1, IN1_CELLS.badge),
      cellField(TAB.IN1, IN1_CELLS.customName),
      cellField(TAB.IN1, IN1_CELLS.type1),
      cellField(TAB.IN1, IN1_CELLS.type2)),
    h('div', { class: 'grid-3c' },
      cellField(TAB.IN1, IN1_CELLS.intake),
      cellField(TAB.IN1, IN1_CELLS.fee),
      cellField(TAB.IN1, IN1_CELLS.staff))));

  /* 活動日期及場地 */
  const dateRows = IN1_DATES.rows.map((r, i) => h('tr', null,
    h('td', { class: 'td-idx' }, String(i + 1)),
    h('td', null, smallInput(TAB.IN1, r, IN1_DATES.date, 'date', '預算日期 #' + (i + 1), 'Input01 日期')),
    h('td', null, smallInput(TAB.IN1, r, IN1_DATES.time, 'text', '預算時間 #' + (i + 1), 'Input01 日期')),
    h('td', null, smallInput(TAB.IN1, r, IN1_DATES.venue, 'text', '預算場地 #' + (i + 1), 'Input01 日期'))));
  root.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '📅 活動日期及場地（預算用，最多 9 節）'),
    h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, '日期'), h('th', null, '時間'), h('th', null, '場地'))),
      h('tbody', null, dateRows)))));

  /* 1. 膳食 */
  const mealHeader = ['日期', '時間', '早餐', '午餐', '晚餐', '茶點', '飲用水', '職員/學員', '小計'];
  const mealRows = IN1_MEALS.rows.map((r, i) => h('tr', null,
    h('td', { class: 'td-idx' }, String(i + 1)),
    h('td', null, smallInput(TAB.IN1, r, IN1_MEALS.date, 'date', '膳食日期 #' + (i + 1), '膳食')),
    h('td', null, smallInput(TAB.IN1, r, IN1_MEALS.time, 'text', '膳食時間 #' + (i + 1), '膳食')),
    ['breakfast', 'lunch', 'dinner', 'snack', 'water'].map(k =>
      h('td', null, smallInput(TAB.IN1, r, IN1_MEALS[k], 'number', '膳食' + k + ' #' + (i + 1), '膳食'))),
    h('td', null, smallSelect(TAB.IN1, r, IN1_MEALS.who, MEAL_WHO_OPTIONS, '膳食對象 #' + (i + 1), '膳食')),
    h('td', { class: 'td-total', 'data-total': 'meal', 'data-r': String(r) })));
  root.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '1. 膳食（人均預算）'),
    h('div', { class: 'row-sub' }, IN1_MEALS.guide + '——小計＝人均總和 × 人數（職員用職員數、學員用收生數）'),
    h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, h('th', null, '#'), mealHeader.map(t => h('th', null, t)))),
      h('tbody', null, mealRows)))));

  /* 2. 租金 */
  const rentCard = h('div', { class: 'card' }, h('div', { class: 'card-title' }, '2. 租金'));
  rentCard.appendChild(h('div', { class: 'row-sub' }, '2.1 場租（小計＝數量 × 單價）'));
  rentCard.appendChild(h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
    h('thead', null, h('tr', null, ['地點', '租用時段', '數量', '單價', '小計'].map(t => h('th', null, t)))),
    h('tbody', null, IN1_RENT.rows.map((r, i) => h('tr', null,
      h('td', null, smallInput(TAB.IN1, r, IN1_RENT.venue, 'text', '場租地點 #' + (i + 1), '場租')),
      h('td', null, smallInput(TAB.IN1, r, IN1_RENT.slot, 'text', '場租時段 #' + (i + 1), '場租')),
      h('td', null, smallInput(TAB.IN1, r, IN1_RENT.qty, 'number', '場租數量 #' + (i + 1), '場租')),
      h('td', null, smallInput(TAB.IN1, r, IN1_RENT.price, 'number', '場租單價 #' + (i + 1), '場租')),
      h('td', { class: 'td-total', 'data-total': 'mul2', 'data-r': String(r), 'data-qty-c': String(IN1_RENT.qty), 'data-price-c': String(IN1_RENT.price) })))))));
  rentCard.appendChild(h('div', { class: 'row-sub', style: { marginTop: '8px' } }, '場租其他收費'));
  rentCard.appendChild(h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
    h('thead', null, h('tr', null, h('th', null, '金額 1'), h('th', null, '金額 2'), h('th', null, '金額 3'))),
    h('tbody', null, h('tr', null, IN1_RENT_EXTRA.rows.map((r, i) =>
      h('td', null, smallInput(TAB.IN1, r, IN1_RENT_EXTRA.amount, 'number', '場租其他收費 #' + (i + 1), '場租'))))))));
  [['2.2 露營', IN1_CAMP], ['2.3 住宿', IN1_LODGE]].forEach(([title, map]) => {
    rentCard.appendChild(h('div', { class: 'row-sub', style: { marginTop: '8px' } }, title + '（小計＝日晚數 × 人數 × 價格）'));
    rentCard.appendChild(h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, ['地點', '營期', '日/晚數', '人數', '價格', '小計'].map(t => h('th', null, t)))),
      h('tbody', null, map.rows.map((r, i) => h('tr', null,
        h('td', null, smallInput(TAB.IN1, r, map.venue, 'text', title + '地點 #' + (i + 1), title)),
        h('td', null, smallInput(TAB.IN1, r, map.period, 'text', title + '營期 #' + (i + 1), title)),
        h('td', null, smallInput(TAB.IN1, r, map.nights, 'number', title + '日晚數 #' + (i + 1), title)),
        h('td', null, smallInput(TAB.IN1, r, map.people, 'number', title + '人數 #' + (i + 1), title)),
        h('td', null, smallInput(TAB.IN1, r, map.price, 'number', title + '價格 #' + (i + 1), title)),
        h('td', { class: 'td-total', 'data-total': 'mul3', 'data-r': String(r) })))))));
  });
  root.appendChild(rentCard);

  /* 3. 交通 */
  const trCard = h('div', { class: 'card' }, h('div', { class: 'card-title' }, '3. 交通／運輸'),
    IN1_TRANSPORT.map(g => h('div', { class: 'transport-group' },
      h('div', { class: 'row-sub' }, g.label),
      g.rows.map((r, i) => h('div', { class: 'inline-row' },
        smallInput(TAB.IN1, r, IN1_TRANSPORT_COLS.desc, 'text', g.label + '說明 #' + (i + 1), '交通'),
        smallInput(TAB.IN1, r, IN1_TRANSPORT_COLS.budget, 'number', g.label + '預算 #' + (i + 1), '交通'))))));
  root.appendChild(trCard);

  /* 4–7 數量 × 單價類 */
  const qtyPriceSection = (title, map, fixedLabels) => h('div', { class: 'card' },
    h('div', { class: 'card-title' }, title),
    h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, h('th', null, '項目'), h('th', null, '數量'), h('th', null, '單價'), h('th', null, '小計'))),
      h('tbody', null, map.rows.map((r, i) => h('tr', null,
        h('td', null, fixedLabels ? h('span', { class: 'fixed-label' }, fixedLabels[i] || '') : smallInput(TAB.IN1, r, map.name, 'text', title + '項目 #' + (i + 1), title)),
        h('td', null, smallInput(TAB.IN1, r, map.qty, 'number', title + '數量 #' + (i + 1), title)),
        h('td', null, smallInput(TAB.IN1, r, map.price, 'number', title + '單價 #' + (i + 1), title)),
        h('td', { class: 'td-total', 'data-total': 'mul2', 'data-r': String(r), 'data-qty-c': String(map.qty), 'data-price-c': String(map.price) })))))));
  root.appendChild(qtyPriceSection('4. 講義／場刊', IN1_HANDOUTS, IN1_HANDOUTS.labels));
  root.appendChild(qtyPriceSection('5. 節目開支', IN1_PROGRAMME, null));
  root.appendChild(qtyPriceSection('6. 行政', IN1_ADMIN, IN1_ADMIN.labels));
  root.appendChild(qtyPriceSection('7. 紀念品／獎品', IN1_SOUVENIR, null));

  /* 8. 其他 */
  root.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '8. 其他'),
    h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, h('th', null, '項目'), h('th', null, '金額'))),
      h('tbody', null, IN1_MISC.rows.map((r, i) => h('tr', null,
        h('td', null, smallInput(TAB.IN1, r, IN1_MISC.name, 'text', '其他項目 #' + (i + 1), '其他支出')),
        h('td', null, smallInput(TAB.IN1, r, IN1_MISC.amount, 'number', '其他金額 #' + (i + 1), '其他支出')))))))));

  root.appendChild(h('div', { class: 'row-sub', style: { marginTop: '4px' } },
    '💡 總支出／收入／津貼由「Print_財政預算」公式自動計——區管理平台同列印版會自動讀。'));
}

/* ── Input03 時間表（每節一個 10 行 block;需時累計自動排時間） ── */
function in3AutoTimes(sessTime, minsArr) {
  const m = String(sessTime || '').match(/(\d{1,4})\s*[-–—]\s*(\d{1,4})/);
  if (!m) return null;
  const t = Number(m[1]);
  let mm = Math.floor(t / 100) * 60 + (t % 100);
  return minsArr.map((mins) => {
    const disp = mm;
    mm += Number(mins) || 0;
    return String(Math.floor(disp / 60)).padStart(2, '0') + String(disp % 60).padStart(2, '0');
  });
}

function renderIn3(root) {
  const st = Store.state;
  if (!st.sessions.length) {
    root.appendChild(h('div', { class: 'card empty' }, '未填節次——先去「📋 Input02 班資料」填好每節日期時間；時間表會照節次逐節一個 block（最多 9 節）'));
    return;
  }
  root.appendChild(h('div', { class: 'page-note no-print' },
    '⏱ 填好每項「需時（分鐘）」，撳「自動排時間」會照節次開始時間逐項累計填「時間」欄。所有改動都係草稿——撳右上角 💾 先寫入。'));

  st.sessions.slice(0, IN3_LAYOUT.maxBlocks).forEach((sess, i) => {
    const head = IN3_LAYOUT.firstHead + i * IN3_LAYOUT.blockRows;
    const card = h('div', { class: 'card' });
    card.appendChild(h('div', { class: 'card-title' }, '🗓 第 ' + (i + 1) + ' 節・' + fmtShortDate(sess.date) + '（' + sess.time + '）'));

    card.appendChild(h('div', { class: 'grid-2c' },
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '日期'),
        smallInput(TAB.IN3, head, IN3_LAYOUT.date.c, 'date', '時間表第' + (i + 1) + '節 日期', 'Input03 時間表')),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '時間'),
        smallInput(TAB.IN3, head + IN3_LAYOUT.time.dr, IN3_LAYOUT.time.c, 'text', '時間表第' + (i + 1) + '節 時間', 'Input03 時間表')),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '地點'),
        smallInput(TAB.IN3, head + IN3_LAYOUT.venue.dr, IN3_LAYOUT.venue.c, 'text', '時間表第' + (i + 1) + '節 地點', 'Input03 時間表')),
      h('div', { class: 'field' }, h('label', { class: 'flabel' }, '服裝'),
        smallInput(TAB.IN3, head + IN3_LAYOUT.dress.dr, IN3_LAYOUT.dress.c, 'text', '時間表第' + (i + 1) + '節 服裝', 'Input03 時間表'))));

    /* rundown 表 */
    const rows = [];
    let totalMins = 0;
    for (let k = 0; k < IN3_LAYOUT.items; k++) {
      const r = head + 4 + k;
      const mins = Number(Store.effectiveCell(TAB.IN3, r, IN3_LAYOUT.item.mins));
      if (Number.isFinite(mins) && mins) totalMins += mins;
      rows.push(h('tr', null,
        h('td', { class: 'td-idx' }, String(k + 1)),
        h('td', null, smallInput(TAB.IN3, r, IN3_LAYOUT.item.start, 'text', '時間表第' + (i + 1) + '節 開始時間 #' + (k + 1), 'Input03 時間表')),
        h('td', null, smallInput(TAB.IN3, r, IN3_LAYOUT.item.mins, 'number', '時間表第' + (i + 1) + '節 需時 #' + (k + 1), 'Input03 時間表')),
        h('td', null, smallInput(TAB.IN3, r, IN3_LAYOUT.item.name, 'text', '時間表第' + (i + 1) + '節 項目 #' + (k + 1), 'Input03 時間表')),
        h('td', null, smallInput(TAB.IN3, r, IN3_LAYOUT.item.owner, 'text', '時間表第' + (i + 1) + '節 負責人 #' + (k + 1), 'Input03 時間表'))));
    }
    const autoBtn = h('button', { class: 'btn btn-sm' }, '⏱ 自動排時間');
    autoBtn.addEventListener('click', () => {
      const minsArr = [];
      for (let k = 0; k < IN3_LAYOUT.items; k++) minsArr.push(Store.effectiveCell(TAB.IN3, head + 4 + k, IN3_LAYOUT.item.mins));
      const sessTime = Store.effectiveCell(TAB.IN3, head + IN3_LAYOUT.time.dr, IN3_LAYOUT.time.c) || sess.time;
      const times = in3AutoTimes(sessTime, minsArr);
      if (!times) { toast('睇唔明節次時間（要有「1930 - 2130」呢種格式）', 'err'); return; }
      let n = 0;
      times.forEach((t2, k) => {
        const mv = minsArr[k];
        if (mv !== '' && mv != null) {
          Store.addCellDraft(TAB.IN3, head + 4 + k, IN3_LAYOUT.item.start, t2, '時間表第' + (i + 1) + '節 自動排時間');
          n++;
        }
      });
      toast(n ? '✏️ 已排好 ' + n + ' 項時間（草稿）——撳💾寫入' : '未有填「需時」嘅項目', n ? 'ok' : '');
      UI.rerenderPage();
    });
    card.appendChild(h('div', { class: 'btn-row', style: { margin: '8px 0' } },
      autoBtn,
      h('span', { class: 'row-sub' }, '合計需時：' + totalMins + ' 分鐘')));
    card.appendChild(h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null,
        h('th', null, '#'), h('th', null, '時間'), h('th', null, '需時（分鐘）'), h('th', null, '項目'), h('th', null, '負責人'))),
      h('tbody', null, rows))));
    root.appendChild(card);
  });
}

/* ── 區會審核摘要（CL 起表後,區管理層連結 GS 一睇就批;對應一鍵批核掛載流程） ── */
function renderReview(root) {
  const st = Store.state;
  const info = st.info;
  const bud = budgetSummary(st);
  const btnBar = h('div', { class: 'btn-row no-print', style: { marginBottom: '12px' } });
  btnBar.appendChild(h('button', { class: 'btn btn-primary', onclick: () => { window.print(); } }, '🖨 列印審核摘要'));
  root.appendChild(btnBar);

  const doc = h('div', { class: 'doc-page' });
  doc.appendChild(h('div', { class: 'doc-org' }, '香港童軍總會 筲箕灣區'));
  doc.appendChild(h('div', { class: 'doc-title' }, esc(info.name || '（未命名）')));
  doc.appendChild(h('div', { class: 'doc-sub' }, '開班審核摘要'));

  const kvs = [
    ['屆別', info.edition || '—'], ['支部', info.section || '—'],
    ['專章', info.badge || '—'], ['形式', (info.type1 + (info.type2 ? '／' + info.type2 : '')) || '—'],
    ['預計收生人數', info.intake === '' ? '—' : info.intake], ['預計收費', info.fee === '' ? '—' : '$' + info.fee],
    ['班職員人數', info.staff === '' ? '—' : info.staff],
    ['截止報名', info.deadline ? fmtCNDate(info.deadline) : '—'],
    ['最遲公佈取錄名單', info.publish ? fmtCNDate(info.publish) : '—'],
  ];
  const kvTbl = h('table', { class: 'data-table' });
  const kvTb = h('tbody', null);
  for (let i = 0; i < kvs.length; i += 2) {
    kvTb.appendChild(h('tr', null,
      h('td', { class: 'td-strong', style: { width: '22%' } }, kvs[i][0]), h('td', null, esc(String(kvs[i][1]))),
      kvs[i + 1] ? h('td', { class: 'td-strong', style: { width: '22%' } }, kvs[i + 1][0]) : h('td', null, ''),
      kvs[i + 1] ? h('td', null, esc(String(kvs[i + 1][1]))) : h('td', null, '')));
  }
  kvTbl.appendChild(kvTb);
  doc.appendChild(h('div', { class: 'row-sub' }, '一、基本資料'));
  doc.appendChild(kvTbl);

  doc.appendChild(h('div', { class: 'row-sub', style: { marginTop: '14px' } }, '二、節次'));
  if (st.sessions.length) {
    const sTbl = h('table', { class: 'data-table' });
    sTbl.appendChild(h('thead', null, h('tr', null,
      h('th', null, '#'), h('th', null, '日期'), h('th', null, '時間'), h('th', null, '場地'), h('th', null, '上通告'))));
    const sTb = h('tbody', null);
    st.sessions.forEach((x, i) => sTb.appendChild(h('tr', null,
      h('td', { class: 'td-idx' }, String(i + 1)),
      h('td', null, x.date ? fmtCNDate(x.date) : '—'), h('td', null, esc(x.time || '—')),
      h('td', null, esc(x.venue || '—')), h('td', null, x.onNotice ? '✔' : '—'))));
    sTbl.appendChild(sTb);
    doc.appendChild(sTbl);
  } else doc.appendChild(h('div', { class: 'doc-note' }, '（未填節次）'));

  doc.appendChild(h('div', { class: 'row-sub', style: { marginTop: '14px' } }, '三、班職員'));
  if (st.staff.length) {
    const tTbl = h('table', { class: 'data-table' });
    tTbl.appendChild(h('thead', null, h('tr', null,
      h('th', null, '職位'), h('th', null, '姓名'), h('th', null, '稱謂'), h('th', null, '資格標註'))));
    const tTb = h('tbody', null);
    st.staff.forEach((x) => tTb.appendChild(h('tr', null,
      h('td', null, esc(x.role || '—')), h('td', { class: 'td-strong' }, esc(x.name || '—')),
      h('td', null, esc(x.title || '—')), h('td', null, esc(x.qual || '—')))));
    tTbl.appendChild(tTb);
    doc.appendChild(tTbl);
  } else doc.appendChild(h('div', { class: 'doc-note' }, '（未填職員）'));

  doc.appendChild(h('div', { class: 'row-sub', style: { marginTop: '14px' } }, '四、預算（Input01）'));
  const bTbl = h('table', { class: 'data-table' });
  bTbl.appendChild(h('thead', null, h('tr', null, h('th', null, '分類'), h('th', null, '預算'))));
  const bTb = h('tbody', null);
  bud.sections.forEach((x) => bTb.appendChild(h('tr', null,
    h('td', null, esc(x.label)), h('td', { class: 'td-num' }, x.budget ? '$' + x.budget : '—'))));
  bTb.appendChild(h('tr', null, h('td', { class: 'td-total' }, '合計'), h('td', { class: 'td-total td-num' }, '$' + bud.total)));
  bTbl.appendChild(bTb);
  doc.appendChild(bTbl);

  doc.appendChild(h('div', { class: 'doc-note' },
    '區會審核流程：①連結本訓練班工作簿（GS）②核對以上內容（有修改要求請 CL 喺系統改）③一鍵批核＋掛載通告（成員系統報名）。',
    h('br'), '本班收入支出會照預算對數；完成後嘅合格名單＋證書編號會喺「Print_訓練班完成報告」，區會讀取後連結成員系統紀錄。'));
  const signs = h('div', { style: { display: 'flex', justifyContent: 'space-around', marginTop: '46px' } });
  signs.appendChild(h('div', { class: 'doc-sign' }, h('div', { class: 'doc-sign-title' }, '班領導人')));
  signs.appendChild(h('div', { class: 'doc-sign' }, h('div', { class: 'doc-sign-title' }, '區總監（批核）')));
  signs.appendChild(h('div', { class: 'doc-sign' }, h('div', { class: 'doc-sign-title' }, '日期')));
  doc.appendChild(signs);
  root.appendChild(doc);
}

/* ── Input02 班資料 ── */
function renderIn2(root) {
  root.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '📋 班資料（Input02）'),
    h('div', { class: 'row-sub' }, '⚡自動格由預算帶入；真係要唔同先覆蓋（會蓋掉公式）'),
    h('div', { class: 'grid-2c' },
      cellField(TAB.IN2, IN2_CELLS.name),
      cellField(TAB.IN2, IN2_CELLS.quota),
      cellField(TAB.IN2, IN2_CELLS.fee),
      cellField(TAB.IN2, IN2_CELLS.staff))));

  /* 節次 */
  const sessRows = IN2_SESSIONS.rows.map((r, i) => h('tr', null,
    h('td', { class: 'td-idx' }, String(i + 1)),
    h('td', null, smallInput(TAB.IN2, r, IN2_SESSIONS.date, 'date', '節次日期 #' + (i + 1), 'Input02 節次')),
    h('td', { class: 'td-center' }, smallCheck(TAB.IN2, r, IN2_SESSIONS.cross, '跨日')),
    h('td', null, smallInput(TAB.IN2, r, IN2_SESSIONS.time, 'text', '節次時間 #' + (i + 1), 'Input02 節次')),
    h('td', null, smallInput(TAB.IN2, r, IN2_SESSIONS.venue, 'text', '節次場地 #' + (i + 1), 'Input02 節次')),
    h('td', { class: 'td-center' }, smallCheck(TAB.IN2, r, IN2_SESSIONS.onNotice, '上通告')),
    h('td', null, smallInput(TAB.IN2, r, IN2_SESSIONS.dispDate, 'text', '通告顯示日期 #' + (i + 1), 'Input02 節次')),
    h('td', null, smallInput(TAB.IN2, r, IN2_SESSIONS.dispTime, 'text', '通告顯示時間 #' + (i + 1), 'Input02 節次')),
    h('td', null, smallInput(TAB.IN2, r, IN2_SESSIONS.dispVenue, 'text', '通告顯示地點 #' + (i + 1), 'Input02 節次'))));
  root.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '📅 節次（最多 8 節；頭 4 節可上通告）'),
    h('div', { class: 'row-sub' }, '「通告顯示日期」預設自動中文日期；要合併跨日寫法（例：8月10至11日）先直接改（會蓋公式）'),
    h('div', { class: 'table-scroll' }, h('table', { class: 'data-table wide-cols' },
      h('thead', null, h('tr', null, ['#', '日期', '跨日', '時間', '場地', '上通告', '通告日期', '通告時間', '通告地點'].map(t => h('th', null, t)))),
      h('tbody', null, sessRows)))));

  root.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '⏰ 日期'),
    h('div', { class: 'grid-2c' },
      cellField(TAB.IN2, IN2_DEADLINE),
      cellField(TAB.IN2, IN2_PUBLISH)),
    h('div', { class: 'row-sub' }, '成員系統會喺截止後拒收新報名（由區管理平台開班設定控制）')));

  /* 職員表 */
  const staffRows = IN2_STAFF.rows.map((r, i) => h('tr', null,
    h('td', { class: 'td-idx' }, String(i + 1)),
    [IN2_STAFF.role, IN2_STAFF.name, IN2_STAFF.title, IN2_STAFF.unit, IN2_STAFF.qual, IN2_STAFF.phone, IN2_STAFF.email].map((c, ci) =>
      h('td', null, smallInput(TAB.IN2, r, c, 'text', '職員' + ['職位', '姓名', '稱謂', '單位', '資格', '電話', '電郵'][ci] + ' #' + (i + 1), 'Input02 職員')))));
  root.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-title' }, '👥 職員表（20 行，職位已預設）'),
    h('div', { class: 'table-scroll' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, ['#', '職位', '姓名', '稱謂', '所屬單位／職銜', '資格標註', '電話', '電郵'].map(t => h('th', null, t)))),
      h('tbody', null, staffRows)))));

  root.appendChild(h('div', { class: 'card' },
    h('div', { class: 'grid-2c' }, cellField(TAB.IN2, IN2_RESIDENT)),
    h('div', { class: 'row-sub' }, '班職員總人數由上表自動計算，唔使填')));
}
