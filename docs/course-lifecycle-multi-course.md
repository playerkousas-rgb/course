# 訓練班系統：多班共用前端、讀取自己 Sheet、完成後標記已完成

## 核心概念

訓練班管理系統是一個**共用前端**，但不是「沒有後端」。正確理解是：**沒有一個中央 course server；每班自己的 Apps Script Web App 就是該班後端**。同一個前端網址可以同時服務 A、B、C 多個訓練班；真正分開的是每班自己的：

- 一張 Google Sheet 工作簿
- 一個 Apps Script `/exec`（該班後端）
- 一個 API Key
- 一個共職員密碼

所以資料不會混在一起。前端只是一個入口，入哪一班由 `/exec + API Key` 決定；同一班職員用同一組 `/exec + API Key + 班密碼`，就會看到同一張 Sheet 的同一份資料。

---


## 訓練班登記表：職員揀班，不記 courseId

CL／班職員不需要記 `courseId`。`courseId` 是系統用的隱藏 ID；人只需要認得班名。

訓練班登記表／CourseFactory registry 應保存：

| 顯示班名 | courseId / publicCourseId | Script `/exec` | GS URL | 狀態 |
|---|---|---|---|---|
| A 班 | crs_xxx | A 班或共用 API `/exec` | A Sheet | 進行中 |
| B 班 | crs_yyy | B 班或共用 API `/exec` | B Sheet | 進行中 |

前端流程是：

```text
職員打開訓練班系統
  ↓
按「📚 從登記表選班」
  ↓
看到 A班 / B班 / C班 名稱
  ↓
選自己負責的班
  ↓
輸入本班共用密碼
  ↓
CourseFactory 驗證密碼
  ↓
系統自動取回該班 courseId + scriptExecUrl + key
  ↓
讀寫該班 Sheet
```

所以 staff 不需要知道 courseId，更不需要手抄 Script URL；那些只是系統在背後連線用。已存在班的 API Key 不會公開列出，要輸入本班密碼後才取回。

## 「共用前端」點樣令多人睇同一班？

多人共用不是靠前端同步，而是靠**同一班後端**同步：

```text
職員甲瀏覽器 ─┐
職員乙瀏覽器 ─┼→ 同一個訓練班 /exec + API Key → 同一張 Google Sheet
職員丙瀏覽器 ─┘
```

前端每 15 秒讀一次該班 `getCourseSheetRaw`，儲存時寫回該班 `saveCourseBatch`。因為大家連到同一個 `/exec`，所以看到的是同一張 Sheet。多人同時修改時，用 `_Sync` rev 做防撞；有人快一步儲存，其他人會見到衝突提示。

## 一個人點樣睇兩個班？

同一個人的瀏覽器可以保存多組連線：

```text
A 班：exec_A + key_A → A Sheet
B 班：exec_B + key_B → B Sheet
```

首頁「已連線嘅訓練班」按 A 就讀 A；按 B 就讀 B。兩班的密碼、草稿、操作紀錄都按班分開。

---

## CL 正常流程

1. 區給 CL：
   - 訓練班系統網址
   - CourseFactory `/exec`
   - 管理碼/開班碼
2. CL 在訓練班系統按「🆕 新開班」。
3. CourseFactory 即時建立該班自己的 GS，回傳：
   - GS URL
   - Script `/exec`
   - API Key
   - hidden `publicCourseId`
   - 成員系統 direct 報名連結
4. CL 進入該班，首次密碼 `1234`，然後改成班內共用密碼。
5. CL 在 App 填開班文件、Budget V1、節次、通告。
6. CL 複製 GS URL + Script URL 交區管理系統。
7. 管理層在區管理系統審批、修改、標亮、批核。
8. 批准後 CL 出通告；通告印的是**成員系統 direct 報名連結**，不是 Script `/exec`。
9. 區網頁通告上載後，區管理系統貼通告 URL 並掛載到成員系統。
10. 參加者由成員系統報名，資料寫回該班 Sheet。

---

## CL／職員點樣讀返自己班 Sheet？

有三種方法：

### 方法 A：同一部機自動記住

CL 起表或連線成功後，前端會將該班 `/exec + API Key` 存在本機瀏覽器 localStorage。下次開同一個訓練班系統網址，就會在「已連線嘅訓練班」見到該班。

### 方法 B：複製職員連結給其他班職員

設定頁有「🔗 複製職員連結」。連結格式類似：

```text
https://course-app.../?exec=...&key=...&name=...
```

其他職員打開後，前端會自動加入該班，然後要求輸入班內共職員密碼。

> 注意：這條是班職員內部連結，不放上通告；參加者只會見到成員系統 direct 報名連結。

### 方法 C：手動連線

如果換機或清了瀏覽器資料，可以在首頁手動貼：

- 訓練班 Script `/exec`
- API Key
- 顯示名稱

連線成功後同樣會存在本機。

---

## 同時有 A / B / C 幾個訓練班點算？

同一個前端可以保存多個班的連線。首頁「已連線嘅訓練班」會列出所有進行中班別，職員按「開啟」就切換到該班。

