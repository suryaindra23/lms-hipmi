import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const forbidden = tracked.filter((file) =>
  file === '.env'
  || file === '.env.production'
  || file.startsWith('node_modules/')
  || file.includes('/node_modules/')
  || file.startsWith('apps/api/dist/')
  || file.includes('/.next/')
  || file.startsWith('backups/'),
);

if (forbidden.length > 0) {
  console.error('Repository masih melacak file hasil build, dependency, backup, atau environment:');
  for (const file of forbidden.slice(0, 30)) console.error(`- ${file}`);
  if (forbidden.length > 30) console.error(`- dan ${forbidden.length - 30} file lainnya`);
  process.exit(1);
}

console.log('Repository hygiene: lulus (tidak ada dependency, build, backup, atau secret lokal yang terlacak).');
