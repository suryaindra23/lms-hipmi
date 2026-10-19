-- Permissions required by teacher learning management, student submission,
-- and the administrator Master Data overview.
WITH required_permissions(resource, action) AS (
  VALUES
    ('assignments', 'update'),
    ('assignments', 'delete'),
    ('submissions', 'update'),
    ('materials', 'read'),
    ('materials', 'create'),
    ('materials', 'update'),
    ('materials', 'delete'),
    ('master-data', 'read')
)
INSERT INTO "permissions" (
  "id", "organizationId", "resource", "action", "description", "isSystem", "createdAt", "updatedAt"
)
SELECT
  md5(o."id" || ':' || rp.resource || ':' || rp.action),
  o."id",
  rp.resource,
  rp.action,
  'System permission for ' || rp.resource || ':' || rp.action,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN required_permissions rp
ON CONFLICT ("organizationId", "resource", "action") DO NOTHING;

WITH role_grants(role_slug, resource, action) AS (
  VALUES
    ('teacher', 'assignments', 'update'),
    ('teacher', 'assignments', 'delete'),
    ('teacher', 'materials', 'read'),
    ('teacher', 'materials', 'create'),
    ('teacher', 'materials', 'update'),
    ('teacher', 'materials', 'delete'),
    ('student', 'materials', 'read'),
    ('student', 'submissions', 'update'),
    ('super-admin', 'master-data', 'read')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT
  md5(r."id" || ':' || p."id"),
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM role_grants rg
JOIN "roles" r ON r."slug" = rg.role_slug
JOIN "permissions" p
  ON p."organizationId" = r."organizationId"
 AND p."resource" = rg.resource
 AND p."action" = rg.action
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
