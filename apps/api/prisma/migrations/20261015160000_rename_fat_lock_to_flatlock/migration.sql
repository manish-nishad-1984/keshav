-- "FAT LOCK" was a misspelling; the work type is Flatlock.
UPDATE "work_types" w
SET "name" = 'Flatlock', "updatedAt" = CURRENT_TIMESTAMP
WHERE regexp_replace(lower(w."name"), '[^a-z]', '', 'g') = 'fatlock'
  AND NOT EXISTS (
    SELECT 1 FROM "work_types" o
    WHERE o."organizationId" = w."organizationId" AND o."name" = 'Flatlock'
  );
