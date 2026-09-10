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
