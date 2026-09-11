# 任務書：將訓練班系統改成「一張訓練班系統 GS 做原點」

> 狀態：**✅ 已實作**（2026-09-11，見文末「完成記錄」；餘下＝真 GAS 煙霧測試＋區／成員系統跟進）
> 日期：2026-09-11 ・ 分支：`arena/01a08fe2-course`
> 前置閱讀：[`README.md`](../README.md)、[`docs/API.md`](API.md)、[`docs/course-lifecycle-multi-course.md`](course-lifecycle-multi-course.md)、[`apps-script/CourseFactory.gs`](../apps-script/CourseFactory.gs)、[`apps-script/COURSEV5-UPGRADE.md`](../apps-script/COURSEV5-UPGRADE.md)

---

## 1. 目標（一句講晒）

將訓練班系統改成**「一張訓練班系統 GS 做原點」**：

- 開**一張** Google Sheet（下稱「訓練班系統 GS」），貼好訓練班系統 Apps Script，**部署一次**；
- 手動 run 一次 **`setup`**，系統自動建立／整理所需分頁、設定、訓練班登記表、template 結構及必要欄位；
- 之後每個訓練班嘅 CL 只係喺前端按「🆕 新開班」，填**課程資料**（課程名稱、班領導人、名額、收費、節次、預算、通告等）；
- **唔需要**再貼 template id、folder id、Script URL、API Key；**唔需要**逐班部署 Apps Script；
- 每班 Sheet 由訓練班系統 GS **自動產生和登記**；
- 由**同一個**訓練班系統 backend `/exec` 根據內部 **courseId / publicCourseId / API Key** 對應，讀寫正確班別。

### 現況痛點（點解要改）

| 現況 | 問題 |
|---|---|
| `CourseFactory.gs` 係獨立專案，「設定」分頁要人手貼**模版GS檔案ID**、**開班文件資料夾ID**、**課程API網址** | 每次換區／重建都要人手貼 ID，易錯 |
| 模版「開班文件_Template」要技術同事預先做好放 Drive | /setup 唔能自我完成，依賴外部資產 |
| 每班 GS 連 bound script 一齊 copy，理論上要逐班處理 Script（`ensureApiKey` bootstrap、Properties） | 逐班部署／維護成本；registry 仲明文存 apiKey |
| 班密碼存喺每班 bound script 嘅 Script Properties | 共用後端時行唔通；要重新設計存放位 |

---

## 2. 目標架構

```
┌────────────────────────────────────────────────────────────┐
│  訓練班系統 GS（唯一原點；一張 Spreadsheet）               │
│  ├─ 設定            （A欄 label／B欄 value；setup 自動種） │
│  ├─ 訓練班登記      （每班一行；對帳／選班／對應之源）     │
│  ├─ _Auth（隱藏）   （每班密碼 hash；lockout 記 Cache）    │
│  └─ _Meta（隱藏）   （模版檔案ID／資料夾ID／版本；自動寫） │
└──────────────┬─────────────────────────────────────────────┘
               │ bound Apps Script（CourseHub；部署一次）
               ▼
      唯一後端 /exec ──────────────────────────────────────┐
   hub actions：setup 狀態／createCourse／listCourses／     │
   connectCourseByPassword／admin*                          │
   course actions：getCourseSheetRaw／saveCourseBatch／     │
   addReg／setRegStatus／auth／setPassword／                │
   setPaymentCheck／getCourseSummary／Budget 版本…          │
                                                          │
   對應規則（每個請求揾到唯一一班）：                       │
   apiKey（hash）→ registry 行 → fileId                   │
   courseId（內部）／publicCourseId ＋ apiKey 驗證 → 同一行 │
                                                          ▼
                              Drive「訓練班文件」資料夾（setup 自動開）
                              ├─ 開班文件模版（setup 自動起；隱藏／勿動）
                              ├─ A 班（開班文件）.gsheet   ← createCourse 自動產生＋登記
                              ├─ B 班（開班文件）.gsheet
                              └─ …
```

前端（本 repo）只認**一個** `/exec`（訓練班系統 GS 嘅部署）；入邊一切班別對應由後端用
`apiKey / courseId / publicCourseId` 完成。CL／職員全程**零技術欄位**。

---

## 3. 設計決定（執行前要守住）

