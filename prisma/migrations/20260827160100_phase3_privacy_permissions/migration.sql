ALTER TABLE "identity_documents"
ADD CONSTRAINT "identity_documents_legacy_nisn_empty" CHECK ("nisn" IS NULL);

INSERT INTO "permissions" ("id", "organizationId", "resource", "action", "description", "isSystem", "createdAt", "updatedAt")
SELECT CONCAT('perm_', SUBSTRING(MD5(o."id" || permission_data.resource || permission_data.action) FOR 20)),
       o."id", permission_data.resource, permission_data.action, permission_data.description, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN (VALUES
  ('identity.document', 'read', 'Membuka dokumen identitas privat setelah otorisasi dan audit'),
  ('privacy', 'manage', 'Mengelola permintaan hak subjek data dalam scope tenant')
) AS permission_data(resource, action, description)
ON CONFLICT ("organizationId", "resource", "action") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT CONCAT('rp_', SUBSTRING(MD5(role."id" || permission."id") FOR 20)), role."id", permission."id", CURRENT_TIMESTAMP
FROM "roles" role
JOIN "permissions" permission ON permission."organizationId" = role."organizationId"
WHERE (role."slug" = 'identity-verifier' AND permission."resource" = 'identity.document' AND permission."action" = 'read')
   OR (role."slug" IN ('super-admin', 'school-admin') AND permission."resource" = 'privacy' AND permission."action" = 'manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "consent_documents" ("id", "organizationId", "type", "version", "title", "content", "effectiveAt", "createdAt")
SELECT CONCAT('consent_identity_', SUBSTRING(MD5(o."id") FOR 16)), o."id", 'IDENTITY', '2026-08-27-identity-v1',
       'Persetujuan pemrosesan identitas',
       'Data identitas digunakan terbatas untuk verifikasi kepesertaan dan dilindungi sesuai kebijakan privasi platform.',
       TIMESTAMP '2026-08-27 00:00:00', CURRENT_TIMESTAMP
FROM "organizations" o
ON CONFLICT ("organizationId", "type", "version") DO NOTHING;

UPDATE "consents" consent
SET "type" = 'IDENTITY', "documentId" = document."id"
FROM "consent_documents" document
WHERE consent."organizationId" = document."organizationId"
  AND document."type" = 'IDENTITY'
  AND document."version" = '2026-08-27-identity-v1'
  AND consent."evidence" ->> 'purpose' = 'IDENTITY_VERIFICATION';
