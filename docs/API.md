# 前端 × 訓練班後端合約（CourseHub 單一原點／舊制每班部署通用）

> 本 APP 係「**職員前端**」：讀全文（帶 rev）→ 改 → 一次過 `saveCourseBatch`。
> 後端有兩制，**合約完全相同**：
> - **新制（v6.0.0+）CourseHub**：一張「訓練班系統 GS」原點＋一個共用 `/exec`，
>   所有班靠登記表對應（**單一檔案** `apps-script/CourseHub.gs`，部署指南見
>   [`apps-script/COURSEHUB.md`](../apps-script/COURSEHUB.md)）
> - **舊制**：每班 GS bound `Code.gs.course.js`（v4.13.0 模版＋coursev5 模組）
> 座標正本：`scout-district-portal/gs/Code.gs.course.js`（v4.13.0 模版座標）。

## 傳輸

- `POST /exec`，`Content-Type: text/plain;charset=utf-8`（唔觸發 CORS preflight），body 係 JSON
- 所有 course action 都要 `apiKey`：
  - 舊制：SHA-256 hash 對該班 Script Properties `API_KEY_HASH`
  - 新制（hub）：SHA-256 hash 對原點 GS「訓練班登記」嘅 `API Key hash` 欄（登記表唔存明文）
- 回應：`{ok:true,data:…}` / `{ok:false,error:…}`；衝突另加 `conflict:true,rev,savedAt,by`

## CourseHub 對應規則（新制：單一 /exec 讀寫正確班別）

- 「訓練班登記」每班一行：`內部課程ID／公開課程ID／課程名稱／API Key hash／GS檔案ID／GS網址／Script /exec（舊班）／狀態／班領導人／建立時間`
- 每個 course action：`apiKey` hash → 登記表行 → `SpreadsheetApp.openById(fileId)`；
  可另帶 `publicCourseId`／`courseId` 覆核（同 key 唔對應即拒絕）
- 每班密碼存原點隱藏 `_Auth` 分頁（冇行＝首次 1234）；錯 5 次鎖 10 分鐘（按班獨立）
- 明文 API Key 只出現喺 `createCourse`／`registerCourse` 回應（一次）＋ `_Auth`（「從登記表選班」憑班密碼取回）
- 每班 Sheet 由 hub `createCourse` 自動 `makeCopy` 模版產生＋登記；模版由 `setup()`
  照 `CourseHub.gs`〔一〕模版規格段自動起——**人手零貼 ID、零逐班部署**
- **登記表只係指針**：班 Sheet 可喺任何帳戶開——`registerCourse` 登記現有／自己帳戶嘅
  空白 GS（驗證可讀 → `hubRepairTemplate_` 就地補齊結構，只補缺唔覆蓋 → 產三件套＋寫指針）。
  原點帳戶對班 Sheet 嘅存取只靠**逐個檔案 Drive 分享（編輯者）**，冇人需要交出帳戶；
  建議原點用專門嘅非機密帳戶部署（電郵喺 `hubInfo.ownerEmail` 回傳）
- 舊班行（登記表有自己 `/exec`）：course actions 唔經 hub，前端照舊直連該班 /exec；
  `connectCourseByPassword` 會 proxy 去該班驗證

### 三條密匙（v6.2 起）