### D1. `setup()` 做乜（手動 run 一次；幂等）

`setup()` 喺 GAS 編輯器手動執行（首次會彈授權），做完以下全部嘢，**重複 run 唔會重複建／唔會覆蓋已有資料**：

1. **原點 GS 分頁**
   - `設定`：A/B 兩欄，自動種預設行（全部可留空都有默认行為）：
     | A欄 | B欄預設 | 說明 |
     |---|---|---|
     | 成員系統報名網址 | （空） | 有值先組 direct registration link |
     | 區管理電郵 | （空） | 有值先自動分享新班 GS |
     | 開班碼 | （空） | 留空＝開新班免碼（維持現行政策） |
     | 模版檔案模式 | `auto` | `auto`＝setup 自建模版；`manual`＝用人手貼嘅檔案ID（逃生口） |
   - `訓練班登記`：表頭（見 D4），已存在就只補缺欄。
   - `_Auth`（隱藏）：表頭 `內部課程ID／密碼hash／改密碼時間`；每班首次密碼 `1234` 唔落表（冇行＝1234＋`firstLogin`）。
   - `_Meta`（隱藏）：`模版檔案ID`、`資料夾ID`、`模版版本`、`hub版本`、`setupAt`——**由 setup 自動寫，唔用人手貼**。
2. **Drive 資產（自動，唔用人手貼 ID）**
   - 起／搵返資料夾 `訓練班文件`（原點 GS 檔案嘅父資料夾隔壁；搵到同名就重用），ID 寫 `_Meta`。
   - 起「開班文件模版」GS（見 D2）；已存在（`_Meta` 有 ID 且檔案活著）就跳過，只驗分頁齊。
3. **自我登記**：寫 `_Meta!hub版本`、記錄 `setupAt`；喺 `設定` 補一行提示「本表由 setup 管理」。

> 验收：乜都冇嘅新 GS → 貼 script → 部署 → run `setup()` 一次 → 上面全部出現；再 run 一次 → 冇重複、冇覆蓋。

### D2. Template 結構由 code 定義，setup 物料化

- 新增 `apps-script/TemplateLayout.gs`：**數據驅動**嘅模版規格（每個分頁：名、欄數、表頭、固定文字、公式、闊度、隱藏與否、保護範圍）。座標**全部跟現行** [`docs/sheet-layouts.md`](sheet-layouts.md) ＋ [`js/00-config.js`](../js/00-config.js) 嘅 v4.13.0 對位，唔可以改座標：
  `Input01 訓練班預算`、`Input02 訓練班資料`、`Input03 時間表`、`Input04_Print支出表`、`表格回應`（53 欄至 BA）、`參數`、`Print_通告`、`Print_學員出席紀錄`、`Print_訓練班完成報告`、`Print_領取證書紀錄`、`_Sync`（隱藏，rev）。
- `setup()` 用呢份規格喺 Drive 起「開班文件模版」GS（一次）。公式欄（`表格回應` 旅號／學員編號、Input02 G 欄／B6 等）照模版寫入。
- **開新班仍然用 `makeCopy`**（快、公式／格式零漂移）；模版只係由「人手準備」變「setup 自動準備」。
- 模版規格同時係**前端 `mockBlankState()` 嘅正本**——兩邊必須同源（測試鎖住，見 §6）。

### D3. 共用後端路由（唔再逐班部署）

`CourseHub.doPost(e)` 一個入口，兩類 action：

1. **Hub actions**（唔需要班別對應）：`createCourse`、`listCourses`、`connectCourseByPassword`、`setParamLabel`、`adminListCourses`、`adminDeleteCourse`、`hubInfo`（新：回傳版本／模版版本，前端診斷用）。
2. **Course actions**（現行 coursev5 合約全部，**回應格式一字不改**）：先 `resolveCourse_(b)` 再行原邏輯：
   - `resolveCourse_(b)`：優先用 `apiKey`（SHA-256 後對 `訓練班登記` 嘅 hash 欄；`CacheService` 記 `hash→row` 加速）；冇 key 就用 `courseId`／`publicCourseId` 搵行再强制驗 key。
   - 攞到 `fileId` → `SpreadsheetApp.openById(fileId)` → 將現行所有 handler 改成**接收 `ss` 參數**（唔好再 `getActiveSpreadsheet()`）。
   - **鎖**：唔好用全域 `ScriptLock`（會令 A 班儲存塞住 B 班）——用 `CacheService` 做 keyed mutex（`lock_<courseId>`，spin＋超時），语义等於現行每班自己嘅 ScriptLock。
   - **rev**：照舊喺每班自己嘅 `_Sync`（baseRev 驗＋bump），合約不變。
