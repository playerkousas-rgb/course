# coursev5 升級套件（v5.0.0）

> **新版名：`coursev5`**（v5.0.0）——同舊版 `Code.gs.course.js`（v4.13.0）明確區分，唔會撈亂。
> 目標：一套 course GS 三邊共用——① 訓練班管理系統（本 repo）② 區管理系統 scout-district-portal ③ 成員系統 member-portal。
> 設計原則：**只加唔改**——所有既有 action 回應格式原封不動，舊成員系統 `addReg` 完全不受影響。

## 新增咗乜

| 項目 | 內容 |
|---|---|
| `auth` action | 共職員密碼驗證（每班第一次登入 `1234`，回 `firstLogin:true` 俾前端提示改密碼） |
| `setPassword` action | 改密碼（驗舊密碼；新密碼 ≥4 位、≠1234） |
| 後備管理員 | 密碼格輸入「帳號:密碼」登入／重設——**只寫喺 `Auth.gs` 頂部常數，其他地方一律唔顯示** |
| 防爆 | 同一課程錯 5 次 → 鎖 10 分鐘（CacheService） |
| 版本識別 | `auth` 回應帶 `v:'5.0.0'`；前端亦可偵測「有冇 auth action」分辨新舊後端 |
| `setPaymentCheck` action | 區管理系統核對區帳戶後 tick「表格回應」AS-AU（已核對收款/核對人/核對時間）；identity 定位、唔 bump rev、首次自動補表頭 |
| STA 收表 | AV/AW 兩欄（已交表格正本✔/收表記錄）——班職員 APP 收表時經 `saveCourseBatch` 寫，唔使另外加 action |

## 安裝步驟（每班 GAS 專案，或改完模版之後全區生效）

1. **加檔案**：GAS 專案左欄「＋」→ 新增 `Auth.gs` **同 `PaymentCheck.gs`** → 貼入本 repo `apps-script/` 對應檔全文
2. **加路由**：喺 `Code.gs.course.js` 嘅 `doPost` 分發處（**驗完 apiKey 之後**，同其他 case 一齊）加：
   ```js
   case 'auth':            return doAuth_(msg);
   case 'setPassword':     return doSetPassword_(msg);
   case 'setPaymentCheck': return doSetPaymentCheck_(msg);
   ```
   （如果 doPost 係 if/else 寫法，就照原有格式加同等兩句）
3. **部署**：部署 → 管理部署 → ✏️ 編輯 → 建立新版本
4. **欄位上限檢查**：`setCourseCells`／`saveCourseBatch` 嘅座標驗證如果限制欄號上限（例如 26/30），改做 **60**（新欄去到 AW=49）
5. `getCourseSheetRaw_` 嘅 dump 清單加一行（簽到/點名頁要讀）：
   ```js
   attend: dump('Print_學員出席紀錄'),
   ```

## 同步入區管理系統（scout-district-portal）

建議存放結構（避免同舊版撈亂）：

```
gs/
  Code.gs.course.js      ← 舊版 v4.13.0（唔郁，舊班照用）
  coursev5/
    Code.gs.course.js    ← 舊版原文 ＋ 上面第 2 步嗰兩行 router（第 4 步一行如有）
    Auth.gs              ← 本 repo apps-script/Auth.gs
    VERSION.txt          → 5.0.0（coursev5）
```

區管理系統開新班時改用 `coursev5/` 模版；舊班想升級就照「安裝步驟」逐班加（约 2 分鐘）。
三邊適配點：
- **訓練班管理系統（本 repo）**：已支援——`auth` 通 → v5 流程（首次登入提示改密碼）；冇 `auth` → 自動退回舊版本機閘（完全向下相容）
- **區管理系統／成員系統**：唔需要即刻改（所有舊 action 原封不動）；想 feature-detect 就試 call `auth`

## CL 起表（CourseFactory，取代舊版 CS 起表）

由 coursev5.1 起，起表工序由 APP 發動——**新開班即刻起真 GS**（區管理系統嘅 SCRIPT 要攞到 GS URL 先連結到工作簿觀看訓練班資料批核，所以 GS 唔可以遲開）：

