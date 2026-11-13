# 垃圾駱駝

- 小組遠端為 `https://github.com/vibegroup4/vibe-course.git`。
- 頁面從 `index.html` 開始，後端在 `server/worker.js`，D1 遷移在 `drizzle/`。
- 使用 Node.js 24 執行 `node scripts/build.mjs` 和 `node --test test/worker.test.mjs`。本機資料庫與伺服器用法見 README。
- 驗收用虛構地址和聯絡資料。確認住戶發單、兩位代收者報價、住戶選定、得標者取件及完成。
- 修改案件狀態或 API 時，驗證跨裝置讀取、未成交視角的資料遮蔽，以及同時更新時的衝突處理。
