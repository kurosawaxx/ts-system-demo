import { setupServer } from 'msw/node';
import { authHandlers } from './handlers/auth';
import { projectHandlers } from './handlers/projects';
import { userHandlers } from './handlers/users';
import { workHourHandlers } from './handlers/work-hours';

export const server = setupServer(
  ...authHandlers,
  ...projectHandlers,
  ...userHandlers,
  ...workHourHandlers,
);