每班的資料完全分開：

| 項目 | A 班 | B 班 | C 班 |
|---|---|---|---|
| Google Sheet | A 自己一張 | B 自己一張 | C 自己一張 |
| Script `/exec` | A 自己一個 | B 自己一個 | C 自己一個 |
| API Key | A 自己一條 | B 自己一條 | C 自己一條 |
| 共職員密碼 | A 自己設定 | B 自己設定 | C 自己設定 |
| 草稿 / 操作紀錄 | 按班分開存本機 | 按班分開存本機 | 按班分開存本機 |

---

## 區管理系統點樣同時讀幾個班？

區管理系統不靠前端 localStorage。它自己的 CourseLinks / 掛載表每一行記一個訓練班：

- courseId / publicCourseId
- GS URL
- Script `/exec`
- API Key 或內部連接資料
- 付款證明 Drive folder
- 區網頁通告 URL
- active / archived 狀態

要讀 A 班就 call A 班 `/exec getCourseSummary`；讀 B 班就 call B 班 `/exec getCourseSummary`。每班一行，所以可以同時管理很多班。

---

## 完成訓練班後點標記已完成？

訓練班 App 已有「📦 標記已完成」：

- 在設定頁按「📦 標記已完成」
- 只會標記已完成本機的連線記錄
- Google Sheet 不會刪
- 區管理系統資料不會刪
- 之後可在首頁「📦 已完成／已完成」重新開啟

正式行政歸檔應由區管理系統之後配合：

- CourseLinks 該班轉 `archived`
- 成員系統不再顯示報名
- 訓練班 Sheet 留在 Drive 作紀錄
- 需要時仍可用 GS URL / Script URL 查閱

---

## Mock / 演示已支援

演示模式已支援：

- 新開班，產生獨立 mock 班
- 多班切換
- 模擬新報名流入
- 收款核對
- 收生通知書寫 AZ/BA
- Budget V1/V2 提交與批准，批准後寫回 Input01
- 標記已完成已完成班別

可用來示範整條流程，無需真 Google Sheet。


## 開班是否需要管理碼？

可以不需要。CourseFactory 可以設定成 `FACTORY_KEY_HASH` 留空，任何知道 CourseFactory `/exec` 的人都可以開一張空白訓練班 Sheet。這張表未經區管理系統批核／掛載，就不會出現在成員系統，實際上無法公開收生。

但要注意：**公開開班**同**公開取回既有班的 API Key**是兩回事。開空白表可以放寬；已存在班的 API Key 不能公開，否則別人可能讀到報名資料。因此「從登記表選班」只公開班名；職員選班後要輸入本班密碼，CourseFactory 驗證成功才回傳 `/exec + API Key`。



## 最簡營運設定：只 SET 一張 Sheet

前線／區管理層唔應該逐班入 Apps Script 設 properties。實際做法係：技術同事先做好「開班文件模版」一次；日常只維護一張 **CourseFactory控制台** Sheet。

「設定」分頁只需要 A欄 label、B欄 value：

| A欄 | B欄 |
|---|---|
| 模版GS檔案ID | 開班文件模版 GS file id |
| 開班文件資料夾ID | 新班 GS 放置 folder id |
| 課程API網址 | 課程 backend `/exec` |
| 成員系統報名網址 | 可留空；有就自動組 direct registration link |
| 區管理電郵 | 可留空；有就自動分享新 GS |
| 開班碼 | 可留空；留空即新開空白班免開班碼 |

之後職員只會見到「新開班」同「從登記表選班」。開錯班用隱藏後台刪；唔需要佢哋記 Script URL / API Key / courseId。

## 開錯班點刪？

新開班可以不設開班碼，所以可能有人開錯空白班。這種班未經區管理系統批核／掛載，對外無效；但為免登記表越來越亂，CourseFactory 有一個隱藏後台清理入口。

在訓練班系統首頁連按 Logo 7 下，會開啟後台清理；輸入 CourseFactory `/exec` 及後台帳密後，可以刪除開錯班登記，並可選擇將該 GS 移到 Drive 垃圾桶。後台帳密只在 GS 後端程式內，不會在一般前端畫面顯示。


## 報名表對準位喺邊？

唔需要前線人手入。對準報名表用嘅係系統內部 `publicCourseId`：

1. CourseFactory 新開班時自動產生 `publicCourseId`。
2. 它會寫入訓練班 GS「參數」及 CourseFactory「訓練班登記」。
3. 區管理系統人手只輸入：訓練班 Script URL、通告編號、網頁通告 URL。
4. 區管理系統用 Script URL 讀到該班資料／`publicCourseId`，並存入自己的 CourseLinks row。
5. 掛載到成員系統時，成員系統用這個 `publicCourseId` 找回應寫入哪一班訓練班 Sheet。

所以「對準碼」不應該叫職員輸入；它係 CourseFactory／區管理系統之間自動傳遞的隱藏 ID。舊班如果沒有 `publicCourseId`，區管理系統可以根據通告編號自動生成一個，再回寫到訓練班參數。
