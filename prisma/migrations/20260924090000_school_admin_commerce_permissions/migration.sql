-- Existing installations need the same commerce permissions that new seeds
-- assign to the school administrator role.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || p."id"), r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."organizationId" = r."organizationId"
WHERE r."slug" = 'school-admin'
  AND p."resource" = 'access-grants'
  AND p."action" IN ('read', 'manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
