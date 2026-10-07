import { http, HttpResponse } from 'msw';
import { buildUser } from '../../fixtures/user';

const BASE = process.env.NEXT_PUBLIC_API_URL + '/api';

export const userHandlers = [
  http.get(`${BASE}/admin/users`, () => {
    return HttpResponse.json([buildUser(), buildUser({ id: 2, name: 'テスト花子' })]);
  }),
  http.get(`${BASE}/admin/users/:id`, ({ params }) => {
    return HttpResponse.json(buildUser({ id: Number(params.id) }));
  }),
  http.post(`${BASE}/admin/users`, () => {
    return HttpResponse.json(buildUser(), { status: 201 });
  }),
  http.put(`${BASE}/admin/users/:id`, () => {
    return HttpResponse.json(buildUser());
  }),
];
