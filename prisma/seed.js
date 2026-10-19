import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
    console.log('🌱 Seeding database...');
    // 1. Create Organization
    const org = await prisma.organization.upsert({
        where: { code: 'HIPMI' },
        update: {},
        create: {
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
    console.log('✅ Roles created');
    // 4. Create Permissions
    const permissions = [
        { resource: 'dashboard', action: 'read' },
        { resource: 'assignments', action: 'read' },
        { resource: 'assignments', action: 'create' },
        { resource: 'submissions', action: 'read' },
        { resource: 'submissions', action: 'create' },
        { resource: 'submissions', action: 'review' },
        { resource: 'affiliate', action: 'read' },
        { resource: 'affiliate', action: 'create' },
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
    await prisma.userRole.upsert({
        where: {
            userId_roleId_schoolId: {
                userId: adminUser.id,
                roleId: superAdminRole.id,
                schoolId: null,
            },
        },
        update: {},
        create: {
            userId: adminUser.id,
            roleId: superAdminRole.id,
        },
    }).catch(async () => {
        const existing = await prisma.userRole.findFirst({
            where: { userId: adminUser.id, roleId: superAdminRole.id },
        });
        if (!existing) {
            await prisma.userRole.create({
                data: { userId: adminUser.id, roleId: superAdminRole.id },
            });
        }
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
            nisn: '0012345678',
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
    // 9. Create Course
    const course = await prisma.course.create({
        data: {
            organizationId: org.id,
            schoolId: school.id,
            name: 'Digital Marketing & Affiliate',
            code: 'DMA-101',
            description: 'Pembelajaran praktik digital marketing melalui video affiliate',
            isActive: true,
        },
    });
    console.log('✅ Course created:', course.name);
    // 10. Create Assignment
    const assignment = await prisma.assignment.create({
        data: {
            courseId: course.id,
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
        },
    });
    console.log('✅ Assignment created:', assignment.title);
    console.log('\n🎉 Seeding completed!');
    console.log('\n📋 Login credentials:');
    console.log('   Admin:   admin@lms.test / admin123');
    console.log('   Teacher: teacher@lms.test / teacher123');
    console.log('   Student: student@lms.test / student123');
}
main()
    .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
