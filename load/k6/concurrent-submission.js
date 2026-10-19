import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
export const options = {
  scenarios: { concurrent_save: { executor: 'per-vu-iterations', vus: Number(__ENV.VUS || 20), iterations: 1, maxDuration: '1m' } },
  thresholds: { http_req_duration: ['p(95)<2000'] },
};

export default function () {
  if (__ENV.ALLOW_MUTATION_LOAD !== 'yes') throw new Error('Set ALLOW_MUTATION_LOAD=yes on an isolated test environment');
  const payload = JSON.parse(__ENV.SUBMISSION_PAYLOAD || '{}');
  const response = http.post(`${baseUrl}/student-store/submissions/draft`, JSON.stringify(payload), { headers: { authorization: `Bearer ${__ENV.ACCESS_TOKEN}`, 'content-type': 'application/json' } });
  check(response, { 'no unhandled server error': (result) => result.status < 500, 'conflict is explicit': (result) => [200, 201, 409].includes(result.status) });
}
