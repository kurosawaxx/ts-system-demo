import { http, HttpResponse } from 'msw';
import { buildProject } from '../../fixtures/project';

const BASE = process.env.NEXT_PUBLIC_API_URL + '/api';

export const projectHandlers = [
  http.get(`${BASE}/admin/projects`, () => {
    return HttpResponse.json([
      buildProject(),
      buildProject({ id: 2, project_name: '別プロジェクト' }),
    ]);
  }),
  http.get(`${BASE}/projects`, () => {
    return HttpResponse.json([buildProject()]);
  }),
  http.put(`${BASE}/admin/projects/:id`, () => {
    return HttpResponse.json(buildProject());
  }),
  http.delete(`${BASE}/admin/projects/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
