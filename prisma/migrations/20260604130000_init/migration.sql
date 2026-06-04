CREATE TABLE "Indicator" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "fredSeriesId" TEXT,
  "frequency" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "macroLogic" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Observation" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "indicatorId" INTEGER NOT NULL,
  "date" DATETIME NOT NULL,
  "value" REAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Observation_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MacroRegime" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "date" DATETIME NOT NULL,
  "liquidityScore" REAL NOT NULL,
  "inflationScore" REAL NOT NULL,
  "growthScore" REAL NOT NULL,
  "riskAppetiteScore" REAL NOT NULL,
  "dollarScore" REAL NOT NULL,
  "creditScore" REAL NOT NULL,
  "commodityScore" REAL NOT NULL,
  "chinaScore" REAL NOT NULL,
  "finalRegime" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Alert" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "indicatorId" INTEGER NOT NULL,
  "operator" TEXT NOT NULL,
  "threshold" REAL NOT NULL,
  "message" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "triggeredAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Alert_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Settings" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Indicator_symbol_key" ON "Indicator"("symbol");
CREATE UNIQUE INDEX "Observation_indicatorId_date_key" ON "Observation"("indicatorId", "date");
CREATE INDEX "Observation_indicatorId_date_idx" ON "Observation"("indicatorId", "date");
CREATE UNIQUE INDEX "MacroRegime_date_key" ON "MacroRegime"("date");
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");