3. **向下相容**：`訓練班登記` 留一欄「Script /exec（舊班）」——舊制逐班部署嘅班可以 `importCourse`（admin）登記入嚟；`connectCourseByPassword` 見到該行有自己嘅 exec 就照舊 proxy 去該班 `/exec`（現行 `UrlFetchApp` 邏輯），新班則 hub 內部直接驗證。舊班前端手動貼 `/exec + key` 亦照舊支援（前端唔刪手動連線）。

### D4. 訓練班登記（新版表頭）

`訓練班登記` 分頁（setup 建；寫入一律經 keyed lock）：

| 欄 | 內容 |
|---|---|
| 內部課程ID | `crs_…`（registry 主鍵；**前端／人永遠唔使見**） |
| 公開課程ID | `crs_` publicCourseId（對成員系統／區管理系統，維持現制） |
| 課程名稱 | |
| API Key hash | SHA-256（**唔再明文存 key**——修正現行安全弱點；明文只喺開班回應出現一次） |
| GS檔案ID | 每班 Sheet |
| GS網址 | |
| Script /exec（舊班） | 舊制班先有值；新班留空＝行 hub |
| 狀態 | active／completed／archived |
| 班領導人 | |
| 建立時間 | |

### D5. 每班密碼／認證存放（共用後端版）

- 密碼 hash 存原點 GS `_Auth` 分頁（`內部課程ID → pwHash`）；冇行＝首次密碼 `1234`，`auth` 回 `firstLogin:true`（同現制一致）。
- `setPassword` 驗舊密碼後寫 `_Auth`（≥4 位、≠1234、唔含 `:`——維持現規則）。
- 防爆鎖：`CacheService` 以 `pwlock_<courseId>` 計，錯 5 次鎖 10 分鐘（每班獨立，唔會跨班連坐）。
- 後備管理員：維持「帳號:密碼」寫喺 Script 常數（hub 全域一個），只出現喺代碼。
- `_Auth` 分頁加保護（`setProtectedRanges`，只 script 身分可寫），`listCourses` 永遠唔回傳任何密碼相關欄。

### D6. `createCourse`（新開班）＝填課程資料，零技術欄位

請求體維持現行欄位＋擴充（全部可選，除 `courseName`）：

```
{ action:'createCourse', masterKey?, courseName, edition?, section?, badge?,
  intake?, fee?, clName?, clTitle?,
  sessions?[ {date,time,venue,onNotice} ],      // 節次（新；寫 Input02 9–16 行）
  budget?,                                        // 預選：留俾 CL 入班後喺預算頁填（建議默认）
  notice? }                                       // 預選：通告可編欄位
```

後端流程（全部 hub 內部）：`makeCopy` 模版 → 改名「{課程名}（開班文件）」→ 放入 `_Meta` 資料夾 →
（可選）share 區管理電郵 → 寫 `_Sync!A5` bootstrap key **改為直接寫登記表 hash**（共用後端唔再需要 bound script adopt；`_Sync!A5` 機制留返俾舊班）→ 預填 Input01/02 基本資料（沿用現行座標）＋如有 `sessions` 寫 Input02 節次 → 寫 `參數`（區會批准／訓練班電郵／公開課程ID／直接報名連結）→ `訓練班登記` 加行 → 回傳：

```
{ ok, data:{ exec:<hub /exec>, apiKey, courseId:<fileId 維持前端相容>,
  publicCourseId, directRegUrl, courseName, url, firstLogin:true } }
```

> CL 體驗：新開班表單→入班（首次 1234）→ 跟住照現行一條龍喺 APP 填**預算（66/60 頁）／節次（60 頁）／通告（61 頁）**。
> 「節次／預算／通告」嘅完整輸入繼續用現成頁面（防呆／草稿／衝突機制全部保留）；新開班表單只負責即時可填嘅核心資料。
> *備選（如產品決定要單頁精靈）：`createCourse` 接受 `sessions` 批次寫入——後端預留咗參數，前端二期先做。*

