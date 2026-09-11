# CourseHub 部署指南（一張訓練班系統 GS 做原點）

> 取代舊制「每班一個 bound script＋逐班部署」。由 v6.0.0 起，成個訓練班系統
> 嘅後端＝**一張原點 GS＋一個 /exec**：開班／登記／模版／讀寫全部由佢自動做。
> **後端只有一個檔案**（`CourseHub.gs`）——貼一次、run 一次 `setup()`、部署一次就完成。
> 前端（本 repo）合約零破壞；舊制逐班部署嘅班照舊相容（見尾段）。

## 一次過設定（區管理層／技術同事，約 10 分鐘）

1. **開一張新 Google Sheet**——呢張就係「訓練班系統 GS」（原點）。建議改名叫「訓練班系統」。
   ⚠️ **建議用專門嘅非機密帳戶**（例如區會「訓練班系統」帳戶）部署原點，唔好用任何人的
   機密個人帳戶——班 Sheet 嘅擁有權可以留喺各 CL 自己帳戶（見「擁有權與權限」），
   原點只係登記指針。
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

4. 「設定」分頁（setup 自動種好；密匙自動產生，**唯一一次**開張表抄低佢，之後唔使再開）：

   | A欄 | 用途 |
   |---|---|
   | 成員系統報名網址 | 有值先自動組 direct 報名連結（**正式用前記得填**，唔係冇通告報名連結） |
   | 區管理電郵 | 有值先自動分享新班 GS |
   | 開班碼／開班碼SHA256 | 預設留空＝開新班免碼（只會起空班、唔掂已有班）；填咗開班／登記先要碼 |
   | **區系統密匙／區系統密匙SHA256** | **setup 自動產生（`ops_` 開頭）**：交俾區管理系統，佢 tick「區會批准」、睇批核資料、付款核對、Budget 批核全部靠呢一條；全區共用、唔使逐班 key |
   | **後台帳號／後台密碼／後台密碼SHA256** | **setup 自動產生（帳號 `admin`、密碼 `adm_` 開頭）**：後台清理／後備管理員登入用；**唔再寫死喺 code**。抄低後當密碼保管；遺失可再開呢張表睇，或 Logo 連按 7 下之後台用舊密碼登入喺 `secrets` 取回 |
   | FPS 識別碼／FPS 戶口名稱／區會網址 | 按需填，自動寫入每班參數（通告／收費用） |
   | 模版檔案模式 | `auto`（預設）；`manual`＋另加「模版GS檔案ID」行＝用人手模版（逃生口） |

   > 升級舊部署（v6.1 或之前）：重新貼新版 `CourseHub.gs` → 再 run 一次 `setup()`
   > （幂等，唔會覆蓋任何資料），新欄同密匙就會自動補上。舊嘅寫死帳密 `sheep/0728` 喺新版即時失效。

5. **部署 → 部署為網頁應用程式**（執行身分：我自己；存取：**任何人**）→ 攞 `/exec`。
   呢條就係全系統唯一後端網址（`hubInfo` 可驗證：`GET /exec`；版本應顯示 `6.2.0` 或以上）。

6. 將 `/exec` 派俾 CL、將「**區系統密匙**」交俾區管理系統（貼一次佢就用到所有班）。
   完事——**之後日常唔使再入 Apps Script／張表**。

## 日常運作

| 角色 | 做乜 |
|---|---|
| CL | 前端「🆕 新開班」填課程名／班領導人／班領導人電郵（選填）／名額／收費／屆別／支部／專章 → 新班 Sheet 自動產生＋自動登記（並自動 `addEditor` 班領導人）→ 即刻入班（首次密碼 1234）→ 喺 APP 填預算／節次／時間表／通告。另有第二條路：**自己帳戶開 Sheet 再登記**（見「擁有權與權限」） |
| CL（自己起表） | 「📥 我已有 Sheet，登記就得」：喺任何帳戶開空白 GS → Drive 分享（編輯者）俾原點帳戶電郵 → 貼網址登記 → 系統驗證、就地補齊模版結構（只補缺、唔覆蓋）＋生成三件套 |
| 班職員 | 「📚 從登記表選班」揀班名 → 輸入本班密碼 → 自動取回連線資料（唔使記 key／URL） |
| 區管理層 | 區系統設好一次 `opsKey`（區系統密匙）→ `getCourseSummary` 批核；`setParamLabel` tick 班 GS 參數「區會批准」；財務用 `setPaymentCheck`／`setCourseRefund`；Budget 用 `approveBudgetVersion`（全部 opsKey＋publicCourseId，唔使逐班 key） |
| 成員系統 | 通告 direct link（帶 `publicCourseId`）→ `addReg` 經同一個 /exec 寫入正確班 |
| 開錯班 | 首頁 Logo 連按 7 下 → 後台清理（用「設定」分頁嘅後台帳號／密碼；後台亦會顯示各密匙方便交接） |

## 擁有權與權限（Sheet 喺邊、點樣交出去）

