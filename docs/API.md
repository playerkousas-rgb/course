# 前端 × 每班 Code.gs.course.js 合約

> 本 APP 係 Script 註釋所講嘅「**職員前端**」：讀全文（帶 rev）→ 改 → 一次過 `saveCourseBatch`。
> 正本：`scout-district-portal/gs/Code.gs.course.js`（v4.13.0 模版座標）。

## 傳輸

- `POST /exec`，`Content-Type: text/plain;charset=utf-8`（唔觸發 CORS preflight），body 係 JSON
- 所有 action 都要 `apiKey`（SHA-256 hash 對 Script Properties `API_KEY_HASH`）
- 回應：`{ok:true,data:…}` / `{ok:false,error:…}`；衝突另加 `conflict:true,rev,savedAt,by`

## 用到嘅 actions

| Action | 參數 | 回傳 | 前端用途 |
|---|---|---|---|
| `auth` | `password` | `{role:'staff'\|'admin',firstLogin:bool,v:'5.0.0'}` | 解鎖驗證（coursev5+）。錯 5 次 → 後端鎖 10 分鐘 |
| `setPassword` | `oldPassword,newPassword` | `{saved}` | 改共職員密碼（全體生效；新密碼 ≥4 位、≠1234、唔可以有 `:`） |
| `setPaymentCheck` | `id`(=時間戳記),`verified`,`by` | `{saved,row,verified}` | **區管理系統用**：核對區帳戶後 tick「已核對收款」；identity 定位、唔 bump rev、自動補表頭 |
| `getCourseSheetRaw` | — | `{input01,input02,input03,input04,resp,paramsWX,notice,attend,accept,finance,completion,cert,subsidy,pulledAt,rev,revSavedAt,revBy}` | 主同步（15 秒輪詢）；rev 供樂觀鎖；`attend`（Print_學員出席紀錄）係 coursev5 加嘅 dump |
| `getCourseProfile` | — | 課程結構資料 | 連線測試＋解鎖頁職員名單 |
| `getCourseSummary` | — | 見下「getCourseSummary 精簡批核 view」 | **區管理系統批核用**（`apps-script/Summary.gs`）：管理層只睇最重要嘅資料——一個 call 攞齊課程資料・節次・職員・預算 8 大類・通告要點（檔案編號/訓練班電郵）・批准狀態・報名數，減省行政時間。純讀、唔 bump rev |
| `createCourse` | `masterKey`(開班碼),`courseName`,`edition?,section?,badge?,intake?,fee?,clName?` | `{exec,apiKey,courseId,courseName,firstLogin,url}` | **區級 CourseFactory**（`apps-script/CourseFactory.gs` 獨立部署）:CL 新開班**即刻起真 GS**（區管理系統 SCRIPT 要 URL 先連結批核）——copy 模版＋預填＋產 apiKey＋回傳 GS `url` 交區;APP 即刻連線 |
| `setRegStatus` | `id`(=時間戳記),`status`(pending/approved/rejected/cancelled),`reviewer` | `{saved,id,status}` | 收生：接納/拒絕/取消。**唔檢查 rev、唔 bump rev**（identity 定位，安全） |
| `saveCourseBatch` | `cells[{tab,row,col,value}]`,`baseRev`,`by` | `{saved,rev,savedAt,updated,skippedTabs}` | 批次寫格（開班文件／通告／分組） |
| `addExpenseRow` | `amounts{B..J}`,`note` | `{added,row,receiptNo}` | 〔二階段〕支出 append-only，唔撞 rev |
| `setCompletionRow` | `code|name`,`certNo?,pass?,failReason?` | `{updated,row,rev}` | 〔二階段〕完成報告 |
| `setCertRow` | `code|name`,`certNo?,pickupDate?,signed?` | `{updated,row,rev}` | 〔二階段〕證書領取 |

## getCourseSummary 精簡批核 view（coursev5）

管理層批改唔使睇成張 GS——一個 call 攞齊最重要嘅資料（GAS 端 `apps-script/Summary.gs`；mock 端 `js/15-mock.js` 同一合約，重用 `parseAll`/`budgetSummary`）：

```
{ ok, data: {
  courseName, edition, section, badge, customName, type1, type2,
  intake, fee, quota, staffCount, deadline, publish,
  sessions[{date,time,venue,onNotice}],
  leader{name,title,phone,email},
  staff[{role,name,title}],
  budget{sections[{key,label,mapTo,budget}], total},   // 8 大類，同前端收支頁同一套
  notice{fileNo,issueDate,eligibility,feeNote,uniform}, // 檔案編號＋訓練班電郵=管理層告知 CL 嘅輸入
  courseEmail,                                          // 參數分頁「訓練班電郵」格
  approved, regCount, pulledAt,
} }
```

管理層對呢個 view 要確認嘅嘢：
1. **通告檔案編號**（`notice.fileNo`）——管理層出編號話 CL 知，CL 填入通告頁「檔案編號」格
2. **訓練班電郵**（`courseEmail`）——管理層告知 CL，CL 填入參數分頁格；通告查詢行會自動用佢（冇填先 fallback 班領導人電郵）
3. 批好就 tick「區會批准」格（直接開 GS，或 `saveCourseBatch` 寫參數分頁）——CL 喺 APP 見到 ✔ 先出通告

