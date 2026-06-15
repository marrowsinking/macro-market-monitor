# macro-market-monitor

本地優先的宏觀市場數據觀察器。第一版追蹤 FRED 宏觀數據、美元流動性、利率、通脹、就業、信用、商品和中國週期佔位指標，輸出中文宏觀 regime 判斷。

## 技術棧

- Next.js + TypeScript + Tailwind CSS
- Prisma ORM + SQLite
- Recharts
- FRED API
- 預留 FMP / Nasdaq Data Link / Trading Economics

## 初始化

```bash
npm install
cp .env.example .env.local
npx prisma migrate dev --name init
npm run seed
npm run update:data
npm run dev
```

打開：

```bash
http://localhost:3000
```

如果還沒有 FRED API Key，可以先跳過 `npm run fetch:fred`，Dashboard 仍會打開並提示缺 key。

如果你的本機 Prisma schema-engine 在 `migrate dev` 階段只輸出空的 `Schema engine error`，先用本地 SQLite 初始化腳本：

```bash
npm run db:init
npx prisma generate
npm run seed
```

## 環境變量

所有 API Key 都放在 `.env.local`，不要硬編碼。

```bash
DATABASE_URL="file:./prisma/dev.db"
FRED_API_KEY=""
FMP_API_KEY=""
NASDAQ_DATA_LINK_API_KEY=""
TRADING_ECONOMICS_API_KEY=""
```

Settings 頁可以在本地寫入 `.env.local`。保存後需要重啟 `npm run dev`，Next.js 才會讀到新的環境變量。部署到 Vercel / Railway / Render 時，請在平台後台設定環境變量。

## 頁面

- `/`：Dashboard，顯示宏觀總狀態、八個分數、中文 summary 和核心圖表。
- `/indicators`：所有指標列表，支援分類篩選。
- `/indicators/[id]`：指標詳情，支援 1 年 / 3 年 / 5 年歷史圖表。
- `/alerts`：建立和查看警報，第一版只顯示「已觸發」。
- `/settings`：管理本地 API Key。

## 數據腳本

初始化指標：

```bash
npm run seed
```

拉取 FRED 歷史數據：

```bash
npm run fetch:fred
```

拉取 Yahoo 跨資產數據：

```bash
npm run fetch:yahoo
```

每日更新完整流程：

```bash
npm run update:data
```

`update:data` 會依序執行 FRED、Yahoo、regime 計算和 alerts 檢查，不會執行 build。

## 本地長期運行

第一次安裝：

```bash
npm install
npx prisma migrate dev
npm run seed
npm run update:data
```

正式長期運行前，先停止正在跑的 dev server。不要在 `npm run dev` 還開著時執行 build。

```bash
# 先在 npm run dev 的終端按 Ctrl+C
npm run build
pm2 start ecosystem.config.js
pm2 save
```

PM2 會啟動兩個進程：

- `macro-market-monitor`：執行 `npm run start:prod`，用 `0.0.0.0` 對局域網開放。
- `macro-market-scheduler`：每天早上 8:30 執行資料更新，只跑 fetch / calculate / alerts，不跑 build。

常用 PM2 命令：

```bash
pm2 status
pm2 logs macro-market-monitor
pm2 logs macro-market-scheduler
pm2 restart macro-market-monitor
pm2 stop macro-market-monitor
pm2 stop macro-market-scheduler
```

如果改了程式碼，正確順序是：

```bash
pm2 stop macro-market-monitor
npm run build
pm2 restart macro-market-monitor
```

重點：build 前一定先停 dev server，也不要在 dev server 運行時執行 `npm run build`。

## 常見錯誤

### `FRED_API_KEY is not set`

在 `.env.local` 填入：

```bash
FRED_API_KEY="你的 key"
```

然後重啟 dev server，再跑：

```bash
npm run fetch:fred
```

### Prisma client 不存在或資料表不存在

先跑 migration：

```bash
npx prisma migrate dev --name init
```

再跑：

```bash
npm run seed
```

如果 `npx prisma migrate dev` 在 macOS 沙箱或受限終端只輸出 `Schema engine error`，改跑：

```bash
npm run db:init
npx prisma generate
npm run seed
```

### Gold / Silver 的 FRED series 失敗

`GOLDAMGBD228NLBM` 目前不再用於抓取或 regime 計算，seed 內保留為 `DISABLED` 只做歷史標記。黃金、白銀、銅改用 Yahoo 的 `GC=F`、`SI=F`、`HG=F`。

### Dashboard 沒有數據

通常是還沒拉 FRED：

```bash
npm run fetch:fred
```

如果沒有 FRED key，頁面會顯示友好提示，不會崩潰。

### `npm run fetch:fred` 某個 series 失敗

先確認 FRED key 是否有效，再確認 series id 是否仍存在。黃金、白銀、銅不走 FRED，請用 `npm run fetch:yahoo` 更新 Yahoo 跨資產價格。

## 驗證

```bash
npm run typecheck
npm test
npm run build
```
