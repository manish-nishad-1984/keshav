-- Remove the "Fixed" work type (salary type now covers it). Karigars on it move to another work type.
INSERT INTO "work_types" ("id", "organizationId", "name", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id"::text)::uuid, o."id", 'General', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
WHERE NOT EXISTS (
    SELECT 1 FROM "work_types" w
    WHERE w."organizationId" = o."id" AND lower(trim(w."name")) <> 'fixed' AND w."isActive"
);

UPDATE "karigars" k
SET "workTypeId" = (
    SELECT t."id" FROM "work_types" t
    WHERE t."organizationId" = k."organizationId" AND lower(trim(t."name")) <> 'fixed' AND t."isActive"
    ORDER BY t."name" LIMIT 1
)
FROM "work_types" f
WHERE k."workTypeId" = f."id" AND lower(trim(f."name")) = 'fixed';

DELETE FROM "work_types" WHERE lower(trim("name")) = 'fixed';
