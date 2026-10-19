INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
  'rp_f4_' || md5(r."id" || p."id"),
  r."id",
  p."id"
FROM "roles" r
JOIN "permissions" p
  ON p."organizationId" = r."organizationId"
 AND p."resource" = 'submissions'
 AND p."action" = 'read'
WHERE r."slug" = 'student'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