1. **即刻起表**：CL 喺連線畫面「🆕 新開班」填課程名／屆別／支部／專章／收生／收費／班領導人 → 呼叫區級 `CourseFactory.gs`（`apps-script/CourseFactory.gs`，獨立專案部署一次）→ 喺區 Drive copy 開班文件模版＋預填＋產 apiKey → APP 即刻連線（首次密碼 1234），CL 複製 **GS URL 交區管理系統**
2. **CL 填寫**：喺 APP 填晒預算／節次／時間表／通告——全部直接寫入 GS（區管理系統隨時連結觀看）

之後掛載流程（訓練班系統連結三方：**成員・管理・訓練班**）：

- **批核歸訓練班系統**：區管理層透過區管理系統連結觀看訓練班資料批改，OK 就 tick 訓練班 GS 參數分頁「**區會批准**」格——CL 喺 APP 見到 ✔（15 秒自動更新）先生成通告交**區網頁管理員**
- **區管理系統只管連結＋紀錄**：佢自己 SHEET 分頁貼訓練班 SCRIPT URL・訓練班 Drive（付款證明）・區網頁通告 URL，之後自動填寫內容**掛載到成員系統**——呢啲分頁同訓練班系統完全無關，訓練班呢邊唔使理
- **掛載信號**：成員系統掛載後報名自動流入訓練班 RESP——APP 見到報名＝報名進行中

### 課程 Script 要加嘅一段（apiKey bootstrap）

模版 GS 連 bound script 一齊 copy，但 Script Properties（`API_KEY_HASH`）唔會跟住 copy。喺 `doPost`／`doGet` 開頭加：

```js
function ensureApiKey() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('API_KEY_HASH')) return;
  const sync = SpreadsheetApp.getActive().getSheetByName('_Sync');
  const k = sync ? String(sync.getRange('A5').getValue() || '').trim() : '';
  if (k) {
    p.setProperty('API_KEY_HASH', sha256hex(k));   // 同 Auth.gs 用嘅 hash 函數
    sync.getRange('A5').clearContent();            // bootstrap key 用完即清
  }
}
```

流程：CourseFactory 起新班時將 apiKey 寫 `_Sync!A5` → 課程 Script 第一次收到請求就 adopt（hash 入 Properties、清 A5）→ 之後同一般班完全一樣。CL 唔使接觸任何 key 設定。

### 部署清單（區管理層，一次）

1. 開新 Apps Script 專案 → 貼 `CourseFactory.gs` → 填 Script Properties（`FACTORY_KEY_HASH`／`TEMPLATE_FILE_ID`／`FOLDER_ID`／`COURSE_API_EXEC`）
2. 模版 GS 嘅 bound script 加 `ensureApiKey()`（上面嗰段）
3. 部署 CourseFactory 做網頁應用程式（任何人）→ `/exec` 網址＋開班碼發俾 CL
4. CL 開 APP → 🆕 新開班 → 🏛 連區會起表（即刻開真 GS）→ 複製 GS URL 交區管理系統 → 喺 APP 填晒所有嘢

### 多班共用 API（可選）

唔想逐班部署 `/exec` 的話，可以擴充 CourseFactory 做共用 Course API：`COURSES_REGISTRY` 記 `{apiKey → fileId}`，所有 action 用 `SpreadsheetApp.openById(fileId)` 行同一套 router。十幾班規模都其實逐班部署都夠。

## 密碼規則一覽

- 每班第一次登入：`1234`（前端會即刻彈「請設定新密碼」，可以稍後，下次登入會再提示）
- 改密碼：設定 ⚙️ → 🔑 更改密碼（要入現時密碼；新密碼至少 4 位、唔可以用 1234）
- 忘記密碼：後備管理員喺密碼格輸入「帳號:密碼」入去，再去設定改密碼（用「帳號:密碼」做現時密碼）
- 徹底重設：GAS 編輯器手動 run `resetCoursePassword()`（即時回復 1234），或刪 Script Properties 嘅 `COURSE_PW_HASH`
- 密碼以 SHA-256 hash 存 Script Properties（`COURSE_PW_HASH`），明文唔會落地

## 相容性

- 舊版 `Code.gs.course.js`（v4.13.0）班 workbook **唔加嘢都照常用本前端**——解鎖退回本機密碼閘（1234）
- `addReg`／`listRegs`／`setRegStatus`／`getCourseSheetRaw`／`saveCourseBatch` 等全部回應格式冇變
- `Auth.gs` 唔會寫任何 Sheet 格；密碼錯誤鎖用 CacheService（6 小時自動失效）