> 立場：**登記表（原點）只係指針**。四點：
>
> 1. **原點 GS 永遠唔放班內容**——「訓練班登記」只存每班的指針（檔案ID／網址／
>    API Key hash／狀態），班嘅預算／報名／收支全部喺該班 Sheet 本身。
> 2. **班 Sheet 可以喺任何帳戶開**：`createCourse` 自動起嘅班放喺原點帳戶嘅
>    「訓練班文件」資料夾（方便區會統一管理）；`registerCourse` 就係為「唔想放喺
>    原點帳戶」而設——CL 自己帳戶開空白 GS，登記後一切照用（結構自動補齊）。
> 3. **權限只靠逐個檔案嘅 Drive 分享（編輯者）俾原點帳戶電郵**——GAS 要 `openById`
>    讀寫該班，呢個權限係必須；但冇人需要交出帳戶密碼／轉移擁有權。
>    未分享就登記 → hub 回「原點帳戶讀唔到呢張 Sheet」提示。
> 4. **建議用一個專門嘅非機密帳戶部署原點**（例如「訓練班系統」帳戶），
>    唔好用任何人的機密個人帳戶做原點——咁样「分享俾原點」係分享俾一個制度帳戶，
>    唔涉及私人資料。原點帳戶電郵喺 `hubInfo` 嘅 `ownerEmail` 回傳，
>    前端「查原點電郵」一掣攞到。

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
- `createCourse` 回傳 `exec`＝hub /exec；可選 `sessions`（節次預填）；
  可選 `clEmail`（班領導人電郵）→ 新班 Sheet 自動 `addEditor` 佢（區管理電郵 `opsEmail` 自動分享已有）。
- **新增 `registerCourse`**：登記 CL（或任何人有）嘅現有空白 GS——入參
  `url`／`fileId`＋`courseName?`／`clName?`／`clEmail?`／基本資料；hub 驗證讀取權、
  `hubRepairTemplate_` 就地補模版（只補缺、唔覆蓋）、生成三件套＋登記指針；
  回傳同 `createCourse` 再加 `registered:true`。重複登記同一檔案＝拒絕。
- `hubInfo` 回傳 `ownerEmail`（原點帳戶電郵）——CL 登記自己 Sheet 前照佢分享（編輯者）。
- `listCourses` 冇開班碼時只回公開資料（班名＋公開課程ID）——同舊制一致。

### v6.2 權限加固（區系統／成員系統對接重點）

- **區系統密匙 `opsKey`**：區管理系統唔使再儲逐班 apiKey——一條 `opsKey`（「設定」分頁，setup
  自動產生）＋`publicCourseId` 即可呼叫白名單 action：`getCourseProfile`／`getCourseSummary`／
  `listRegs`／`listBudgetVersions`／`setPaymentCheck`／`setCourseRefund`／`approveBudgetVersion`；
  其他 action（改班內容、改密碼等）一律拒絕。`setParamLabel`（tick「區會批准」／寫 FPS 參數）
  **必須**帶 `opsKey`（或舊開班碼 `masterKey`），CL 自己唔可以批准自己班。
- **成員系統 `addReg` 公開化（write-only）**：只帶 `publicCourseId` 就交得到報名，**唔使 apiKey**；
  內部 `courseId`／`fileId` 唔受理；回傳淨係 `{ok, refCode}`，唔會讀返任何班資料。
  節流：每班每 10 分鐘 20 個提交（超額回「報名系統繁忙」），防惡意提交塞爆原點 Drive；
  `archived`／`completed` 班拒收。公開ID 為隨機 ID，估唔到其他班；所有提交入 pending，CL 逐筆批核。
- **首登強制改密碼**：新班／新登記班未改 `1234` 前，寫入 action 一律回
  `{ok:false, mustChangePassword:true}`；`auth`／`setPassword`／讀取／`addReg` 例外。
- **後台帳密搬遷**：由 code 常數改為「設定」分頁（setup 自動產生）；`adminListCourses`
  新增 `data.secrets`（後台登入後先有）——日後交接唔使開張表都可以攞返 `opsKey`／後台密碼。
- hub 版本號：`hubInfo.hubVersion`＝`6.2.0`（對照 `CourseHub.gs` 嘅 `HUB_VERSION`）。

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
| 班職員忘記密碼 | 後備管理員喺密碼格輸入「後台帳號:後台密碼」（喺「設定」分頁，或後台 `secrets`）→ 設定頁改密碼 |
| 要重設某班密碼 | 刪 `_Auth` 分頁該班行嘅「密碼hash」格 → 該班回復 1234＋firstLogin |
| `registerCourse` 話「原點帳戶讀唔到呢張 Sheet」 | 未分享／分享唔啱級別：喺 Drive 將該班 Sheet **分享（編輯者）**俾原點帳戶電郵（`hubInfo.ownerEmail`；前端「🔎 查原點電郵」）再重新登記 |
| 登記話「該 Sheet 已登記」 | 同一張 Sheet 只能登記一次；去「📚 從登記表選班」用該班名＋密碼入就得（或後台 `adminDeleteCourse` 刪指針後重新登記） |