| 密匙 | 數量 | 喺邊 | 用途 |
|---|---|---|---|
| 開班碼 `masterKey` | 1（可選，預設留空＝唔使） | 「設定」分頁 | `createCourse`／`registerCourse`；留空＝任何拎到 /exec 嘅人都可以開班（只會產生空班、唔掂到已有班） |
| **區系統密匙 `opsKey`** | 1（setup 自動產生） | 「設定」分頁，後台 `adminListCourses.secrets.opsKey` 可隨時取回 | 區管理系統**專用**：唔使逐班 apiKey，`opsKey`＋`publicCourseId` 或 CL 提供嘅 GS 網址 `fileId` 即可（對應唔到 ID 可先 call 公開 `listCourses` 用班名對）；只通行白名單 action：`getCourseProfile`／`getCourseSummary`／`listRegs`／`listBudgetVersions`／`setPaymentCheck`／`setCourseRefund`／`approveBudgetVersion`；另 `setParamLabel`（tick「區會批准」等參數）必須帶 `opsKey`（舊開班碼 `masterKey` 仍相容） |
| 後台帳密 `adminUser`／`adminPassword` | 1 組（setup 自動產生，帳號預設 `admin`） | 「設定」分頁，後台登入後 `secrets` 都有 | `adminListCourses`／`adminDeleteCourse`／`importCourse`；亦係每班登入頁「帳號:密碼」嘅後備管理員。**唔再寫死喺 code** |

- **首登強制改密碼（v6.2）**：新班／新登記班未改預設密碼 `1234` 前，所有寫入 action（`saveCourseBatch`／`setRegStatus`／收支／批核／通知書…）回
  `{ok:false, mustChangePassword:true, error}`，只放行 `auth`／`setPassword`；讀取唔阻，`addReg` 唔阻。改完密碼永久解鎖（之後改唔改隨班職員）。
- **公開報名（成員系統）**：`addReg` 可**唔帶 apiKey**，只帶 `publicCourseId`（唔接受內部 `courseId`／`fileId`）；只可以 append「表格回應」，
  回傳淨係 `{ok, refCode}`，**唔會讀返任何資料出嚟**；每班每 10 分鐘最多 20 個提交（CacheService 節流，防塞爆原點 Drive）；
  `archived`／`completed` 狀態嘅班拒絕。其餘 action 淨係帶 `publicCourseId` 一律回 Unauthorized。
- 公開連結上嘅 `publicCourseId` 本身係 48-bit 隨機 ID（估唔到、列舉唔到其他班），等同 Google Form「知連結先提交」能力；
  提交一律入 pending，由 CL 逐筆批核，假報名唔會自動取錄。

## 用到嘅 actions

