import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw/server';
import axios from 'axios';

// happy-dom が XMLHttpRequest を提供するため axios が XHR アダプターを選択してしまう。
// MSW は Node.js http モジュールをインターセプトするので http アダプターに固定する。
axios.defaults.adapter = 'http';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
});
afterAll(() => server.close());

Object.defineProperty(window, 'location', {
  writable: true,
  value: { href: '', assign: vi.fn(), replace: vi.fn() },
});
