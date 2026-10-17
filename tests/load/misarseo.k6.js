// k6 load test against read-only, free MisarSEO endpoints.
//
//   k6 run -e MISARSEO_API_KEY=mseo_… sdks/tests/load/misarseo.k6.js
//
// Thresholds mirror the API's expectations for DB-only reads. Never point this
// at an endpoint that spends credits or calls a paid provider.
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    reads: {
      executor: "constant-vus",
      vus: 20,
      duration: "60s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE = __ENV.MISARSEO_BASE_URL || "https://api.misar.io/seo";
const API_KEY = __ENV.MISARSEO_API_KEY || "mseo_test";
const params = {
  headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" },
};

export default function () {
  const projects = http.get(`${BASE}/projects`, params);
  check(projects, {
    "projects 200": (r) => r.status === 200,
    "projects array": (r) => Array.isArray(JSON.parse(r.body).projects),
  });

  const usage = http.get(`${BASE}/usage`, params);
  check(usage, { "usage 200": (r) => r.status === 200 });
  sleep(0.5);
}