| Action | 參數 | 回傳 | 前端用途 |
|---|---|---|---|
| `auth` | `password` | `{role:'staff'\|'admin',firstLogin:bool,v:'5.0.0'}` | 解鎖驗證（coursev5+）。錯 5 次 → 後端鎖 10 分鐘 |
| `setPassword` | `oldPassword,newPassword` | `{saved}` | 改共職員密碼（全體生效；新密碼 ≥4 位、≠1234、唔可以有 `:`） |
| `setPaymentCheck` | `id`(=時間戳記),`verified`,`by` | `{saved,row,verified}` | **區管理系統財務用**：核對區帳戶後 tick「已核對收款」；identity 定位、唔 bump rev、自動補表頭 |
| `setCourseRefund` | `id`(=時間戳記),`refunded`,`by` | `{saved,row,refunded}` | **區管理系統財務用**：已退款 tick，寫 AX/AY；CL App 只讀顯示 |
| `setParamLabel` | `opsKey`,`fileId` 或 `publicCourseId`,`label`,`value` | `{saved,row,label}` | **區管理系統專用（v6.2 起必須 opsKey）**：寫班 GS「參數」分頁（tick「區會批准」、FPS 資料等）；CL App 唔呼叫 |
| `addReg` | 職員：`apiKey`；**公開：只帶 `publicCourseId`**＋報名欄位（見下） | `{refCode}` | 成員系統報名。公開途徑 write-only（唔使 key、唔回讀資料）、只接受公開ID、節流 20／10 分鐘／班、必填入數紙截圖；同電郵未取消紀錄防重複；pending 由 CL 批核 |
| `sendRegNotice` | `ids?`,`by?` | `{sent,skipped,failed,results}` | **訓練班系統用**：CL 發接納／不接納通知書；ReplyTo=訓練班電郵；寫 AZ/BA 防重寄 |
| `submitBudgetVersion` | `reason`,`by` | `{version,status,snapshot}` | **訓練班系統用**：提交 Budget V1/V2 給管理層批核 |
| `listBudgetVersions` | — | `{versions,currentApproved}` | 查閱 Budget 版本紀錄 |
| `approveBudgetVersion` | `version`,`by` | `{approved,version,appliedToInput01}` | **區管理系統批核用**：批准 Budget 版本並寫回 Input01，令 Print_財政預算／收支表自動更新 |
| `getCourseSheetRaw` | — | `{input01,input02,input03,input04,resp,paramsWX,notice,attend,accept,finance,completion,cert,subsidy,pulledAt,rev,revSavedAt,revBy}` | 主同步（15 秒輪詢）；rev 供樂觀鎖；`attend`（Print_學員出席紀錄）係 coursev5 加嘅 dump |
| `getCourseProfile` | — | 課程結構資料 | 連線測試＋解鎖頁職員名單 |
| `getCourseSummary` | — | 見下「getCourseSummary 精簡批核 view」 | **區管理系統批核用**（`apps-script/Summary.gs`）：管理層只睇最重要嘅資料——一個 call 攞齊課程資料・節次・職員・預算 8 大類・通告要點（檔案編號/訓練班電郵）・批准狀態・報名數，減省行政時間。純讀、唔 bump rev |
| `createCourse` | `masterKey`(開班碼,可選),`courseName`,`edition?,section?,badge?,intake?,fee?,clName?,clTitle?,clEmail?,sessions?` | `{exec,apiKey,courseId,publicCourseId,directRegUrl,courseName,firstLogin,url}` | **CourseHub**（新制）／舊制 CourseFactory：CL 新開班**即刻自動起班 Sheet＋登記**——`makeCopy` 模版＋預填 Input01/02（`sessions` 可選預填節次）＋產三件套（內部課程ID／公開課程ID／API Key）＋回傳 GS `url` 交區;APP 即刻連線。新制回傳 `exec`＝hub /exec（所有班共用）。選填 `clEmail`＝新班 Sheet 自動 `addEditor` 班領導人（區管理電郵 `opsEmail` 自動分享已有） |
| `registerCourse` | `masterKey?(開班碼),url 或 fileId,`＋`courseName?,clName?,clTitle?,clEmail?,edition?,section?,badge?,intake?,fee?,sessions?` | `{exec,apiKey,courseId,publicCourseId,directRegUrl,courseName,url,firstLogin,registered:true}` | **CourseHub**：登記「已經存在」嘅班 Sheet（任何帳戶開得都得）——從 `url` 抽檔案ID→驗證原點可讀（唔得即報「原點帳戶讀唔到…請先分享（編輯者）」）→就地補齊模版結構（只補缺、唔覆蓋既有內容）→產三件套＋登記表寫指針。班內容擁有權留喺原帳戶，冇人需要交帳戶 |
| `hubInfo` | — | `{hubVersion,templateVersion,setupAt,ready,courses{active,archived},ownerEmail}` | **CourseHub**：診斷（GET /exec 亦回同樣資料）；前端／區系統確認原點已 setup；`ownerEmail`＝原點帳戶電郵（部署訓練班系統 GS 嗰個 Google 帳戶；CL 登記自己嘅 Sheet 前照佢分享）。**≠ 訓練班電郵**——訓練班電郵係每班「參數」分頁另一格（管理層告知 CL 填入；通告查詢行／通知書 ReplyTo／`getCourseSummary.courseEmail` 用），同原點帳戶無關 |
| `importCourse` | `adminUser,adminPassword,fileId,apiKey?,scriptExecUrl?,name?,publicCourseId?` | `{imported,courseId,publicCourseId,name}` | **CourseHub 後台**：舊制班登記入原點（保留該班自己 /exec；選班時 proxy 驗證） |
| `setRegStatus` | `id`(=時間戳記),`status`(pending/approved/rejected/cancelled),`reviewer` | `{saved,id,status}` | 收生：接納/拒絕/取消。**唔檢查 rev、唔 bump rev**（identity 定位，安全） |
| `saveCourseBatch` | `cells[{tab,row,col,value}]`,`baseRev`,`by` | `{saved,rev,savedAt,updated,skippedTabs}` | 批次寫格（開班文件／通告／分組） |
| `addExpenseRow` | `amounts{B..J}`,`note` | `{added,row,receiptNo}` | 〔二階段〕支出 append-only，唔撞 rev |
| `setCompletionRow` | `code|name`,`certNo?,pass?,failReason?` | `{updated,row,rev}` | 〔二階段〕完成報告 |
| `setCertRow` | `code|name`,`certNo?,pickupDate?,signed?` | `{updated,row,rev}` | 〔二階段〕證書領取 |

