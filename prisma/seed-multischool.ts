import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const schools = [
  { code: 'SMK-BDG-01', npsn: '90000001', slug: 'bandung', name: 'SMK Bina Digital Bandung', level: 'SMK', address: 'Jl. Asia Afrika No. 25', province: 'Jawa Barat', city: 'Bandung', district: 'Sumur Bandung', principal: 'Dra. Ratna Kusumawati' },
  { code: 'SMA-SBY-01', npsn: '90000002', slug: 'surabaya', name: 'SMA Harapan Bangsa Surabaya', level: 'SMA', address: 'Jl. Pemuda No. 18', province: 'Jawa Timur', city: 'Surabaya', district: 'Genteng', principal: 'Drs. Hendra Wijaya' },
  { code: 'SMK-YK-01', npsn: '90000003', slug: 'yogyakarta', name: 'SMK Teknologi Mandiri Yogyakarta', level: 'SMK', address: 'Jl. Kaliurang Km. 5', province: 'DI Yogyakarta', city: 'Sleman', district: 'Depok', principal: 'Ir. Dwi Lestari, M.Pd' },
  { code: 'SMA-MKS-01', npsn: '90000004', slug: 'makassar', name: 'SMA Cendekia Makassar', level: 'SMA', address: 'Jl. Sultan Alauddin No. 40', province: 'Sulawesi Selatan', city: 'Makassar', district: 'Rappocini', principal: 'Nur Aisyah, S.Pd., M.Pd' },
  { code: 'SMK-MDN-01', npsn: '90000005', slug: 'medan', name: 'SMK Digital Nusantara Medan', level: 'SMK', address: 'Jl. Gatot Subroto No. 88', province: 'Sumatera Utara', city: 'Medan', district: 'Medan Petisah', principal: 'Muhammad Fadli, S.Kom' },
] as const;

