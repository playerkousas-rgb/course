/*************************************************************
 * coursev5 · Refund 模組（v5.2.0）
 * 「表格回應」AX/AY＝已退款／退款核對人
 *
 * 用途：區管理系統只處理財務；當管理層已退回未獲接納／取消申請人的款項，
 *       portal 會呼叫本 action tick「↩ 已退款」。CL 在訓練班 App 只讀取顯示。
 *
 * 安裝：
 *   1. GAS 專案新增檔案 Refund.gs，貼入本檔
 *   2. doPost 分發處（驗 apiKey 之後）加一行：
 *        case 'setCourseRefund': return doSetCourseRefund_(msg);
 *   3. 重新部署
 *
 * action: setCourseRefund { apiKey, id(=時間戳記), refunded(true/false), by }
 * 語義同 PaymentCheck：用「時間戳記」identity 對行，唔 bump rev；
 * 第一次使用會自動補 AX1:AY1 表頭。
 *************************************************************/

var RF5 = {
  COL_ID: 1,        // A  時間戳記
  COL_REFUND: 50,   // AX 已退款 ✔
  COL_BY: 51        // AY 退款核對人
};

function doSetCourseRefund_(msg) {
  var sheet = SpreadsheetApp.getActive().getSheetByName('表格回應');
  if (!sheet) return rf5Out_({ ok: false, error: '找不到「表格回應」分頁' });

  if (String(sheet.getRange(1, RF5.COL_REFUND).getDisplayValue() || '').trim() === '') {
    sheet.getRange(1, RF5.COL_REFUND, 1, 2).setValues([['已退款', '退款核對人']]);
  }

  var id = String((msg && msg.id) != null ? msg.id : '').trim();
  if (!id) return rf5Out_({ ok: false, error: 'missing id' });

  var last = sheet.getLastRow();
  if (last < 2) return rf5Out_({ ok: false, error: '冇報名資料' });
  var ids = sheet.getRange(2, RF5.COL_ID, last - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) {
      var row = i + 2;
      var refunded = !(msg && msg.refunded === false);
      sheet.getRange(row, RF5.COL_REFUND).setValue(refunded ? '✔' : '');
      sheet.getRange(row, RF5.COL_BY).setValue(refunded ? String((msg && msg.by) || '') : '');
      return rf5Out_({ ok: true, data: { saved: true, row: row, refunded: refunded } });
    }
  }
  return rf5Out_({ ok: false, error: '找不到該報名（時間戳記：' + id + '）' });
}

function rf5Out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
