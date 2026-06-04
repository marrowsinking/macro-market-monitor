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
npm run fetch:fred
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
- `/indicators/[symbol]`：指標詳情，支援 1 年 / 3 年 / 5 年歷史圖表。
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

第一版只拉 `source=FRED` 且有 `fredSeriesId` 的指標。DXY、股指、中國數據等先作為佔位指標保留，後續接 Yahoo Finance / FMP / Nasdaq Data Link / Trading Economics。

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
