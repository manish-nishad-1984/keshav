-- The earlier migration added "Flatlock" because the work type was spelled "FAT LOCK". Drop that
-- extra type when it is unused and a differently spelled flatlock type ("fat lock") exists.
DELETE FROM "work_types" w
WHERE lower(w."name") = 'flatlock'
  AND NOT EXISTS (SELECT 1 FROM "karigars" k WHERE k."workTypeId" = w."id")
  AND NOT EXISTS (SELECT 1 FROM "production_entries" p WHERE p."workTypeId" = w."id")
  AND EXISTS (
    SELECT 1 FROM "work_types" o
    WHERE o."organizationId" = w."organizationId" AND o."id" <> w."id"
      AND regexp_replace(lower(o."name"), '[^a-z]', '', 'g') = 'fatlock'
  );