### D7. 前端改動範圍（本 repo）

| 檔案 | 改動 |
|---|---|
| `js/50-ui.js` | 連線畫面：新增「**訓練班系統 /exec**」單一欄位（存入 `Store.config.hubExec`），「🆕 新開班」同「📚 從登記表選班」改讀佢；現行「區會開班網址／管理碼」欄位收合做進階／舊班入口（保留手動貼 /exec+key 做舊班相容）。新開班表單補「節次」提示文案（入班後填），其餘欄位不變。 |
| `js/20-store.js` | `Store.config` 加 `hubExec`；`addCourse` 對 hub 班記 `via:'hub'`。 |
| `js/10-api.js` | 唔改合約；只係所有 hub 班 `exec` 都係同一條。 |
| `js/15-mock.js` | Mock 改做 hub 語義：單一 `exec:'mock'`＋registry；`createCourse` 用 `mockBlankState`（＝D2 模版規格嘅前端鏡像）；班密碼按班存；`connectCourseByPassword` 內部驗證（唔再模擬 proxy）。 |
| `js/68-guide.js` | 教學頁更新：「開一張 GS → 貼 script → run setup → 完成」新制步驟。 |
| `docs/API.md`、`README.md`、`docs/course-lifecycle-multi-course.md` | 更新連線／開班章節；標明舊制只做相容。 |

### D8. 跨系統影響（本次唔改佢哋嘅倉，但要凍結合約）

- **區管理系統（scout-district-portal）**：CourseLinks 現時逐班記 Script URL；新制下所有班 Script URL＝hub `/exec`，對應改靠 `publicCourseId`＋apiKey。`getCourseSummary`／Budget 批核 action 合約不變，照樣經 hub。
- **成員系統（member-portal）**：`addReg` 經 direct link（已帶 `courseId=publicCourseId`）→ hub 必須支援**只憑 `publicCourseId`＋提交來源**寫入正確班（addReg 現行免班密碼；沿用，但 hub 要防偽：addReg 只接受寫入 `表格回應`，唔回傳任何既有資料）。
- 呢兩項寫入 `docs/API.md`「hub 對應規則」章節，等兩個系統跟住做。

---

## 4. 工作分解（下一個對話嘅執行次序）

| # | 階段 | 產出 | 涉及檔案 |
|---|---|---|---|
| P0 | 凍結模版規格 | `TemplateLayout.gs` 數據（同 `00-config.js`／`sheet-layouts.md` 座標逐項對帳）＋`mockBlankState` 對齊 | `apps-script/TemplateLayout.gs`（新）、`js/15-mock.js` |
| P1 | Hub 骨架＋`setup()` | `CourseHub.gs`（doPost 分發＋resolveCourse_＋keyed lock）、`Setup.gs`（D1 全部） | `apps-script/CourseHub.gs`、`apps-script/Setup.gs`（新） |
| P2 | Course actions 遷入 hub | 將 coursev5 handler 全部改成 `fn(ss, b)`：getCourseSheetRaw／saveCourseBatch／addReg／setRegStatus／addExpenseRow／setCompletionRow／setCertRow／PaymentCheck／Refund／RegNotice／Summary／BudgetVersions | `apps-script/*.gs` 重構（保留舊檔做參考） |
| P3 | 班密碼 `_Auth` | D5：auth／setPassword／lockout keyed by courseId；`connectCourseByPassword` 改內部驗證（舊班行先 proxy） | `apps-script/CourseHub.gs`、`Auth.gs` 邏輯併入 |
| P4 | `createCourse` 新版 | D6：makeCopy→預填→登記→回傳；`adminDeleteCourse` 改用新登記表；`importCourse`（舊班登記） | `apps-script/CourseHub.gs` |
| P5 | 前端簡化 | D7 表；新開班／選班只認 `hubExec`；舊制入口收做進階 | `js/50-ui.js`、`js/20-store.js`、`js/68-guide.js` |
| P6 | Mock＋合約測試 | `tests/t_hub.js`（新）：路由對應、班隔離、密碼、addReg by publicCourseId、setup 幂等（mock 層）；`run_all.js` 接納 | `tests/*`、`js/15-mock.js` |
| P7 | 文檔＋验收 | 更新三份文檔；行 §7 验收清單；手動真 GAS 煙霧測試一次（setup→開班→入數→登記表對帳） | `README.md`、`docs/*` |

