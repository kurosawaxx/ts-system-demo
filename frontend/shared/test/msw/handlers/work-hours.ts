import { http, HttpResponse } from 'msw';
import { buildWorkHour } from '../../fixtures/work-hour';

const BASE = process.env.NEXT_PUBLIC_API_URL + '/api';

export const workHourHandlers = [
  http.get(`${BASE}/projects/:projectId/work-hours`, () => {
    return HttpResponse.json([buildWorkHour(), buildWorkHour({ id: 2, hours: 4 })]);
  }),
  http.post(`${BASE}/projects/:projectId/work-hours`, () => {
    return HttpResponse.json(buildWorkHour(), { status: 201 });
  }),
  http.put(`${BASE}/projects/:projectId/work-hours/:id`, () => {
    return HttpResponse.json(buildWorkHour());
  }),
  http.delete(`${BASE}/projects/:projectId/work-hours/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