### addReg 報名欄位（v6.2.1：報名表全部欄位都寫入，唔再靜默丟失）

入參 → 「表格回應」寫入欄對應（GAS `hcsAddReg_` 同 mock 同一合約）：

| 入參 | 別名 | 寫入欄 | 備註 |
|---|---|---|---|
| `nameZh` | — | 中文姓名 | **必填** |
| `phone` | — | 聯絡電話 | **必填** |
| `email` | — | 電郵地址 | **必填**；同電郵未取消紀錄防重複 |
| `receiptDataUrl` | — | 已繳付訓練班費用截圖 | **必填**（入數紙）；`data:URL` 自動存入原點 Drive「訓練班文件」下以班命名嘅資料夾（best effort，失敗唔阻報名） |
| `nameEn` | — | 英文姓名 | 選填 |
| `gender` | — | 性別 | 選填 |
| `dob` | — | 出生日期 | 選填 |
| `scoutDistrict` | — | 所屬童軍區 | 預設「筲箕灣」 |
| `troop` | — | 旅團 | 選填 |
| `scoutId` | — | 童軍成員編號（ScoutID） | 選填 |
| `scoutPosition` | `scoutRank` | 童軍職位 | 選填 |
| `reason` | `extra` | 附加資料(有助訓練班取錄之原因) | 選填 |
| `consentParent` | — | 家長／監護人同意參與有關活動。 | truthy（`true`/`'true'`/`1`/`'1'`/`'✔'`/`'是'`）自動變 `✔` |
| `gName` | `guardianName` | 家長/監護人姓名 | 選填 |
| `gRelation` | `guardianRelation` | 與申請人關係 | 選填 |
| `gEmail` | `guardianEmail` | 家長/監護人聯絡電郵 | 選填 |
| `gPhone` | `guardianPhone` | 家長/監護人聯絡電話 | 選填 |
| `consentLeader` | — | 所屬童軍旅領袖同意參與有關活動。 | truthy 自動變 `✔` |
| `leaderName` | — | 領袖姓名（中文全名） | 選填 |
| `leaderTitle` | — | 領袖職位 | 選填 |
| `leaderEmail` | — | 領袖聯絡電郵 | 選填 |
| `payMethod` | — | 付款方式 | 預設 `FPS` |
| `payer` | `payerName` | 付款人姓名 | 選填 |
| `payAccount` | — | 付款帳戶 | 選填 |
| `formDataUrl` | `formShotDataUrl`／`formScreenshot` | 已填妥之表格截圖(上課時需交回正本) | `data:URL` 自動存入原點 Drive（同入數紙分開資料夾；best effort） |
| `needReceipt` | — | 是否需要收據 | truthy → `✔` |
| `remark` | `comment` | 備註 | 選填 |

> 審批狀態一律寫入 `pending`（由 CL 用 `setRegStatus` 批核）；入數紙同表格截圖兩類 `data:URL`
> 會分開存入「{班名}_付款證明」／「{班名}_表格截圖」資料夾。

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


## 通告 direct 報名連結