> 紀律：P2 期間**所有既有回應格式零改變**（區／成員系統唔使同步改）；每個階段結束 `node tests/run_all.js` 必須綠。

---

## 5. 合約變更摘要（`docs/API.md` 要同步）

| 項 | 變更 |
|---|---|
| 傳輸 | 不變（POST /exec、text/plain、JSON） |
| 所有 course actions | 參數／回傳**不變**；新增可選 `courseId`／`publicCourseId`（apiKey 仍必須；三者對應同一班） |
| `createCourse` | 改由 hub 處理；回傳 `exec`＝hub /exec；新增可選 `sessions`；`courseId` 回傳維持 fileId（前端相容） |
| `listCourses` | 回傳結構不變；無管理碼時照舊只回公開資料 |
| `connectCourseByPassword` | 新班＝hub 內部驗證；舊班行（有自己 exec）＝proxy（行為不變） |
| `hubInfo`（新） | `{ok, data:{hubVersion, templateVersion, setupAt, courses:{active,archived}}}`——前端診斷／教學頁用 |
| `importCourse`（新，admin） | 舊制班登記入 `訓練班登記`（`fileId`＋`publicCourseId`＋其 /exec） |
| rev／密碼／防呆語義 | 全部不變（`docs/API.md` rev 章節原文保留） |

---

## 6. 測試計劃

1. **现有 34 項合約測試**（`tests/*`）必須全綠——證明 course 合約零漂移。
2. 新增 `tests/t_hub.js`：
   - `resolveCourse_`：apiKey hash 對應、publicCourseId＋key、錯 key 拒絕、跨班讀唔到；
   - 班隔離：A 班 `saveCourseBatch` conflict 唔影響 B 班；兩班獨立 rev／密碼／草稿；
   - `_Auth`：首次 1234＋`firstLogin`、改密碼規則、錯 5 次鎖（按班）；
   - `addReg` 只憑 `publicCourseId` 入正確班、唔回傳既有報名資料；
   - `createCourse` 預填座標（Input01 B1/B4/B5/B6/B11/B12、Input02 B1/B4/B5/A23-C23）同 `TemplateLayout` 一致；
   - `mockBlankState` ≡ `TemplateLayout`（欄數／表頭／必要格逐項比對）。
3. **手動煙霧（真 GAS）**：新 GS → run `setup`（兩次，驗幂等）→ 部署 /exec → 前端新開班 → 入班改密碼 → 填預算／節次 → 開第二班驗隔離 → `adminDeleteCourse` 清開錯班。

---

## 7. 验收清單（Definition of Done）

- [ ] 全新 Google Sheet：貼 script → 部署一次 → 手動 run 一次 `setup` → `設定`／`訓練班登記`／`_Auth`／`_Meta`＋Drive 資料夾＋模版 GS 全部自動出現；人手**零貼 ID**。
- [ ] 重複 run `setup` 無副作用（唔重複建、唔覆蓋資料）。
- [ ] CL 喺前端「🆕 新開班」只填課程資料（名稱／班領導人／名額／收費／屆別／支部／專章），即時起真 GS＋自動登記；全程無 template id／folder id／Script URL／API Key 欄位。
- [ ] 每班無任何 Apps Script 部署；所有讀寫經同一個 `/exec`，靠 courseId／publicCourseId／API Key 對應。
- [ ] 多班並行：獨立密碼、獨立 rev、獨立鎖；互不阻塞。
- [ ] 成員系統 `addReg`（direct link 帶 publicCourseId）寫入正確班。
- [ ] 舊制班（逐班部署）仍可手動貼 `/exec + key` 連線；可用 `importCourse` 登記。
- [ ] `登記表` 唔再明文存 API Key（改存 hash）。
- [ ] `node tests/run_all.js` 全綠（含新 `t_hub.js`）。
- [ ] README／API.md／course-lifecycle 文件已改成新制描述。

---

## 8. 風險與對策

