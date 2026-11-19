# 垃圾駱駝

垃圾代收媒合課堂專題，整合組員的互評、接單行事曆、統計與棄單紀錄。

- [公開網站](https://trash-camal-vibe-course-4.spiritedmagpie1.chatgpt.site/)
- [小組 GitHub](https://github.com/vibegroup4/vibe-course)
- [規格與完成條件](spec.md)
- [操作及系統流程](docs/流程圖.md)
- [驗收與彩排](docs/驗收與彩排.md)
- [組員整合紀錄](docs/組員整合紀錄.md)
- [最新整合版專題簡報](docs/垃圾駱駝－整合版專題簡報.pptx)

## 操作

住戶發布需求，兩位代收者各自報價，住戶選定後，得標者取件、完成。完成後雙方各留一次星等與文字評價。

首次開啟公開入口建立獨立示範組。分享示範連結可在別台裝置接續同組案件，按更新資料重新讀取。連結有效 7 天，持有連結的人可切換所有示範角色，請只用虛構地址與聯絡資料。重設影響同組案件、報價與評價，開始新示範則另建一組。

代收者可看已報價篩選、接單統計與行事曆。已確認包括已約定及已取件，事件可點開詳情。完成成交金額表示議定金額，付款由雙方另行協調。

## 本機開發

需要 Node.js 24，無額外套件。執行 `node scripts/dev.mjs`，開啟印出的本機網址，SQLite 在 `outputs/local/demo.sqlite`，與雲端 D1 分開。

執行 `node --test test/worker.test.mjs`，檢查主流程、保存、同時成交、互評、棄單和可見欄位。執行 `node scripts/build.mjs` 打包。

## 部署及相容

`.openai/hosting.json` 保留既有 Site 與 DB 綁定。Sites 套用 `drizzle/` 遷移，部署 `dist/server/index.js`，同一 Worker 提供頁面及 API。GitHub 保存小組原始碼與最新文件，公開站透過 Sites 發布流程更新。

整合僅擴充案件 JSON，既有 D1 表與案件可沿用。無評價視為尚未評價，缺事件時間時統計回退原取件日。舊 cancelled 不推定為棄單。瀏覽器 localStorage 及組員 SQLite 資料不會自動匯入。

## 發表資料

docs 下的整合版簡報、兩張 PNG 和流程 Markdown 為最新交付。outputs 下的六頁及十一頁簡報是歷史草稿。組員提供的兩份原始附件保持原樣作為參考，部署只包含網站執行所需檔案。
