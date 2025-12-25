import * as path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PathService } from '../../../src/services/pathService';
import * as config from '../../../src/utils/config';

vi.mock('../../../src/utils/config', () => ({
  getGitRoot: vi.fn(),
}));

describe('PathService', () => {
  const mockRoot = '/home/user/project';
  
  beforeEach(() => {
    vi.mocked(config.getGitRoot).mockReturnValue(mockRoot);
    // Reset singleton for clean tests
    (PathService as any).instance = undefined;
  });

  describe('toRelative', () => {
    it('should convert absolute path to project-relative', () => {
      const service = PathService.getInstance();
      expect(service.toRelative('/home/user/project/src/file.ts')).toBe('src/file.ts');
    });

    it('should handle Windows backslashes in input', () => {
      // Mocking root to look like Windows for this specific test
      vi.mocked(config.getGitRoot).mockReturnValue('C:\\Users\\Project');
      (PathService as any).instance = undefined;
      const service = PathService.getInstance();
      
      expect(service.toRelative('C:\\Users\\Project\\src\\file.ts')).toBe('src/file.ts');
    });

    it('should clean leading slashes and ./ prefix', () => {
      const service = PathService.getInstance();
      expect(service.toRelative('./src/file.ts')).toBe('src/file.ts');
      expect(service.toRelative('/src/file.ts')).toBe('src/file.ts');
    });

    it('should handle project root itself', () => {
      const service = PathService.getInstance();
      expect(service.toRelative('/home/user/project')).toBe('');
      expect(service.toRelative('/home/user/project/')).toBe('');
    });

    it('should return empty string for undefined or empty input', () => {
      const service = PathService.getInstance();
      expect(service.toRelative(undefined)).toBe('');
      expect(service.toRelative('')).toBe('');
    });

    it('should handle deeply nested paths', () => {
      const service = PathService.getInstance();
      expect(service.toRelative('/home/user/project/src/components/ui/button/styles.css')).toBe('src/components/ui/button/styles.css');
    });

    it('should handle paths with spaces', () => {
      const service = PathService.getInstance();
      expect(service.toRelative('/home/user/project/my folder/my file.ts')).toBe('my folder/my file.ts');
    });
  });

  describe('toAbsolute', () => {
    it('should convert relative path to absolute', () => {
      const service = PathService.getInstance();
      const expected = path.join(mockRoot, 'src/file.ts');
      expect(service.toAbsolute('src/file.ts')).toBe(expected);
    });

    it('should return already absolute paths as-is if they are under root', () => {
      const service = PathService.getInstance();
      const absPath = path.join(mockRoot, 'src/file.ts');
      expect(service.toAbsolute(absPath)).toBe(path.normalize(absPath));
    });

    it('should treat paths starting with / as relative to project root', () => {
      const service = PathService.getInstance();
      expect(service.toAbsolute('/src/file.ts')).toBe(path.join(mockRoot, 'src/file.ts'));
    });
  });

  describe('normalize', () => {
    it('should collapse multiple slashes and use forward slashes', () => {
      const service = PathService.getInstance();
      expect(service.normalize('src\\some//path//file.ts')).toBe('src/some/path/file.ts');
    });

    it('should remove trailing slashes', () => {
      const service = PathService.getInstance();
      expect(service.normalize('src/path/')).toBe('src/path');
    });
    
    it('should return empty string for empty input', () => {
      const service = PathService.getInstance();
      expect(service.normalize('')).toBe('');
    });
  });
});
