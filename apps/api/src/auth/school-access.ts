export type SchoolRoleAssignment = {
  schoolId?: string | null;
  role: { slug: string };
};

const organizationWideRoles = new Set([
  'super-admin',
  'program-manager',
  'school-admin',
  'support',
]);

export function resolveSchoolAccess(
  assignments: SchoolRoleAssignment[],
  profileSchoolIds: Array<string | null | undefined> = [],
) {
  const schoolIds = new Set(
    [...profileSchoolIds, ...assignments.map((assignment) => assignment.schoolId)]
      .filter((schoolId): schoolId is string => typeof schoolId === 'string' && schoolId.length > 0),
  );

  const organizationWide = assignments.some(
    (assignment) =>
      assignment.role.slug === 'super-admin' ||
      (!assignment.schoolId && organizationWideRoles.has(assignment.role.slug)),
  );

  return { organizationWide, schoolIds: [...schoolIds] };
}
