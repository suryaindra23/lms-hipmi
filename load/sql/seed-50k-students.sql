\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_database() !~ '(load|perf|test)' THEN
    RAISE EXCEPTION 'Refusing to seed 50k rows outside a load/perf/test database';
  END IF;
END $$;

BEGIN;

WITH tenant AS (
  SELECT s.id AS school_id, s."organizationId" AS organization_id
  FROM schools s
  WHERE s."isActive" = true
  ORDER BY s."createdAt"
  LIMIT 1
), password AS (
  SELECT "passwordHash" AS password_hash FROM users ORDER BY "createdAt" LIMIT 1
)
INSERT INTO users (id, "organizationId", email, "passwordHash", "firstName", "lastName", status, "createdAt", "updatedAt")
SELECT
  'load-user-' || lpad(series::text, 8, '0'),
  tenant.organization_id,
  'load.student.' || series || '@example.invalid',
  password.password_hash,
  'Siswa',
  'Uji ' || series,
  'PENDING_ACTIVATION'::"UserStatus",
  now(),
  now()
FROM generate_series(1, 50000) AS series
CROSS JOIN tenant
CROSS JOIN password
ON CONFLICT (email) DO NOTHING;

WITH tenant AS (
  SELECT id AS school_id FROM schools WHERE "isActive" = true ORDER BY "createdAt" LIMIT 1
)
INSERT INTO students (id, "userId", "schoolId", "studentNumber", "fullName", status, "createdAt", "updatedAt")
SELECT
  'load-student-' || lpad(series::text, 8, '0'),
  'load-user-' || lpad(series::text, 8, '0'),
  tenant.school_id,
  'LOAD' || lpad(series::text, 8, '0'),
  'Siswa Uji ' || series,
  'DRAFT'::"StudentStatus",
  now(),
  now()
FROM generate_series(1, 50000) AS series
CROSS JOIN tenant
ON CONFLICT ("schoolId", "studentNumber") DO NOTHING;

COMMIT;
ANALYZE users;
ANALYZE students;

SELECT count(*) AS synthetic_students FROM students WHERE id LIKE 'load-student-%';