## 密碼流程（coursev5）
- 每班第一次登入 `1234`（GS 冇 `COURSE_PW_HASH` → `auth` 回 `firstLogin:true`）→ 前端即刻彈「請設定新密碼」
- 改完 → `firstLogin:false`；密碼以 SHA-256 存 Script Properties
- 錯 5 次 → 鎖 10 分鐘（CacheService）；重設方法見 `apps-script/COURSEV5-UPGRADE.md`
- **向下相容**：舊版後端（v4.13.0）冇 `auth` action → 前端自動退回本機密碼閘（1234），並標記該班「舊版後端」

## rev 語義（防呆核心，mock 已照做）

- `_Sync` 隱藏分頁：A1 rev／B1 savedAt／C1 by
- `setCourseCells`／`setCompletionRow`／`setCertRow`／`saveCourseBatch`（有 cells/completion/cert）→ **驗 baseRev＋bump rev**
- `setRegStatus`／`addReg`／`addExpenseRow` → **唔驗唔 bump**（append／identity 性質）
- `createCourse` → 驗**開班碼**（masterKey，唔係逐班 apiKey）；新班 rev 由 0 開始
- baseRev 唔帶＝照寫（舊部署相容）
- 衝突回 `{ok:false,conflict:true,…}`——今次乜都冇寫入

## 分頁座標（v4.13.0 模版，前端 00-config.js 全部有對應表）

### Input01 訓練班預算
B1 名稱／B4 屆別／B5 支部／B6 專章(組別 - 名稱)／B7 自訂／B8,B9 形式／B11 收生／B12 收費／B13 職員
日期列 16–24（B 日期・C 時間・E 場地）；膳食 32–39（E早F午G晚H茶點I水・J 職員學員）；
場租 47–49（B地點C時段F數量H單價）＋其他 48–50（H）；露營 54–56／住宿 62–64（B地點C營期F日晚G人數H價格）；
交通 69–74（C說明H預算）；講義 79–81／節目 85–87／行政 91–93／紀念品 97–98（G數量H單價）；其他 102–104（B項目E金額）

### Input02 訓練班資料
B1 名稱／B4 名額／B5 收費／B6 職員人數（**公式黃格**，覆寫=蓋公式）
節次 9–16：B 日期・C 跨日✔・D 時間・E 場地・**G 自動中文日期（公式，只讀）**・H ✓上通告・I 通告日期（預設公式）・J 通告時間・K 通告地點
B18 截止／B19 公佈；職員 23–42（A職位B姓名C稱謂D單位E資格F電話G電郵）；B45 總人數（公式）／B46 常駐

### Print_通告
可編：G12 檔案編號／G13 發出日期／C23 參加資格／C24 費用說明／C31 服裝／C32–37 備註／E43 區總監署名／E45 代行
其餘 C22/C25/C28/C29/C30/C39、A15、B18:D21 全係公式（前端自行等效組版做 live preview）

### 表格回應（coursev5 起 49 欄）
公式欄（**只讀**）：AD 旅號（旅團抽數字）、AI 學員編號（✔ 行 COUNTIF，報名次序）
參數分頁（`參數`）「**區會批准**」格（**區管理層批核訓練班時寫，CL 喺 APP 只讀**）：
- 批改完先 tick ✔；CL 見到 ✔ 就生成通告交區網頁管理員（tick 之前唔可以交）
- 通告上網＋掛載係**區管理系統內部**嘢（佢自己 SHEET 分頁貼訓練班 SCRIPT URL・訓練班 Drive・通告 URL→自動掛載成員系統），同訓練班 GS 無關；APP 用「報名流入 RESP」做已掛載信號

職員欄：AJ 分組（第一至八組）、AK 審批狀態、AL 批核人、AM 批核時間（AK/AL/AM+AC 由 setRegStatus 寫）
coursev5 新欄：AS 已核對收款✔／AT 核對人／AU 核對時間（區管理系統 setPaymentCheck 寫）；AV 已交表格正本（STA）✔／AW 收表記錄（班職員收表時 saveCourseBatch 寫）
公式欄（**只讀**）：AD 旅號（旅團抽數字）、AI 學員編號（✔ 行 COUNTIF，報名次序）
職員欄：AJ 分組（第一至八組）、AK 審批狀態、AL 批核人、AM 批核時間（AK/AL/AM+AC 由 setRegStatus 寫）

## 時區
GAS `getValues()` 對日期格回 Date → JSON 變 UTC ISO（香港午夜=前一日 16:00Z）。
前端 `normDate()` 一律經 `Asia/Hong_Kong` 轉返 `yyyy-mm-dd`，避免快/慢一日。

## 已知 gap（二階段要處理）
`getCourseSheetRaw` 冇 dump `Print_學員出席紀錄`——出席模組要讀返已有剔號嘅話，建議喺 GAS 加一行：
```js
attend: dump('Print_學員出席紀錄'),
```
（只加欄位，舊前端唔會炒；或者改用「表格回應」尾欄存出席，唔使改模版——二階段再同 ADC/CL 定案。）
