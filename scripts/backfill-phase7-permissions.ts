import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const definitions = [
  ['notifications', 'read'], ['notifications', 'update'], ['announcements', 'read'], ['announcements', 'manage'],
  ['certificates', 'read'], ['certificates', 'update'], ['certificates', 'manage'], ['achievements', 'read'],
  ['achievements', 'manage'], ['portfolio', 'read'], ['portfolio', 'create'], ['portfolio', 'update'],
  ['helpdesk', 'read'], ['helpdesk', 'create'], ['helpdesk', 'update'], ['helpdesk', 'manage'],
  ['cms', 'manage'], ['analytics', 'create'], ['offline-drafts', 'update'],
] as const;

const readerResources = new Set(['notifications:read', 'notifications:update', 'announcements:read', 'certificates:read', 'achievements:read', 'portfolio:read', 'helpdesk:read', 'helpdesk:create', 'helpdesk:update', 'analytics:create']);
const studentExtras = new Set(['certificates:update', 'portfolio:create', 'portfolio:update', 'offline-drafts:update']);
const teacherExtras = new Set(['announcements:manage', 'certificates:manage', 'achievements:manage', 'helpdesk:manage']);

async function main() {
  const organizations = await prisma.organization.findMany({ select: { id: true } });
  for (const organization of organizations) {
    for (const [resource, action] of definitions) {
      await prisma.permission.upsert({
        where: { organizationId_resource_action: { organizationId: organization.id, resource, action } },
        update: {},
        create: { organizationId: organization.id, resource, action, isSystem: true },
      });
    }
    const [permissions, roles] = await Promise.all([
      prisma.permission.findMany({ where: { organizationId: organization.id } }),
      prisma.role.findMany({ where: { organizationId: organization.id } }),
    ]);
    for (const role of roles) {
      for (const permission of permissions) {
        const key = `${permission.resource}:${permission.action}`;
        const allowed = role.slug === 'super-admin'
          || ['school-admin', 'program-manager'].includes(role.slug)
          || (role.slug === 'student' && (readerResources.has(key) || studentExtras.has(key)))
          || (role.slug === 'teacher' && (readerResources.has(key) || teacherExtras.has(key)))
          || (role.slug === 'parent' && readerResources.has(key))
          || (role.slug === 'support' && ['notifications', 'announcements', 'helpdesk'].includes(permission.resource));
        if (!allowed || !definitions.some(([resource, action]) => resource === permission.resource && action === permission.action)) continue;
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }
  console.log(`Phase 7 permissions backfilled for ${organizations.length} organization(s).`);
}

main().finally(() => prisma.$disconnect());
