# 🎓 訓練班管理系統（新版）

> 取代舊有「人手填 Sheet + 紙本」流程嘅**一條龍訓練班管理前端**：
> **開班文件 → 通告 → 收生 →（下一階段）點名・時間表・收支・證書・報告**
>
> 純前端（無 server、無登入系統）；資料直接同**每班 Google Sheet 工作簿**（Apps Script Web App）對話。
> 班職員共用一個密碼（預設 `1234`）進入；防呆機制令多位職員可以同時處理而唔會互相覆蓋。

---

## 🗺️ 喺成個生態嘅位置

```
區管理系統 scout-district-portal（開班登記・批核・CourseLinks）
      │ 每班一張工作簿（Code.gs.course.js 模版 setupCourseSheet 起表）
      ▼
CL 開新 Sheet → 貼 Script → 一鍵建表 → 部署 /exec → 交 API Key 俾 ADC
      │
      ├─ 成員系統 member-portal /training → 報名（addReg）→ 寫入「表格回應」＋入數紙存 Drive
      │
      ▼
★ 本 APP（course repo）：職員由頭到尾管理呢一班
      ① 開班文件（Input01 預算 + Input02 班資料）  ← 新版改喺系統內填
      ② 通告（自動組版預覽＋列印 PDF）              ← 跟舊流程交區網/總會
      ③ 收生確認（接納/拒絕/取消・批量・入數紙對單）
      ④ 學員名單（學員編號・分組・CSV・列印）
      ⑤〔下一階段〕出席點名・時間表・收支表・完成報告・證書領取
```

## ✅ 第一階段功能（本 repo 現況）

| 模組 | 內容 |
|---|---|
| 🔗 連線 | 支援 `?exec=…&key=…&name=…` 網址參數（一按即入，可出 QR／WhatsApp 俾其他職員）；亦可以手動貼 /exec＋API Key；多班切換 |
| 🔓 解鎖 | 共用密碼（預設 1234，本機可改）＋ 揀自己個名（讀 Input02 職員表；冇嘅手填） |
| 📊 儀表板 | 開班一條龍進度 checklist、課程資料、收生統計（名額進度條）、節次、職員 |
| 📝 開班文件 | Input01 預算全套表單（基本／日期／8 大開支分類，附即時小計）；Input02 班資料（名額・收費・節次 8 行・截止公佈・職員表 20 行）；⚡自動格（公式）覆寫前會 confirm |
| 📢 通告 | 即時 A4 預覽（模仿 Print_通告公式組版：標題・節次・班領導人・名額・截止・報名辦法・FPS・查詢全自動）；可編欄位（檔案編號・參加資格・費用說明・服裝・備註・署名）；FPS QR 本機上載；一掣列印/存 PDF |
| ✅ 收生確認 | 待批／已取錄／拒絕／取消 篩選＋搜尋；詳情彈窗（家長・領袖・付款・入數紙 Drive 連結）；接納／拒絕／取消／還原待批（記批核人＋時間）；批量接納；超名額防呆警告 |
| 👥 學員 | 取錄名單（學員編號=報名次序自動）；分組（第一至八組，可自動梅花間竹）；CSV 匯出（Excel 友好 BOM）；列印 |

## 🛡️ 防呆機制（多位職員同時用）

| 機制 | 說明 |
|---|---|
| 草稿制 | 所有格修改先存**本機草稿**（localStorage，閂頁都唔會冇）；撳 💾 先一次過 `saveCourseBatch` 寫入 |
| rev 樂觀鎖 | 儲存帶 `baseRev`；有人快咗一步 → GAS 回 conflict（講明邊個幾時改），前端**乜都冇寫** |
| 自動合併 | 衝突後自動重讀：你改嘅格對方冇掂過 → 自動用新 rev 重試（自動合併）；同一格先彈「揀邊個版本」對話框 |
| 即時偵測 | 每 15 秒自動同步（分頁隱藏暫停）；其他人改咗嘢即時反映；你未儲存嘅草稿同對方撞格即刻出警告 banner |
| 同值自動取消 | 對方做咗同樣改動 → 你嘅草稿自動撤銷，唔會重複寫 |
| identity 定位 | 報名狀態用「時間戳記」對行（setRegStatus），分組用報名 id 重新對行先寫——新報名插入都唔會寫錯行 |
| 雙擊／重複防護 | 接納按鈕 busy 鎖；批量逐筆回報成敗 |
| 留名記錄 | 每次寫入以你揀嘅職員名記錄（批核人欄＋rev by＋本機操作紀錄） |
| 閂頁提示 | 有未儲存草稿時瀏覽器會問你 |
| 超名額警告 | 接納／批量接納超過名額會先問 |

