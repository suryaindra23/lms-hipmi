import { PrismaClient } from '@prisma/client';
import { createCipheriv, createHmac, randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();
const secret = process.env.ENCRYPTION_KEY || 'a-very-secret-key-32-chars-long!!';
const key = scryptSync(secret, 'salt', 32);
const blindKey = process.env.BLIND_INDEX_KEY || secret;

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

function blindIndex(value: string) {
  return createHmac('sha256', blindKey).update(`NISN:${value.replace(/\s+/g, '').toUpperCase()}`).digest('hex');
}

async function main() {
  const students = await prisma.student.findMany({ where: { nisn: { not: null } }, select: { id: true, nisn: true } });
  for (const student of students) {
    if (!student.nisn) continue;
    await prisma.$transaction([
      prisma.studentIdentifier.upsert({
        where: { studentId_type: { studentId: student.id, type: 'NISN' } },
        update: { valueEncrypted: encrypt(student.nisn), blindIndex: blindIndex(student.nisn), last4: student.nisn.slice(-4) },
        create: { studentId: student.id, type: 'NISN', valueEncrypted: encrypt(student.nisn), blindIndex: blindIndex(student.nisn), last4: student.nisn.slice(-4) },
      }),
      prisma.student.update({ where: { id: student.id }, data: { nisn: null } }),
    ]);
  }
  console.log(`Migrated ${students.length} legacy student identifier(s)`);
}

main().finally(() => prisma.$disconnect());
