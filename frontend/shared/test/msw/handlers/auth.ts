import { http, HttpResponse } from 'msw';
import { buildUser } from '../../fixtures/user';

const BASE = process.env.NEXT_PUBLIC_API_URL + '/api';

export const authHandlers = [
  http.get(`${BASE}/auth/me`, () => {
    return HttpResponse.json(buildUser());
  }),
  http.post(`${BASE}/auth/login`, () => {
    return HttpResponse.json({ token: 'test-token', user: buildUser() });
  }),
  http.post(`${BASE}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
