const apiUrl = (process.env.SMOKE_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Smoke test akun seed tidak boleh dijalankan dengan NODE_ENV=production.');
}

const accounts = [
  {
    label: 'Super Admin',
    email: process.env.SMOKE_ADMIN_EMAIL || 'admin@lms.test',
    password: process.env.SMOKE_ADMIN_PASSWORD || 'admin123',
    role: 'super-admin',
    checks: ['/auth/account', '/commerce/admin/orders'],
  },
  {
    label: 'Guru',
    email: process.env.SMOKE_TEACHER_EMAIL || 'teacher@lms.test',
    password: process.env.SMOKE_TEACHER_PASSWORD || 'teacher123',
    role: 'teacher',
    checks: ['/dashboard/teacher', '/support/notifications'],
  },
  {
    label: 'Siswa',
    email: process.env.SMOKE_STUDENT_EMAIL || 'student@lms.test',
    password: process.env.SMOKE_STUDENT_PASSWORD || 'student123',
    role: 'student',
    checks: ['/dashboard/student', '/assignments'],
  },
  {
    label: 'Orang Tua',
    email: process.env.SMOKE_PARENT_EMAIL || 'parent@lms.test',
    password: process.env.SMOKE_PARENT_PASSWORD || 'parent123',
    role: 'parent',
    checks: ['/auth/account', '/support/notifications'],
  },
];

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

for (const account of accounts) {
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const headers = { authorization: `Bearer ${login.accessToken}` };
  try {
    const profile = await request('/auth/me', { headers });
    if (!Array.isArray(profile.roles) || !profile.roles.includes(account.role)) {
      throw new Error(`${account.label}: role ${account.role} tidak ditemukan`);
    }
    await request('/auth/schools', { headers });
    for (const path of account.checks) await request(path, { headers });
    console.log(`✓ ${account.label}: login, role, sekolah, dan ${account.checks.length} endpoint utama lulus`);
  } finally {
    if (login.refreshToken) {
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: login.refreshToken }),
      });
    }
  }
}

console.log(`Smoke test ${accounts.length} peran selesai tanpa kegagalan.`);
