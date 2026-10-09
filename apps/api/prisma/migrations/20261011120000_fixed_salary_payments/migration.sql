-- Payment entry: date + time set by the server, and attendance-based salary for Fixed karigars.

ALTER TABLE "karigars" ADD COLUMN IF NOT EXISTS "monthlySalary" DECIMAL(12,2);

ALTER TABLE "payments"
    ADD COLUMN IF NOT EXISTS "entryTime" TEXT,
    ADD COLUMN IF NOT EXISTS "presentDays" INTEGER,
    ADD COLUMN IF NOT EXISTS "absentDays" INTEGER,
    ADD COLUMN IF NOT EXISTS "overtimeHours" DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS "perDayRate" DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS "salaryAmount" DECIMAL(12,2);

-- A "Fixed" work type for every organization: karigars on a monthly salary paid by attendance.
INSERT INTO "work_types" ("id", "organizationId", "name", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id"::text)::uuid, o."id", 'Fixed', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
WHERE NOT EXISTS (SELECT 1 FROM "work_types" w WHERE w."organizationId" = o."id" AND lower(w."name") = 'fixed');
