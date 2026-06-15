CREATE TABLE "RegimeState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" DATETIME NOT NULL,
  "confirmedRegime" TEXT NOT NULL,
  "rawRegimeSignal" TEXT NOT NULL,
  "pendingRegime" TEXT,
  "pendingConfirmationDays" INTEGER NOT NULL DEFAULT 0,
  "requiredConfirmationDays" INTEGER NOT NULL DEFAULT 3,
  "daysInConfirmedRegime" INTEGER NOT NULL DEFAULT 1,
  "confidence" TEXT NOT NULL,
  "explanation" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "RegimeState_date_key" ON "RegimeState"("date");