| 風險 | 對策 |
|---|---|
| `setup` 一次過起成份模版（105 行 Input01＋公式）逼近 GAS 6 分鐘時限 | `setup()` 拆 segment（原點分頁／資料夾／模版各一段，可獨立重入）；模版只起一次 |
| 模版公式/座標漂移 | P0 先凍結 `TemplateLayout`，同 `00-config.js`、`sheet-layouts.md` 三方對帳＋測試鎖 |
| 單一 /exec 吞吐量（多班＋15 秒輪詢＋成員系統報名） | 讀 action 純讀唔加鎖；keyed lock 只包寫；十幾班規模內足夠，超額先再拆區域部署 |
| `getActiveSpreadsheet()` 殘留導致寫錯簿 | P2 全面改 `fn(ss, b)`；加 lint 式檢索（`grep getActiveSpreadsheet` 必須只出現喺 hub 入口） |
| 明文 API Key 遺留 | 登記表改存 hash；舊行一次性遷移（setup 整理時自動 hash 化） |
| 區／成員系統未同步 | 合約零變更＋`publicCourseId` 對應；佢哋唔改都照行（舊班行仲有自己 exec） |

## 9. 明確唔做（本次範圍外）

- 唔改區管理系統／成員系統倉庫（只凍結合約）。
- 唔改 Print 分頁版面、唔改 rev／防呆語義。
- 唔做「新開班單頁精靈」（節次／預算／通告一次填晒）——預留 `createCourse.sessions` 參數，二期再議（見 D6 備選）。

---

## ✅ 完成記錄（2026-09-11）

> 📌 部署形態修訂（2026-09-11，用家要求）：**後端合成單一檔案**——四段全部併入
> `apps-script/CourseHub.gs`（〔一〕模版規格・〔二〕setup・〔三〕路由／開班／登記・〔四〕每班合約），
> 貼一個檔案、run 一次 `setup()`、部署一次即完成；唔再分四個 .gs。

| 階段 | 產出 | 狀態 |
|---|---|---|
| P0 | `CourseHub.gs`〔一〕模版規格段（純數據；同 `00-config.js`／`sheet-layouts.md` 對帳，由 `tests/t_hub.js` 鎖住） | ✅ |
| P1 | `CourseHub.gs`〔二〕（`setup()`／`setupTemplate()`／`setupRegistry()`，幂等；自動建分頁＋資料夾＋模版，ID 全自動寫 `_Meta`）＋〔三〕（doPost 路由＋`hubRequireCourse_` 對應＋keyed lock） | ✅ |
| P2 | `CourseHub.gs`〔四〕（coursev5 全部 action 改 `fn(ss, b)`：raw／profile／summary／batch／addReg／listRegs／setRegStatus／addExpenseRow／completion／cert／paymentCheck／refund／regNotice／Budget 版本） | ✅ |
| P3 | `_Auth` 隱藏保護分頁（每班密碼 hash＋明文 key 復原）；鎖按班獨立；後備管理員常數 | ✅ |
| P4 | `createCourse` 新版（三件套＋`sessions` 預填＋登記表只存 hash）；`adminDeleteCourse`／`adminListCourses` 新登記表版；`importCourse` 舊班遷移；`hubInfo` | ✅ |
| P5 | `js/50-ui.js`（新開班／選班／後台改認 `hubExec`；手動連線收做「進階／舊班」）、`js/20-store.js`（`via`）、`js/68-guide.js`（全流程／FAQ／管理層版改新制） | ✅ |
| P6 | `js/15-mock.js` hub 語義（單一 mock /exec＋登記表＋`addReg` by publicCourseId＋舊班 proxy）；`tests/t_hub.js` 84 項 | ✅ |
| P7 | `apps-script/COURSEHUB.md` 部署指南＋`docs/API.md`／`README.md`／`course-lifecycle` 更新 | ✅ |

**測試**：`node tests/run_all.js` 4 檔全綠（19＋84＋102＋63＝268 項）。

**仍須人手做（本環境無真 GAS）**——真機煙霧清單：
1. 新 GS → 貼**一個檔案**（`CourseHub.gs`）→ run `setup()`（两次，驗幂等）→ 部署 /exec（`GET /exec` 回 `hubInfo`）。
2. 前端填一條 /exec → 新開班 → 驗新班 GS 已起＋登記＋入班（1234→改密碼）。
3. 開第二班驗隔離（獨立 rev／密碼／鎖）；成員系統 `addReg`（direct link）驗流入正確班。
4. `importCourse` 登記一個舊制班 → 「從登記表選班」驗 proxy。
5. 後台清理開錯班（可選移垃圾桶）。
