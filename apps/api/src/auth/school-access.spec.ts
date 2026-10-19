import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSchoolAccess } from './school-access';

test('organization-level administrators may select every school in their organization', () => {
  const access = resolveSchoolAccess([
    { schoolId: null, role: { slug: 'school-admin' } },
  ]);

  assert.equal(access.organizationWide, true);
  assert.deepEqual(access.schoolIds, []);
});

test('school-scoped users only receive their assigned and profile schools', () => {
  const access = resolveSchoolAccess(
    [{ schoolId: 'school-b', role: { slug: 'teacher' } }],
    ['school-a', 'school-a'],
  );

  assert.equal(access.organizationWide, false);
  assert.deepEqual(access.schoolIds.sort(), ['school-a', 'school-b']);
});

test('a school-scoped admin does not gain organization-wide access', () => {
  const access = resolveSchoolAccess([
    { schoolId: 'school-a', role: { slug: 'school-admin' } },
  ]);

  assert.equal(access.organizationWide, false);
  assert.deepEqual(access.schoolIds, ['school-a']);
});
