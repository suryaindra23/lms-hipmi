-- This is an empty migration.
INSERT INTO "roles" ("id", "organizationId", "name", "slug", "description", "isSystem", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id" || role_data.slug), o."id", role_data.name, role_data.slug, role_data.description, true, true, now(), now()
FROM "organizations" o
CROSS JOIN (VALUES
  ('school-admin', 'Admin Sekolah', 'Mengelola pengguna dan master data dalam sekolah'),
  ('parent', 'Orang Tua/Wali', 'Memantau anak yang telah diverifikasi'),
  ('reviewer', 'Reviewer Akademik', 'Memeriksa submission akademik yang dialokasikan'),
  ('identity-verifier', 'Verifier Identitas', 'Memeriksa identitas tanpa akses akademik otomatis'),
  ('program-manager', 'Program Manager', 'Memantau program lintas sekolah sesuai organisasi')
) AS role_data(slug, name, description)
ON CONFLICT ("organizationId", "slug") DO NOTHING;

INSERT INTO "permissions" ("id", "organizationId", "resource", "action", "description", "isSystem", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id" || permission_data.resource || permission_data.action), o."id", permission_data.resource, permission_data.action, permission_data.description, true, now(), now()
FROM "organizations" o
CROSS JOIN (VALUES
  ('master-data', 'create', 'Membuat master data dalam scope tenant'),
  ('master-data', 'update', 'Memperbarui master data dalam scope tenant'),
  ('master-data', 'delete', 'Mengarsipkan master data dalam scope tenant'),
  ('master-data', 'import', 'Menjalankan import master data asynchronous'),
  ('identity', 'create', 'Mengirim data identitas milik sendiri'),
  ('identity', 'verify', 'Memverifikasi identitas dalam scope terpisah'),
  ('leads', 'read', 'Melihat pendaftaran sekolah'),
  ('leads', 'update', 'Memperbarui status pendaftaran sekolah')
) AS permission_data(resource, action, description)
ON CONFLICT ("organizationId", "resource", "action") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || p."id"), r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."organizationId" = r."organizationId"
WHERE r."slug" IN ('super-admin', 'school-admin')
  AND (p."resource" IN ('master-data', 'dashboard', 'leads'))
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || p."id"), r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."organizationId" = r."organizationId"
WHERE (r."slug" = 'student' AND p."resource" = 'identity' AND p."action" = 'create')
   OR (r."slug" = 'identity-verifier' AND p."resource" = 'identity' AND p."action" = 'verify')
   OR (r."slug" = 'parent' AND p."resource" = 'dashboard' AND p."action" = 'read')
   OR (r."slug" = 'reviewer' AND p."resource" = 'submissions' AND p."action" IN ('read', 'review'))
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
