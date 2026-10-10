-- Spell the work type as one word: "Flatlock" (was "FLAT LOCK").
UPDATE "work_types" w
SET "name" = 'Flatlock', "updatedAt" = CURRENT_TIMESTAMP
WHERE regexp_replace(lower(w."name"), '[^a-z]', '', 'g') = 'flatlock'
  AND w."name" <> 'Flatlock'
  AND NOT EXISTS (
    SELECT 1 FROM "work_types" o
    WHERE o."organizationId" = w."organizationId" AND o."name" = 'Flatlock'
  );
