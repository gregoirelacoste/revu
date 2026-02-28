import { describe, it, expect } from 'vitest';
import { detectSideEffects } from './analyzer/side-effects.js';
import type { RepoEntry } from './engine.js';
import type { DetectedLink } from './types.js';
import { mockRepoEntry, mockFileEntry, mockMethodData } from '../__tests__/fixtures.js';

describe('detectSideEffects', () => {
  it('marks methods impacted when link target has sigChanged specifier', () => {
    const repos: RepoEntry[] = [mockRepoEntry({
      files: [
        mockFileEntry({
          path: 'src/auth.service.ts',
          methods: [mockMethodData({ name: 'validate', sigChanged: true })],
        }),
        mockFileEntry({
          path: 'src/case.controller.ts',
          methods: [mockMethodData({ name: 'create', sigChanged: false, impacted: undefined })],
        }),
      ],
    })];
    const links: DetectedLink[] = [{
      fromFile: 'src/case.controller.ts',
      toFile: 'src/auth.service.ts',
      type: 'import',
      label: 'validate',
      riskCrit: 5,
      cross: false,
      specifiers: ['validate'],
    }];

    detectSideEffects(repos, links);

    const controller = repos[0].files[1];
    expect(controller.methods[0].impacted).toBe(true);
  });

  it('marks methods impacted via injection (no specifier match needed)', () => {
    const repos: RepoEntry[] = [mockRepoEntry({
      files: [
        mockFileEntry({
          path: 'src/auth.service.ts',
          methods: [mockMethodData({ name: 'validate', sigChanged: true })],
        }),
        mockFileEntry({
          path: 'src/case.controller.ts',
          methods: [mockMethodData({ name: 'create', impacted: undefined })],
        }),
      ],
    })];
    const links: DetectedLink[] = [{
      fromFile: 'src/case.controller.ts',
      toFile: 'src/auth.service.ts',
      type: 'inject',
      label: 'AuthService',
      riskCrit: 5,
      cross: false,
    }];

    detectSideEffects(repos, links);
    expect(repos[0].files[1].methods[0].impacted).toBe(true);
  });

  it('does not mark files when specifiers do not match sigChanged methods', () => {
    const repos: RepoEntry[] = [mockRepoEntry({
      files: [
        mockFileEntry({
          path: 'src/auth.service.ts',
          methods: [mockMethodData({ name: 'validate', sigChanged: true })],
        }),
        mockFileEntry({
          path: 'src/case.controller.ts',
          methods: [mockMethodData({ name: 'create', impacted: undefined })],
        }),
      ],
    })];
    const links: DetectedLink[] = [{
      fromFile: 'src/case.controller.ts',
      toFile: 'src/auth.service.ts',
      type: 'import',
      label: 'otherFn',
      riskCrit: 5,
      cross: false,
      specifiers: ['otherFn'],
    }];

    detectSideEffects(repos, links);
    expect(repos[0].files[1].methods[0].impacted).toBeUndefined();
  });

  it('does not mark files when no methods have sigChanged', () => {
    const repos: RepoEntry[] = [mockRepoEntry({
      files: [
        mockFileEntry({
          path: 'src/auth.service.ts',
          methods: [mockMethodData({ name: 'validate', sigChanged: false })],
        }),
        mockFileEntry({
          path: 'src/case.controller.ts',
          methods: [mockMethodData({ name: 'create', impacted: undefined })],
        }),
      ],
    })];
    const links: DetectedLink[] = [{
      fromFile: 'src/case.controller.ts',
      toFile: 'src/auth.service.ts',
      type: 'import',
      label: 'validate',
      riskCrit: 5,
      cross: false,
      specifiers: ['validate'],
    }];

    detectSideEffects(repos, links);
    expect(repos[0].files[1].methods[0].impacted).toBeUndefined();
  });

  it('also detects side-effects from constants with sigChanged', () => {
    const repos: RepoEntry[] = [mockRepoEntry({
      files: [
        mockFileEntry({
          path: 'src/config.ts',
          methods: [],
          constants: [mockMethodData({ name: 'API_URL', sigChanged: true })],
        }),
        mockFileEntry({
          path: 'src/app.service.ts',
          methods: [mockMethodData({ name: 'init', impacted: undefined })],
        }),
      ],
    })];
    const links: DetectedLink[] = [{
      fromFile: 'src/app.service.ts',
      toFile: 'src/config.ts',
      type: 'import',
      label: 'API_URL',
      riskCrit: 3,
      cross: false,
      specifiers: ['API_URL'],
    }];

    detectSideEffects(repos, links);
    expect(repos[0].files[1].methods[0].impacted).toBe(true);
  });
});
