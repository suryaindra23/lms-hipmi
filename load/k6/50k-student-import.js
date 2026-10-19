import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
export const options = { scenarios: { seed: { executor: 'shared-iterations', vus: 1, iterations: 5, maxDuration: '30m' } } };

export default function () {
  if (__ENV.ALLOW_50K_LOAD !== 'yes') throw new Error('Set ALLOW_50K_LOAD=yes only on an isolated performance database');
  const batch = __ITER;
  const rows = Array.from({ length: 10_000 }, (_, index) => {
    const number = batch * 10_000 + index + 1;
    return { email: `load.student.${number}@example.invalid`, studentNumber: `LOAD${String(number).padStart(8, '0')}`, fullName: `Siswa Uji ${number}` };
  });
  const response = http.post(`${baseUrl}/imports/students`, JSON.stringify({ sourceName: `phase8-load-${batch + 1}.json`, rows }), { headers: { authorization: `Bearer ${__ENV.ACCESS_TOKEN}`, 'content-type': 'application/json' }, timeout: '5m' });
  check(response, { '10k batch accepted': (result) => [200, 201].includes(result.status) });
}