## 🚀 快速開始

### 演示模式（唔使任何嘢）
開 APP → 「📊 演示模式」→ 密碼 `1234` → 揀職員名。
設定（⚙️）入面有演示工具：**📥 模擬新報名**、**🧪 模擬另一職員儲存**（即刻試防呆衝突流程）、♻️ 重設。

### 連真班（每班一次）
1. CL 照舊開新空白 Google Sheet → 貼 `Code.gs.course.js`（正本喺 `scout-district-portal`）→ `setupCourseSheet()` → 部署 /exec（執行身分：我自己；存取：任何人）→ 產生 API Key
2. 職員開 APP → 貼 /exec＋API Key → 連線
3. 撳 ⚙️ → 「🔗 複製職員連結」→ Send 俾其他職員（網址自帶參數，一按即入）

> 建議將 `Code.gs.course.js` 正本抄一份入 `apps-script/`（而家冇，避免未經授權複製正本）。

## 🧪 開發

```bash
node tests/run_all.js      # 3 個測試檔（parse / 草稿合併 / mock 合約）
for f in js/*.js; do node --check "$f"; done   # 語法檢查
python3 -m http.server 8000                    # 本地預覽
```

- **mock 後端**（`js/15-mock.js`）完全照 GAS 合約實作（rev 語義、ScriptLock 排隊、setRegStatus 唔 bump rev、支出 append-only…），有 34 項合約測試鎖住
- 檔案結構：`00-config`（座標表）→ `10-api`／`15-mock` → `20-store`（草稿引擎）→ `30-parse` → `40-sync`（同步／衝突）→ `50-ui` → 各頁面 → `90-bootstrap`
- 前端契約詳見 [`docs/API.md`](docs/API.md)

## 🚢 部署

純靜態——Vercel／GitHub Pages 直接用 `index.html`。`vercel.json` 已附。

## 🗓️ 第二階段 roadmap

| 功能 | 做法 | 要唔要改 Script |
|---|---|---|
| 出席點名（數碼化，唔使印） | 每節 P/A/L/E，寫入工作簿 | ✅ 建議加一行：`getCourseSheetRaw_` 補 `attend: dump('Print_學員出席紀錄')`（或改用「表格回應」尾欄，唔使改模版） |
| 時間表 Input03 | 每節 rundown（時間自動累計） | ❌ setCourseCells 已可寫 |
| 收支表（數碼化） | `addExpenseRow` 9 類入帳＋預算對比＋收據行數提示 | ❒ 已有（Phase 1 嘅 mock 已實現晒） |
| 完成報告 | `setCompletionRow`（合格／證書編號／不合格原因） | ❌ 已有 |
| 證書領取 | `setCertRow`（領取日期／簽收） | ❌ 已有 |
| 各類 Print 名單列印 | 取錄／學員／出席／班職員 本機生成列印 | ❌ |

## ⚠️ 注意

- 座標跟 **Code.gs.course.js v4.13.0 模版**；人手改過行位嘅舊表唔保證啱（Script 原註釋都有講）
- 公式欄（旅號・學員編號・Input02 G 欄自動日期）只讀；黃色自動格（Input02 B1/B4/B5/B6）覆寫前會 confirm
- 日期一律以香港時區處理（GAS Date dump 係 UTC ISO，前端轉 `Asia/Hong_Kong`）
- 密碼只係輕量閘（防亂入）；真正權限由 API Key 控制——唔好將職員連結流出街外
