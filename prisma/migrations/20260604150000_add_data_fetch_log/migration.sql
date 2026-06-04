CREATE TABLE "DataFetchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "symbol" TEXT,
    "indicatorId" TEXT,
    "status" TEXT NOT NULL,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "observationsInserted" INTEGER NOT NULL DEFAULT 0,
    "observationsSkippedDuplicate" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
