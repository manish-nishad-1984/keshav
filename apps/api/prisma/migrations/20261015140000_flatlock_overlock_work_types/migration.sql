-- Flatlock and Overlock work types: the production entry lists only karigars of that type in those dropdowns.
INSERT INTO "work_types" ("id", "organizationId", "name", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id"::text || n.name)::uuid, o."id", n.name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN (VALUES ('Flatlock'), ('Overlock')) AS n(name)
WHERE NOT EXISTS (
    SELECT 1 FROM "work_types" w
    WHERE w."organizationId" = o."id" AND regexp_replace(lower(w."name"), '[^a-z]', '', 'g') = lower(n.name)
);
