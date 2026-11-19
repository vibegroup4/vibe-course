# 垃圾駱駝

- 小組遠端為 `https://github.com/vibegroup4/vibe-course.git`，以本機 vibegroup4 為操作目錄。
- 功能見根目錄 `spec.md`。前端從 `index.html` 開始，後端為 `server/worker.js`，D1 遷移在 `drizzle/`。
- Node.js 24 執行 `node scripts/dev.mjs` 預覽、`node --test test/worker.test.mjs` 驗證、`node scripts/build.mjs` 打包。
- 用虛構資料驗證發單、兩人報價、成交、取件、完成與雙方互評。
- 修改 API 時檢查跨裝置、未成交與棄單後欄位遮蔽、版本衝突、重複評價與舊案相容。
- 行事曆使用臺灣取件日，統計採臺灣事件日期。完成成交金額表示議定金額。舊案缺事件時間回退取件日。
- 改動同步更新 README、spec、docs/流程圖.md、docs/驗收與彩排.md、整合版 PPT 和 PNG。
- 組員原始附件作參考。壓縮檔的 .git、.local 資料庫與舊部署識別不得複製進部署來源。