通告上只印**成員系統報名入口**，參加者不會見到訓練班 Script `/exec`。用來「對準報名表」的不是人手輸入欄，而是 `publicCourseId`：CourseHub（新制）／CourseFactory（舊制）開班時自動產生並寫入訓練班 GS「參數」及原點 GS「訓練班登記」。新制所有班嘅 `Script URL` 都係同一條 hub `/exec`，區管理系統靠 `publicCourseId` 對應；掛載到成員系統時用它作內部對應。成員系統不用人手設定；舊班如沒有 `publicCourseId`，區管理系統可自動生成一個並回寫。

## Budget 版本批核

- V1：CL 開班填完初版 Budget 後提交；管理層可批。
- V2+：正常係收生後因實際人數太多／太少而修訂。
- `approveBudgetVersion` 批准後會把該版本 snapshot 寫回 `Input01`，所以 `Print_財政預算`、收支表、完成報告使用的基準會自動變成最新已批 Budget，避免班職員照舊數用錯錢。
- `_BudgetVersions` 只係同一張 Spreadsheet 入面嘅隱藏版本紀錄，不會拆散成多張 Sheet 檔案。

## 密碼流程（coursev5／CourseHub v6.2）
- 每班第一次登入 `1234`（`_Auth` 冇密碼 hash → `auth` 回 `firstLogin:true`）→ 前端彈**不可關閉**嘅「必須先設定新密碼」對話框，
  未改之前後端封鎖所有寫入（`mustChangePassword:true`）；改完 → `firstLogin:false`
- 密碼以 SHA-256 存原點隱藏 `_Auth` 分頁（CourseHub 新制；舊制獨立部署存 Script Properties）
- 右上角常設 🔑 改密碼／🚪 登出掣（唔使入設定頁）
- 錯 5 次 → 鎖 10 分鐘（CacheService，按班獨立）；重設：刪 `_Auth` 該班「密碼hash」格，或後備管理員「帳號:密碼」入設定頁改
- 後備管理員帳密＝「設定」分頁嘅後台帳號／後台密碼（v6.2 起 setup 自動產生，唔再寫死 code）
- **向下相容**：舊版後端（v4.13.0）冇 `auth` action → 前端自動退回本機密碼閘（1234），並標記該班「舊版後端」

## rev 語義（防呆核心，mock 已照做）

- `_Sync` 隱藏分頁：A1 rev／B1 savedAt／C1 by
- `setCourseCells`／`setCompletionRow`／`setCertRow`／`saveCourseBatch`（有 cells/completion/cert）→ **驗 baseRev＋bump rev**
- `setRegStatus`／`addReg`／`addExpenseRow` → **唔驗唔 bump**（append／identity 性質）
- `createCourse`／`registerCourse` → 驗**開班碼**（masterKey，唔係逐班 apiKey）；新班／登記班 rev 由 0 開始；重複登記同一檔案＝拒絕
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

### 表格回應（coursev5 起 53 欄）
公式欄（**只讀**）：AD 旅號（旅團抽數字）、AI 學員編號（✔ 行 COUNTIF，報名次序）
參數分頁（`參數`）「**區會批准**」格（**區管理層批核訓練班時寫，CL 喺 APP 只讀**）：
- 批改完先 tick ✔；CL 見到 ✔ 就生成通告交區網頁管理員（tick 之前唔可以交）
- 通告上網＋掛載係**區管理系統內部**嘢（佢自己 SHEET 分頁貼訓練班 SCRIPT URL・訓練班 Drive・通告 URL→自動掛載成員系統），同訓練班 GS 無關；APP 用「報名流入 RESP」做已掛載信號

職員欄：AJ 分組（第一至八組）、AK 審批狀態、AL 批核人、AM 批核時間（AK/AL/AM+AC 由 setRegStatus 寫）
coursev5 新欄：AS 已核對收款✔／AT 核對人／AU 核對時間（區管理系統 setPaymentCheck 寫）；AV 已交表格正本（STA）✔／AW 收表記錄（班職員收表時 saveCourseBatch 寫）；AX 已退款✔／AY 退款核對人（區管理系統 setCourseRefund 寫）；AZ 通知書／BA 通知書寄出時間（訓練班系統 sendRegNotice 寫）
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