const studentNames = [
  ['Alya', 'Putri Ramadhani'],
  ['Bagas', 'Pratama'],
  ['Citra', 'Maharani'],
  ['Dimas', 'Saputra'],
  ['Farah', 'Nabila'],
  ['Galang', 'Aditya'],
  ['Hana', 'Safitri'],
  ['Ilham', 'Maulana'],
  ['Keisya', 'Azzahra'],
  ['Raka', 'Firmansyah'],
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Data dummy multi-sekolah tidak boleh dibuat di production');
  }

  const organization = await prisma.organization.findUnique({ where: { code: 'HIPMI' } });
  if (!organization) throw new Error('Tenant HIPMI belum tersedia. Jalankan seed utama terlebih dahulu.');
  const studentRole = await prisma.role.findUnique({
    where: { organizationId_slug: { organizationId: organization.id, slug: 'student' } },
  });
  if (!studentRole) throw new Error('Role siswa untuk tenant HIPMI belum tersedia.');

  const passwordHash = await bcrypt.hash('student123', 10);

  for (const [schoolIndex, definition] of schools.entries()) {
    const existingSchool = await prisma.school.findUnique({ where: { npsn: definition.npsn } });
    if (existingSchool && existingSchool.organizationId !== organization.id) {
      throw new Error(`NPSN dummy ${definition.npsn} sudah digunakan organisasi lain`);
    }
    const school = await prisma.school.upsert({
      where: { npsn: definition.npsn },
      update: {
        name: definition.name,
        code: definition.code,
        level: definition.level,
        address: definition.address,
        province: definition.province,
        city: definition.city,
        district: definition.district,
        principal: definition.principal,
        status: 'ACTIVE',
        isActive: true,
      },
      create: {
        organizationId: organization.id,
        npsn: definition.npsn,
        code: definition.code,
        name: definition.name,
        level: definition.level,
        address: definition.address,
        province: definition.province,
        city: definition.city,
        district: definition.district,
        principal: definition.principal,
        picName: `Admin ${definition.city}`,
        picPhone: `08130000${String(schoolIndex + 1).padStart(4, '0')}`,
        picEmail: `admin.${definition.slug}@lms.test`,
        status: 'ACTIVE',
        onboardingStep: 5,
        joinedAt: new Date('2026-07-01T00:00:00.000Z'),
        isActive: true,
      },
    });

    const classes = await Promise.all([
      prisma.class.upsert({
        where: { schoolId_code: { schoolId: school.id, code: 'X-RPL-1' } },
        update: { name: 'X RPL 1', grade: 10, capacity: 36, isActive: true },
        create: { schoolId: school.id, code: 'X-RPL-1', name: 'X RPL 1', grade: 10, capacity: 36, isActive: true },
      }),
      prisma.class.upsert({
        where: { schoolId_code: { schoolId: school.id, code: 'X-DKV-1' } },
        update: { name: 'X DKV 1', grade: 10, capacity: 36, isActive: true },
        create: { schoolId: school.id, code: 'X-DKV-1', name: 'X DKV 1', grade: 10, capacity: 36, isActive: true },
      }),
    ]);

    let academicYear = await prisma.academicYear.findFirst({
      where: { schoolId: school.id, name: '2026/2027' },
    });
    academicYear = academicYear
      ? await prisma.academicYear.update({
          where: { id: academicYear.id },
          data: { startDate: new Date('2026-07-01T00:00:00.000Z'), endDate: new Date('2027-06-30T23:59:59.000Z'), isActive: true },
        })
      : await prisma.academicYear.create({
          data: { schoolId: school.id, name: '2026/2027', startDate: new Date('2026-07-01T00:00:00.000Z'), endDate: new Date('2027-06-30T23:59:59.000Z'), isActive: true },
        });

    let semester = await prisma.semester.findFirst({
      where: { academicYearId: academicYear.id, name: 'Ganjil' },
    });
    semester = semester
      ? await prisma.semester.update({
          where: { id: semester.id },
          data: { startDate: new Date('2026-07-01T00:00:00.000Z'), endDate: new Date('2026-12-31T23:59:59.000Z'), isActive: true },
        })
      : await prisma.semester.create({
          data: { academicYearId: academicYear.id, name: 'Ganjil', startDate: new Date('2026-07-01T00:00:00.000Z'), endDate: new Date('2026-12-31T23:59:59.000Z'), isActive: true },
        });

    for (const [studentIndex, [firstName, lastName]] of studentNames.entries()) {
      const email = `siswa${String(studentIndex + 1).padStart(2, '0')}.${definition.slug}@lms.test`;
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser?.organizationId && existingUser.organizationId !== organization.id) {
        throw new Error(`Email dummy ${email} sudah digunakan organisasi lain`);
      }
      const user = await prisma.user.upsert({
        where: { email },
        update: { firstName, lastName, organizationId: organization.id, status: 'ACTIVE', emailVerified: true },
        create: { email, passwordHash, firstName, lastName, organizationId: organization.id, status: 'ACTIVE', emailVerified: true },
      });
      const targetClass = classes[studentIndex % classes.length];
      const student = await prisma.student.upsert({
        where: { userId: user.id },
        update: { schoolId: school.id, classId: targetClass.id, studentNumber: `2026${String(studentIndex + 1).padStart(3, '0')}`, fullName: `${firstName} ${lastName}`, birthPlace: definition.city, gender: studentIndex % 2 === 0 ? 'P' : 'L', status: 'ACTIVE' },
        create: {
          userId: user.id,
          schoolId: school.id,
          classId: targetClass.id,
          studentNumber: `2026${String(studentIndex + 1).padStart(3, '0')}`,
          fullName: `${firstName} ${lastName}`,
          birthPlace: definition.city,
          birthDate: new Date(Date.UTC(2007 + (studentIndex % 2), studentIndex % 12, 5 + studentIndex)),
          gender: studentIndex % 2 === 0 ? 'P' : 'L',
          address: `${definition.address}, ${definition.city}`,
          phone: `0812${String(schoolIndex + 1).padStart(2, '0')}${String(studentIndex + 1).padStart(6, '0')}`,
          status: 'ACTIVE',
          activatedAt: new Date('2026-07-01T00:00:00.000Z'),
        },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId_schoolId: { userId: user.id, roleId: studentRole.id, schoolId: school.id } },
        update: {},
        create: { userId: user.id, roleId: studentRole.id, schoolId: school.id },
      });
      const enrollment = await prisma.classEnrollment.findFirst({
        where: { studentId: student.id, schoolId: school.id, academicYearId: academicYear.id },
      });
      if (enrollment) {
        await prisma.classEnrollment.update({
          where: { id: enrollment.id },
          data: { classId: targetClass.id, semesterId: semester.id, status: 'ACTIVE', effectiveUntil: null },
        });
      } else {
        await prisma.classEnrollment.create({
          data: { studentId: student.id, classId: targetClass.id, schoolId: school.id, academicYearId: academicYear.id, semesterId: semester.id, effectiveFrom: academicYear.startDate },
        });
      }
    }

    console.log(`✅ ${school.name}: 2 kelas, 10 siswa`);
  }

  console.log('\nData dummy multi-sekolah siap. Password seluruh akun siswa: student123');
}

main()
  .catch((error) => {
    console.error('❌ Gagal membuat data dummy multi-sekolah:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
