# 垃圾駱駝

課堂 demo 用來演練住戶發單、代收者報價、選定報價、取件和完成。用同一組示範連結可跨裝置操作，角色仍可在畫面切換。連結建立後 7 天到期，請只填虛構地址及聯絡資料。已有的瀏覽器版資料不會自動上傳。

## 本機開發

需要 Node.js 24。執行 `node scripts/dev.mjs`，開啟終端機印出的網址。資料會寫入 `outputs/local/demo.sqlite`。執行 `node --test test/worker.test.mjs` 驗證保存、角色可見欄位和同時成交的衝突處理。

## 部署

`node scripts/build.mjs` 產生 Sites Worker。部署使用既有 ChatGPT Site，`.openai/hosting.json` 設定 `DB` 綁定。Sites 部署時套用 `drizzle/` 的 D1 遷移。GitHub 為小組原始碼儲存庫，Sites 發布版本透過其部署流程更新。

## 示範資料

首次開啟網址會建立獨立的示範組。選「分享示範連結」把同一組連到第二台裝置。切換身分或按「更新資料」會重新讀取。拿到連結的人可以切換所有示範身分和操作案件。

重設只會影響同一組連結。開始新示範會另建一組案件，原連結可使用至到期。
