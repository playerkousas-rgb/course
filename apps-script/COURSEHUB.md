# CourseHub 部署指南（一張訓練班系統 GS 做原點）

> 取代舊制「每班一個 bound script＋逐班部署」。由 v6.0.0 起，成個訓練班系統
> 嘅後端＝**一張原點 GS＋一個 /exec**：開班／登記／模版／讀寫全部由佢自動做。
> **後端只有一個檔案**（`CourseHub.gs`）——貼一次、run 一次 `setup()`、部署一次就完成。
> 前端（本 repo）合約零破壞；舊制逐班部署嘅班照舊相容（見尾段）。

## 一次過設定（區管理層／技術同事，約 10 分鐘）

1. **開一張新 Google Sheet**——呢張就係「訓練班系統 GS」（原點）。建議改名叫「訓練班系統」。
2. **擴充功能 → Apps Script** → 貼入**一個檔案**：`apps-script/CourseHub.gs`
   （單一檔案已包埋：〔一〕模版規格・〔二〕setup・〔三〕路由＋開班＋登記＋選班＋後台・
   〔四〕coursev5 合約：讀寫／收生／批核／通知書／Budget…）。

   ⚠️ **唔好**將 `CourseFactory.gs`／`Auth.gs`／`PaymentCheck.gs` 等舊制檔案貼入同一個專案
   （嗰啲係舊制逐班部署用；同名函式會撞）。

3. 喺 Apps Script 編輯器**手動 run 一次 `setup()`**（首次會彈授權；揀進階→繼續）。
   setup 會自動：
   - 建「設定」「訓練班登記」「_Auth（隱藏）」「_Meta（隱藏）」分頁
   - 喺原點 GS 隔離開 Drive 資料夾「訓練班文件」
   - 照 TemplateLayout 起「開班文件模版（自動產生）」GS
   - 全部**幂等**：重複 run 唔會重複建、唔會覆蓋資料

   > 6 分鐘時限對策：`setup()`／`setupTemplate()`／`setupRegistry()` 可以分開手動 run。

4. 「設定」分頁按需填值（**全部可留空**；冇任何 ID 要貼）：

   | A欄 | 用途 |
   |---|---|
   | 成員系統報名網址 | 有值先自動組 direct 報名連結 |
   | 區管理電郵 | 有值先自動分享新班 GS |
   | 開班碼 | 留空＝開新班免碼；填咗就要碼先開到新班 |
   | FPS 識別碼／FPS 戶口名稱／區會網址 | 自動寫入每班參數（通告／收費用） |
   | 模版檔案模式 | `auto`（預設）；`manual`＋另加「模版GS檔案ID」行＝用人手模版（逃生口） |

5. **部署 → 部署為網頁應用程式**（執行身分：我自己；存取：**任何人**）→ 攞 `/exec`。
   呢條就係全系統唯一後端網址（`hubInfo` 可驗證：`GET /exec`）。

6. 將 `/exec`（＋開班碼，如有）派俾 CL。完事——**之後日常唔使再入 Apps Script**。

## 日常運作

| 角色 | 做乜 |
|---|---|
| CL | 前端「🆕 新開班」填課程名／班領導人／名額／收費／屆別／支部／專章 → 新班 Sheet 自動產生＋自動登記 → 即刻入班（首次密碼 1234）→ 喺 APP 填預算／節次／時間表／通告 |
| 班職員 | 「📚 從登記表選班」揀班名 → 輸入本班密碼 → 自動取回連線資料（唔使記 key／URL） |
| 區管理層 | `getCourseSummary` 批核；批好 tick 班 GS 參數「區會批准」；財務用 `setPaymentCheck`／`setCourseRefund`；Budget 用 `approveBudgetVersion` |
| 成員系統 | 通告 direct link（帶 `publicCourseId`）→ `addReg` 經同一個 /exec 寫入正確班 |
| 開錯班 | 首頁 Logo 連按 7 下 → 後台清理（帳密只寫喺 `CourseHub.gs` 常數） |

## 對應規則（單一 /exec 點讀寫正確班別）

- 「訓練班登記」分頁每班一行：`內部課程ID／公開課程ID／課程名稱／API Key hash／GS檔案ID／…`
- 每個 course action 請求：
  1. `apiKey`（SHA-256）比對登記表 → 對應到班（**登記表只存 hash，唔存明文**）
  2. 可另帶 `publicCourseId`／`courseId` 覆核（唔對應即拒絕）
  3. `SpreadsheetApp.openById(fileId)` 讀寫該班工作簿（rev 樂觀鎖照舊喺每班 `_Sync`）
- 明文 API Key 只出現喺：`createCourse` 回應（一次）＋隱藏保護嘅 `_Auth` 分頁
  （「從登記表選班」輸入班密碼後先取回）
- 每班密碼存 `_Auth`（冇行＝首次 1234）；錯 5 次鎖 10 分鐘（**按班獨立**，唔會跨班連坐）
- 寫入用 keyed lock（`CacheService`）減少同班撞車；防覆蓋最終靠每班 `_Sync` rev

## 合約變更（對區管理系統／成員系統）

- **所有既有 action 回應格式零改變**（`getCourseSummary`／`setPaymentCheck`／Budget 等照舊）。
- 新制班嘅「Script URL」全部＝同一條 hub `/exec`；區管理系統 CourseLinks 靠
  `publicCourseId` 對應（登記表自動有）。
- 新增：`hubInfo`（診斷）、`importCourse`（舊班登記入原點，後台帳密）。
- `createCourse` 回傳 `exec`＝hub /exec；新增可選 `sessions`（節次預填）。
- `listCourses` 冇開班碼時只回公開資料（班名＋公開課程ID）——同舊制一致。

## 舊班／舊制相容

- 舊制逐班部署嘅班**完全唔受影響**：前端「🔧 進階／舊班：手動連線」照舊貼該班 /exec＋key。
- 想舊班都出現喺「從登記表選班」：後台 `importCourse`
  `{ adminUser, adminPassword, fileId, apiKey, scriptExecUrl, name?, publicCourseId? }`
  ——登記表會保留該班自己嘅 /exec；選班時 hub 會 proxy 驗證後回傳該班連線資料。
- 舊班用 `connectCourseByPassword` 揀到時，密碼驗證會 proxy 去該班自己嘅 `/exec`（同舊 CourseFactory 行為一致）。

## 故障排查

| 症狀 | 處理 |
|---|---|
| 「訓練班系統 GS 未 run setup()」 | 喺 GAS 編輯器手動 run `setup()` 再重新部署 |
| 開班話「欠缺模版／資料夾」 | run `setupTemplate()`；查 `_Meta` 分頁有冇「模版檔案ID／資料夾ID」 |
| 模版要改版面 | 改 `CourseHub.gs`〔一〕模版規格段 → run `setupTemplate()`（只會補缺，唔會覆蓋已有班） |
| 班職員忘記密碼 | 後備管理員喺密碼格輸入「帳號:密碼」（常數喺 CourseHub.gs）→ 設定頁改密碼 |
| 要重設某班密碼 | 刪 `_Auth` 分頁該班行嘅「密碼hash」格 → 該班回復 1234＋firstLogin |
