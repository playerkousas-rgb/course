/*************************************************************
 * coursev5 · PaymentCheck 模組（v5.0.0）
 * 「表格回應」尾 3 欄（AS/AT/AU）＝已核對收款／核對人／核對時間
 * 由區管理系統（scout-district-portal）核對區帳戶後 tick——
 * 班職員前端只讀取顯示；唔會喺班職員 APP 度改。
 *
 * 安裝（詳見 apps-script/COURSEV5-UPGRADE.md）：
 *   1. GAS 專案新增檔案 PaymentCheck.gs，貼入本檔
 *   2. doPost 分發處（驗 apiKey 之後）加一行：
 *        case 'setPaymentCheck': return doSetPaymentCheck_(msg);
 *   3. 重新部署
 *
 * action: setPaymentCheck { apiKey, id(=時間戳記), verified(true/false), by }
 * 語義同 setRegStatus 一樣：用「時間戳記」identity 對行，
 * 唔檢查 rev、唔 bump rev（新報名插入都唔會寫錯行）。
 * 第一次使用時會自動補寫 AS1:AU1 表頭（舊表免手動升級）。
 *************************************************************/

var PC5 = {
  COL_CHECK: 45,   // AS 已核對收款 ✔
  COL_BY: 46,      // AT 核對人
  COL_AT: 47,      // AU 核對時間
  COL_ID: 1        // A  時間戳記
};

function doSetPaymentCheck_(msg) {
  var sheet = SpreadsheetApp.getActive().getSheetByName('表格回應');
  if (!sheet) {
    return pc5Out_({ ok: false, error: '找不到「表格回應」分頁' });
  }
  /* 自動補表頭（只喺 AS1 空白時寫一次） */
  if (String(sheet.getRange(1, PC5.COL_CHECK).getDisplayValue() || '').trim() === '') {
    sheet.getRange(1, PC5.COL_CHECK, 1, 3).setValues([['已核對收款', '核對人', '核對時間']]);
  }
  var id = String((msg && msg.id) != null ? msg.id : '').trim();
  if (!id) return pc5Out_({ ok: false, error: 'missing id' });

  var last = sheet.getLastRow();
  if (last < 2) return pc5Out_({ ok: false, error: '冇報名資料' });
  var ids = sheet.getRange(2, PC5.COL_ID, last - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) {
      var row = i + 2;
      var verified = !(msg && msg.verified === false);
      sheet.getRange(row, PC5.COL_CHECK).setValue(verified ? '✔' : '');
      sheet.getRange(row, PC5.COL_BY).setValue(verified ? String((msg && msg.by) || '') : '');
      sheet.getRange(row, PC5.COL_AT).setValue(verified ? new Date() : '');
      return pc5Out_({ ok: true, data: { saved: true, row: row, verified: verified } });
    }
  }
  return pc5Out_({ ok: false, error: '找不到該報名（時間戳記：' + id + '）' });
}

function pc5Out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
