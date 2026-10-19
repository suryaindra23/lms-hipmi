import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

export const options = {
  scenarios: {
    dashboard_reads: { executor: 'constant-vus', vus: Number(__ENV.VUS || 10), duration: __ENV.DURATION || '30s' },
  },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1500'] },
};

export function setup() {
  const response = http.post(`${baseUrl}/auth/login`, JSON.stringify({ email: __ENV.TEST_EMAIL, password: __ENV.TEST_PASSWORD, ...(__ENV.TEST_OTP ? { otp: __ENV.TEST_OTP } : {}) }), { headers: { 'content-type': 'application/json' } });
  check(response, { 'login succeeds': (result) => result.status === 200 });
  if (response.status !== 200) throw new Error('Load test login failed');
  return { token: response.json('accessToken') };
}

export default function (data) {
  const response = http.get(`${baseUrl}/${__ENV.DASHBOARD_PATH || 'dashboard/school'}`, { headers: { authorization: `Bearer ${data.token}` } });
  check(response, { 'dashboard authorized': (result) => result.status === 200 });
  sleep(0.5);
}
