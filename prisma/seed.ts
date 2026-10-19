import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed sintetis tidak boleh dijalankan pada production');
  }

  const planSeeds = [
    { code: 'FREE', name: 'Gratis', rank: 1, moduleLimit: 8 },
    { code: 'MEDIUM', name: 'Medium', rank: 2, moduleLimit: 10 },
    { code: 'ADVANCED', name: 'Advanced', rank: 3, moduleLimit: 12 },
  ] as const;
  const entitlementSeeds = [
    { key: 'learning.materials.read', valueType: 'BOOLEAN', description: 'Membaca materi belajar', values: [true, true, true] },
    { key: 'learning.modules.max', valueType: 'INTEGER', description: 'Batas modul terbit yang dapat diakses', values: [8, 10, 12] },
    { key: 'assessment.overview.read', valueType: 'BOOLEAN', description: 'Melihat informasi penilaian', values: [true, true, true] },
    { key: 'assignments.standard.read', valueType: 'BOOLEAN', description: 'Membaca tugas standar', values: [true, true, true] },
    { key: 'assignments.standard.submit', valueType: 'BOOLEAN', description: 'Mengirim tugas standar', values: [true, true, true] },
    { key: 'student_store.submit', valueType: 'BOOLEAN', description: 'Mengirim praktik toko', values: [true, true, true] },
    { key: 'affiliate.content.submit', valueType: 'BOOLEAN', description: 'Mengirim konten affiliate', values: [true, true, true] },
    { key: 'affiliate.metrics.manage', valueType: 'BOOLEAN', description: 'Mengelola snapshot affiliate', values: [true, true, true] },
    { key: 'dashboards.advanced.read', valueType: 'BOOLEAN', description: 'Membaca dashboard lanjutan', values: [false, false, true] },
    { key: 'reports.export', valueType: 'BOOLEAN', description: 'Membuat laporan dan export', values: [false, false, true] },
    { key: 'early_warnings.read', valueType: 'BOOLEAN', description: 'Membaca early warning', values: [false, false, true] },
    { key: 'support.advanced.use', valueType: 'BOOLEAN', description: 'Menggunakan sertifikat, pencapaian, dan portofolio', values: [false, false, true] },
  ] as const;
  const effectiveFrom = new Date('2026-01-01T00:00:00.000Z');
  const plans = [];
  for (const planSeed of planSeeds) {
    plans.push(await prisma.accessPlan.upsert({
      where: { code: planSeed.code },
      update: { name: planSeed.name, rank: planSeed.rank, moduleLimit: planSeed.moduleLimit, status: 'ACTIVE' },
      create: { ...planSeed, status: 'ACTIVE' },
    }));
  }
  for (const entitlementSeed of entitlementSeeds) {
    const definition = await prisma.entitlementDefinition.upsert({
      where: { key: entitlementSeed.key },
      update: { valueType: entitlementSeed.valueType, description: entitlementSeed.description, isActive: true },
      create: { key: entitlementSeed.key, valueType: entitlementSeed.valueType, description: entitlementSeed.description },
    });
    for (const [index, plan] of plans.entries()) {
      const value = entitlementSeed.values[index];
      await prisma.planEntitlement.upsert({
        where: {
          accessPlanId_entitlementDefinitionId_effectiveFrom: {
            accessPlanId: plan.id,
            entitlementDefinitionId: definition.id,
            effectiveFrom,
          },
        },
        update: { enabled: typeof value === 'boolean' ? value : true, valueJson: value },
        create: {
          accessPlanId: plan.id,
          entitlementDefinitionId: definition.id,
          enabled: typeof value === 'boolean' ? value : true,
          valueJson: value,
          effectiveFrom,
        },
      });
    }
  }

  const offerSeeds = [
    { planCode: 'FREE', code: 'FREE-INDIVIDUAL', slug: 'gratis', name: 'Paket Gratis', billingModel: 'FREE', duration: null, amount: 0, compareAtAmount: null },
    { planCode: 'MEDIUM', code: 'MEDIUM-12M', slug: 'medium-12-bulan', name: 'Medium 12 Bulan', billingModel: 'ONE_TIME', duration: 365, amount: 25000, compareAtAmount: 499000 },
    { planCode: 'ADVANCED', code: 'ADVANCED-12M', slug: 'advanced-12-bulan', name: 'Advanced 12 Bulan', billingModel: 'ONE_TIME', duration: 365, amount: 50000, compareAtAmount: 899000 },
  ] as const;
  for (const offerSeed of offerSeeds) {
    const plan = plans.find((item) => item.code === offerSeed.planCode)!;
    const offer = await prisma.planOffer.upsert({
      where: { code: offerSeed.code },
      update: {
        accessPlanId: plan.id,
        slug: offerSeed.slug,
        name: offerSeed.name,
        billingModel: offerSeed.billingModel,
        accessDurationDays: offerSeed.duration,
        status: 'ACTIVE',
      },
      create: {
        accessPlanId: plan.id,
        code: offerSeed.code,
        slug: offerSeed.slug,
        name: offerSeed.name,
        audience: 'INDIVIDUAL',
        billingModel: offerSeed.billingModel,
        accessDurationDays: offerSeed.duration,
        status: 'ACTIVE',
        termsVersion: 'synthetic-v1',
        refundPolicyVersion: 'synthetic-v1',
      },
    });
    await prisma.offerPrice.deleteMany({ where: { planOfferId: offer.id } });
    await prisma.offerPrice.create({
      data: {
        planOfferId: offer.id,
        currency: 'IDR',
        amount: offerSeed.amount,
        compareAtAmount: offerSeed.compareAtAmount,
        taxMode: 'INCLUSIVE',
        effectiveFrom,
        status: 'ACTIVE',
      },
    });
  }
  console.log('✅ Access plans, entitlements, and synthetic offers created');

  // Hanya reset tenant sintetis milik seed. Data organisasi lain dipertahankan.
  const previousOrganization = await prisma.organization.findUnique({ where: { code: 'HIPMI' } });
  if (previousOrganization) {
    const tenantUsers = await prisma.user.findMany({
      where: { organizationId: previousOrganization.id },
      select: { id: true, teacher: { select: { id: true } } },
    });
    const userIds = tenantUsers.map((user) => user.id);
    const teacherIds = tenantUsers.map((user) => user.teacher?.id).filter((id): id is string => Boolean(id));

    // Restrictive reviewer/actor relations are cleared explicitly before the
    // tenant graph is removed. Every filter remains scoped to the synthetic org.
    await prisma.$transaction([
      prisma.submissionReview.deleteMany({ where: { reviewerId: { in: teacherIds } } }),
      prisma.storeReview.deleteMany({ where: { reviewerId: { in: teacherIds } } }),
      prisma.affiliateMetricVerification.deleteMany({ where: { reviewerId: { in: userIds } } }),
      prisma.earlyWarningAction.deleteMany({ where: { actorId: { in: userIds } } }),
      prisma.helpdeskMessage.deleteMany({ where: { authorId: { in: userIds } } }),
      prisma.consent.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.dataSubjectRequest.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.invitation.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.importJob.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.exportJob.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.publicStatistic.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.announcement.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.certificate.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.certificateTemplate.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.achievement.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.portfolioItem.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.helpdeskTicket.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.cmsContent.deleteMany({ where: { organizationId: previousOrganization.id } }),
      prisma.accessGrant.deleteMany({ where: { organizationId: previousOrganization.id } }),
    ]);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organization.delete({ where: { id: previousOrganization.id } });
  }
  await prisma.user.deleteMany({
    where: { email: { in: ['admin@lms.test', 'teacher@lms.test', 'student@lms.test', 'parent@lms.test'] } },
  });
  console.log('🧹 Tenant sintetis sebelumnya dibersihkan');

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      code: 'HIPMI',
      name: 'HIPMI Indonesia',
      description: 'Himpunan Pengusaha Muda Indonesia',
      isActive: true,
    },
  });
  console.log('✅ Organization created:', org.name);

  // 2. Create School
  const school = await prisma.school.upsert({
    where: { npsn: '12345678' },
    update: {},
    create: {
      organizationId: org.id,
      npsn: '12345678',
      code: 'SMK-01',
      name: 'SMK Negeri 1 Jakarta',
      level: 'SMK',
      address: 'Jl. Pendidikan No. 1',
      province: 'DKI Jakarta',
      city: 'Jakarta Pusat',
      district: 'Menteng',
      principal: 'Dr. Budi Santoso',
      picName: 'Ahmad Yani',
      picPhone: '08123456789',
      picEmail: 'admin@smkn1jakarta.sch.id',
      status: 'ACTIVE',
      isActive: true,
    },
  });
  console.log('✅ School created:', school.name);

  // 3. Create Roles
  const superAdminRole = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'super-admin' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Super Admin',
      slug: 'super-admin',
      description: 'Full system access',
      isSystem: true,
    },
  });

  const studentRole = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'student' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Siswa',
      slug: 'student',
      description: 'Role untuk siswa',
      isSystem: true,
    },
  });

  const teacherRole = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'teacher' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Guru',
      slug: 'teacher',
      description: 'Role untuk guru',
      isSystem: true,
    },
  });

  const schoolAdminRole = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'school-admin' } },
    update: {},
    create: { organizationId: org.id, name: 'Admin Sekolah', slug: 'school-admin', description: 'Mengelola master data sekolah', isSystem: true },
  });

  const parentRole = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'parent' } },
    update: {},
    create: { organizationId: org.id, name: 'Orang Tua/Wali', slug: 'parent', description: 'Memantau anak yang terverifikasi', isSystem: true },
  });

  await Promise.all([
    ['reviewer', 'Reviewer Akademik'],
    ['identity-verifier', 'Verifier Identitas'],
    ['program-manager', 'Program Manager'],
    ['support', 'Petugas Dukungan'],
  ].map(([slug, name]) => prisma.role.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug } },
    update: {},
    create: { organizationId: org.id, name, slug, isSystem: true },
  })));

  console.log('✅ Roles created');

  // 4. Create Permissions
  const permissions = [
    { resource: 'dashboard', action: 'read' },
    { resource: 'assignments', action: 'read' },
    { resource: 'assignments', action: 'create' },
    { resource: 'assignments', action: 'update' },
    { resource: 'assignments', action: 'delete' },
    { resource: 'submissions', action: 'read' },
    { resource: 'submissions', action: 'create' },
    { resource: 'submissions', action: 'update' },
    { resource: 'submissions', action: 'review' },
    { resource: 'materials', action: 'read' },
    { resource: 'materials', action: 'create' },
    { resource: 'materials', action: 'update' },
    { resource: 'materials', action: 'delete' },
    { resource: 'master-data', action: 'read' },
    { resource: 'master-data', action: 'create' },
    { resource: 'master-data', action: 'update' },
    { resource: 'master-data', action: 'delete' },
    { resource: 'master-data', action: 'import' },
    { resource: 'affiliate', action: 'read' },
    { resource: 'affiliate', action: 'create' },
    { resource: 'affiliate', action: 'verify' },
    { resource: 'affiliate', action: 'import' },
    { resource: 'identity', action: 'create' },
    { resource: 'identity', action: 'verify' },
    { resource: 'identity.document', action: 'read' },
    { resource: 'privacy', action: 'manage' },
    { resource: 'leads', action: 'read' },
    { resource: 'leads', action: 'update' },
    { resource: 'monitoring', action: 'read' },
    { resource: 'monitoring', action: 'manage' },
    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'export' },
    { resource: 'public-statistics', action: 'approve' },
    { resource: 'notifications', action: 'read' },
    { resource: 'notifications', action: 'update' },
    { resource: 'announcements', action: 'read' },
    { resource: 'announcements', action: 'manage' },
    { resource: 'certificates', action: 'read' },
    { resource: 'certificates', action: 'update' },
    { resource: 'certificates', action: 'manage' },
    { resource: 'achievements', action: 'read' },
    { resource: 'achievements', action: 'manage' },
    { resource: 'portfolio', action: 'read' },
    { resource: 'portfolio', action: 'create' },
    { resource: 'portfolio', action: 'update' },
    { resource: 'helpdesk', action: 'read' },
    { resource: 'helpdesk', action: 'create' },
    { resource: 'helpdesk', action: 'update' },
    { resource: 'helpdesk', action: 'manage' },
    { resource: 'cms', action: 'manage' },
    { resource: 'analytics', action: 'create' },
    { resource: 'offline-drafts', action: 'update' },
    { resource: 'access-plans', action: 'read' },
    { resource: 'access-plans', action: 'manage' },
    { resource: 'access-grants', action: 'read' },
    { resource: 'access-grants', action: 'manage' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: {
        organizationId_resource_action: {
          organizationId: org.id,
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        resource: perm.resource,
        action: perm.action,
        isSystem: true,
      },
    });
  }
  console.log('✅ Permissions created');

  // 4b. Assign Permissions to Roles
  const allPerms = await prisma.permission.findMany({ where: { organizationId: org.id } });

  // Helper to find perm ID
  const getPermId = (resource: string, action: string) =>
    allPerms.find(p => p.resource === resource && p.action === action)?.id || '';

  // Student Permissions
  const studentPerms = [
    { res: 'dashboard', act: 'read' },
    { res: 'assignments', act: 'read' },
    { res: 'materials', act: 'read' },
    { res: 'submissions', act: 'create' },
    { res: 'submissions', act: 'read' },
    { res: 'submissions', act: 'update' },
    { res: 'affiliate', act: 'read' },
    { res: 'affiliate', act: 'create' },
    { res: 'identity', act: 'create' },
    { res: 'monitoring', act: 'read' },
    { res: 'reports', act: 'read' },
    { res: 'reports', act: 'export' },
    { res: 'notifications', act: 'read' },
    { res: 'notifications', act: 'update' },
    { res: 'announcements', act: 'read' },
    { res: 'certificates', act: 'read' },
    { res: 'certificates', act: 'update' },
    { res: 'achievements', act: 'read' },
    { res: 'portfolio', act: 'read' },
    { res: 'portfolio', act: 'create' },
    { res: 'portfolio', act: 'update' },
    { res: 'helpdesk', act: 'read' },
    { res: 'helpdesk', act: 'create' },
    { res: 'helpdesk', act: 'update' },
    { res: 'analytics', act: 'create' },
    { res: 'offline-drafts', act: 'update' },
  ];

  // Teacher Permissions
  const teacherPerms = [
    { res: 'dashboard', act: 'read' },
    { res: 'assignments', act: 'read' },
    { res: 'assignments', act: 'create' },
    { res: 'assignments', act: 'update' },
    { res: 'assignments', act: 'delete' },
    { res: 'materials', act: 'read' },
    { res: 'materials', act: 'create' },
    { res: 'materials', act: 'update' },
    { res: 'materials', act: 'delete' },
    { res: 'submissions', act: 'read' },
    { res: 'submissions', act: 'review' },
    { res: 'affiliate', act: 'read' },
    { res: 'affiliate', act: 'verify' },
    { res: 'affiliate', act: 'import' },
    { res: 'monitoring', act: 'read' },
    { res: 'monitoring', act: 'manage' },
    { res: 'reports', act: 'read' },
    { res: 'reports', act: 'export' },
    { res: 'notifications', act: 'read' },
    { res: 'notifications', act: 'update' },
    { res: 'announcements', act: 'read' },
    { res: 'announcements', act: 'manage' },
    { res: 'certificates', act: 'read' },
    { res: 'certificates', act: 'manage' },
    { res: 'achievements', act: 'read' },
    { res: 'achievements', act: 'manage' },
    { res: 'portfolio', act: 'read' },
    { res: 'helpdesk', act: 'read' },
    { res: 'helpdesk', act: 'create' },
    { res: 'helpdesk', act: 'update' },
    { res: 'helpdesk', act: 'manage' },
    { res: 'analytics', act: 'create' },
  ];

  // Assign to Student Role
  for (const p of studentPerms) {
    const permId = getPermId(p.res, p.act);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: studentRole.id, permissionId: permId } },
        update: {},
        create: { roleId: studentRole.id, permissionId: permId },
      });
    }
  }

  // Assign to Teacher Role
  for (const p of teacherPerms) {
    const permId = getPermId(p.res, p.act);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: teacherRole.id, permissionId: permId } },
        update: {},
        create: { roleId: teacherRole.id, permissionId: permId },
      });
    }
  }

  const schoolAdminPerms = allPerms.filter((permission) =>
    ['dashboard', 'master-data', 'privacy', 'leads', 'monitoring', 'reports', 'public-statistics', 'notifications', 'announcements', 'certificates', 'achievements', 'portfolio', 'helpdesk', 'cms', 'analytics', 'offline-drafts', 'access-grants'].includes(permission.resource),
  );
  for (const permission of schoolAdminPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: schoolAdminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: schoolAdminRole.id, permissionId: permission.id },
    });
  }

  for (const [resource, action] of [
    ['dashboard', 'read'], ['monitoring', 'read'], ['reports', 'read'], ['reports', 'export'],
    ['notifications', 'read'], ['notifications', 'update'], ['announcements', 'read'], ['certificates', 'read'],
    ['achievements', 'read'], ['portfolio', 'read'], ['helpdesk', 'read'], ['helpdesk', 'create'], ['helpdesk', 'update'],
    ['analytics', 'create'],
  ] as const) {
    const permissionId = getPermId(resource, action);
    if (permissionId) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: parentRole.id, permissionId } },
        update: {},
        create: { roleId: parentRole.id, permissionId },
      });
    }
  }

  const programManagerRole = await prisma.role.findFirstOrThrow({ where: { organizationId: org.id, slug: 'program-manager' } });
  for (const permission of allPerms.filter((item) => ['dashboard', 'monitoring', 'reports', 'public-statistics', 'notifications', 'announcements', 'certificates', 'achievements', 'portfolio', 'helpdesk', 'cms', 'analytics', 'offline-drafts', 'leads'].includes(item.resource))) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: programManagerRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: programManagerRole.id, permissionId: permission.id },
    });
  }

  const supportRole = await prisma.role.findFirstOrThrow({ where: { organizationId: org.id, slug: 'support' } });
  for (const permission of allPerms.filter((item) => ['notifications', 'announcements', 'helpdesk'].includes(item.resource))) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: supportRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: supportRole.id, permissionId: permission.id },
    });
  }
  const identityVerifierRole = await prisma.role.findFirstOrThrow({ where: { organizationId: org.id, slug: 'identity-verifier' } });
  for (const permission of allPerms.filter((item) =>
    (item.resource === 'identity' && item.action === 'verify') ||
    (item.resource === 'identity.document' && item.action === 'read'),
  )) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: identityVerifierRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: identityVerifierRole.id, permissionId: permission.id },
    });
  }
  console.log('✅ Permissions assigned to roles');

  // 5. Create Admin User
  const passwordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@lms.test' },
    update: {},
    create: {
      email: 'admin@lms.test',
      username: 'admin',
      passwordHash,
      firstName: 'Admin',
      lastName: 'LMS',
      organizationId: org.id,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
      schoolId: school.id,
    },
  });
  console.log('✅ Admin user created: admin@lms.test / admin123');

  // 6. Create Class
  const kelas = await prisma.class.create({
    data: {
      schoolId: school.id,
      name: 'XII RPL 1',
      code: 'XII-RPL-1',
      grade: 12,
      capacity: 36,
      isActive: true,
    },
  });
  console.log('✅ Class created:', kelas.name);

  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      name: '2026/2027',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2027-06-30T23:59:59.000Z'),
      isActive: true,
    },
  });
  const semester = await prisma.semester.create({
    data: {
      academicYearId: academicYear.id,
      name: 'Ganjil',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.000Z'),
      isActive: true,
    },
  });
  console.log('✅ Tahun ajaran dan semester aktif dibuat');

  // 7. Create Student User & Student
  const studentPasswordHash = await bcrypt.hash('student123', 10);
  const studentUser = await prisma.user.create({
    data: {
      email: 'student@lms.test',
      passwordHash: studentPasswordHash,
      firstName: 'Andi',
      lastName: 'Wijaya',
      organizationId: org.id,
      status: 'ACTIVE',
    },
  });

  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      schoolId: school.id,
      classId: kelas.id,
      studentNumber: '2024001',
      fullName: 'Andi Wijaya',
      birthPlace: 'Jakarta',
      birthDate: new Date('2007-05-15'),
      gender: 'L',
      address: 'Jl. Kebon Jeruk No. 10',
      phone: '08123456789',
      status: 'ACTIVE',
    },
  });

  await prisma.userRole.create({
    data: {
      userId: studentUser.id,
      roleId: studentRole.id,
      schoolId: school.id,
    },
  });
  await prisma.classEnrollment.create({
    data: {
      studentId: student.id,
      classId: kelas.id,
      schoolId: school.id,
      academicYearId: academicYear.id,
      semesterId: semester.id,
      effectiveFrom: academicYear.startDate,
    },
  });
  console.log('✅ Student created: student@lms.test / student123');

  // 8. Create Teacher User & Teacher
  const teacherPasswordHash = await bcrypt.hash('teacher123', 10);
  const teacherUser = await prisma.user.create({
    data: {
      email: 'teacher@lms.test',
      passwordHash: teacherPasswordHash,
      firstName: 'Siti',
      lastName: 'Nurhaliza',
      organizationId: org.id,
      status: 'ACTIVE',
    },
  });

  const teacher = await prisma.teacher.create({
    data: {
      userId: teacherUser.id,
      schoolId: school.id,
      fullName: 'Siti Nurhaliza, S.Pd',
      phone: '08198765432',
      isActive: true,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: teacherUser.id,
      roleId: teacherRole.id,
      schoolId: school.id,
    },
  });
  console.log('✅ Teacher created: teacher@lms.test / teacher123');

  // 8b. Create Parent User & verified parent-child relation
  const parentPasswordHash = await bcrypt.hash('parent123', 10);
  const parentUser = await prisma.user.create({
    data: {
      email: 'parent@lms.test',
      passwordHash: parentPasswordHash,
      firstName: 'Bapak',
      lastName: 'Wijaya',
      organizationId: org.id,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  const parent = await prisma.parent.create({
    data: { userId: parentUser.id, fullName: 'Bapak Wijaya', phone: '081200000001' },
  });
  await prisma.userRole.create({
    data: { userId: parentUser.id, roleId: parentRole.id, schoolId: school.id },
  });
  await prisma.studentParent.create({
    data: {
      studentId: student.id,
      parentId: parent.id,
      relationship: 'AYAH',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedBy: adminUser.id,
    },
  });
  console.log('✅ Parent created: parent@lms.test / parent123');

  // 9. Create LMS structure
  const program = await prisma.program.create({
    data: {
      organizationId: org.id,
      schoolId: school.id,
      code: 'WIRAUSAHA-DIGITAL',
      name: 'Wirausaha Digital Inklusif',
      description: 'Program praktik membangun identitas usaha dan pemasaran digital yang aman.',
      createdById: teacherUser.id,
    },
  });
  const course = await prisma.course.create({
    data: {
      organizationId: org.id,
      schoolId: school.id,
      programId: program.id,
      name: 'Digital Marketing & Affiliate',
      code: 'DMA-101',
      description: 'Pembelajaran praktik digital marketing melalui video affiliate',
      isActive: true,
    },
  });
  const courseModule = await prisma.courseModule.create({
    data: { courseId: course.id, createdById: teacherUser.id, title: 'Membangun Toko Digital', description: 'Dari identitas toko sampai bukti operasional.', position: 1, isPublished: true },
  });
  const lesson = await prisma.lesson.create({
    data: { moduleId: courseModule.id, createdById: teacherUser.id, title: 'Menyiapkan Profil Toko yang Aman', summary: 'Pelajari data yang boleh dibagikan dan cara membuat profil toko.', position: 1, estimatedMinutes: 25, isPublished: true },
  });
  await prisma.material.create({
    data: { courseId: course.id, teacherId: teacher.id, lessonId: lesson.id, title: 'Panduan Profil Toko Aman', type: 'TEXT', content: 'Gunakan URL publik toko. Jangan pernah mengunggah password, PIN, OTP, cookie, atau data pembayaran sensitif.' },
  });
  await prisma.courseEnrollment.create({ data: { courseId: course.id, studentId: student.id, schoolId: school.id } });
  console.log('✅ Course created:', course.name);

  // 10. Create rubrics, checklist, and assignments
  const rubric = await prisma.rubric.create({
    data: {
      organizationId: org.id,
      name: 'Rubrik Toko Digital Dasar',
      description: 'Penilaian profil, produk, operasional, dan orisinalitas toko.',
      criteria: {
        create: [
          { name: 'Profil toko', description: 'Identitas dan tampilan toko lengkap serta rapi.', weight: 25, maxScore: 100, position: 1 },
          { name: 'Kelengkapan produk', description: 'Produk memiliki foto, judul, deskripsi, harga, dan stok.', weight: 35, maxScore: 100, position: 2 },
          { name: 'Operasional', description: 'Pengiriman dan informasi layanan telah disiapkan.', weight: 20, maxScore: 100, position: 3 },
          { name: 'Orisinalitas & keamanan', description: 'Bukti orisinal dan bebas data sensitif.', weight: 20, maxScore: 100, position: 4 },
        ],
      },
    },
  });
  const checklistTemplate = await prisma.storeChecklistTemplate.create({
    data: {
      organizationId: org.id,
      schoolId: school.id,
      createdById: teacherUser.id,
      name: 'Checklist Toko Pemula',
      minimumProducts: 3,
      items: {
        create: [
          { code: 'PROFIL', label: 'Nama, logo, banner, dan deskripsi toko lengkap', evidenceType: 'SCREENSHOT', weight: 25, isRequired: true, position: 1 },
          { code: 'PRODUK', label: 'Minimal tiga produk memiliki foto, judul, harga, dan stok', evidenceType: 'SCREENSHOT', weight: 40, isRequired: true, position: 2 },
          { code: 'OPERASIONAL', label: 'Pengiriman dan alamat toko telah diatur', evidenceType: 'SCREEN_RECORDING', weight: 20, isRequired: true, position: 3 },
          { code: 'AMAN', label: 'Bukti tidak menampilkan password, PIN, OTP, atau data pembayaran', evidenceType: 'DECLARATION', weight: 15, isRequired: true, position: 4 },
        ],
      },
    },
  });
  const assignment = await prisma.assignment.create({
    data: {
      courseId: course.id,
      moduleId: courseModule.id,
      teacherId: teacher.id,
      title: 'Tugas Video Affiliate TikTok - Produk Fashion',
      description: 'Buat video promosi produk fashion di TikTok dengan durasi 30-60 detik',
      type: 'AFFILIATE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 hari dari sekarang
      maxScore: 100,
      targetViews: 1000,
      targetClicks: 50,
      targetOrders: 5,
      isActive: true,
      publishedAt: new Date(),
    },
  });
  const storeAssignment = await prisma.assignment.create({
    data: {
      courseId: course.id,
      moduleId: courseModule.id,
      teacherId: teacher.id,
      title: 'Bangun dan Dokumentasikan Toko Digital',
      description: 'Buat toko publik tanpa membagikan kredensial. Lengkapi checklist, unggah beberapa bukti, lalu kirim untuk review.',
      type: 'STORE',
      rubricId: rubric.id,
      checklistTemplateId: checklistTemplate.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      maxScore: 100,
      isActive: true,
      publishedAt: new Date(),
    },
  });
  await prisma.teacherAssignment.create({
    data: {
      teacherId: teacher.id,
      classId: kelas.id,
      schoolId: school.id,
      courseId: course.id,
      subject: course.name,
      effectiveFrom: academicYear.startDate,
    },
  });
  console.log('✅ Assignment created:', assignment.title);
  console.log('✅ Store assignment created:', storeAssignment.title);

  console.log('\n🎉 Seeding completed!');
  console.log('\n📋 Login credentials:');
  console.log('   Admin:   admin@lms.test / admin123');
  console.log('   Teacher: teacher@lms.test / teacher123');
  console.log('   Student: student@lms.test / student123');
  console.log('   Parent:  parent@lms.test / parent123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
