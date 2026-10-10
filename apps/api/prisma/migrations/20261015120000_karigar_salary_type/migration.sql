-- Salary type moves off the work type: Fixed (monthly, by attendance) or Variable (per piece).
DO $$ BEGIN
    CREATE TYPE "SalaryType" AS ENUM ('FIXED', 'VARIABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "karigars" ADD COLUMN IF NOT EXISTS "salaryType" "SalaryType" NOT NULL DEFAULT 'VARIABLE';

-- Karigars that were on the old "Fixed" work type become salary type Fixed.
UPDATE "karigars" k SET "salaryType" = 'FIXED'
FROM "work_types" w
WHERE k."workTypeId" = w."id" AND lower(trim(w."name")) = 'fixed';

-- Remove the "Fixed" work type; if karigars still point at it (FK), just hide it so they can be moved.
DELETE FROM "work_types" w
WHERE lower(trim(w."name")) = 'fixed'
  AND NOT EXISTS (SELECT 1 FROM "karigars" k WHERE k."workTypeId" = w."id");
UPDATE "work_types" SET "isActive" = false WHERE lower(trim("name")) = 'fixed';
