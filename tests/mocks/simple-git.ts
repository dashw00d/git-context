import { vi } from 'vitest';

const simpleGit = vi.fn(() => ({
  revparse: vi.fn(),
  log: vi.fn(),
  diff: vi.fn(),
  show: vi.fn(),
  status: vi.fn(),
  raw: vi.fn(),
}));

export default simpleGit;
