import { describe, it, expect } from 'vitest';
import { exportMarkdown } from './markdown-exporter.js';
import {
  mockScanResult, mockRepoEntry, mockFileEntry, mockMethodData,
  mockTuiFileDiff, mockDiffRow,
} from '../__tests__/fixtures.js';
import type { LineReview } from '../tui/hooks/useReview.js';

describe('exportMarkdown', () => {
  it('renders header with correct stats', () => {
    const result = mockScanResult();
    const diffs = new Map([['f-my-repo-src-app_service_ts', mockTuiFileDiff([
      { type: 'hunkHeader', method: 'doSomething', methodCrit: 5, label: 'Modified' },
      mockDiffRow({ reviewLine: { n: 1, c: 'return true;', t: 'add' } }),
      mockDiffRow({ reviewLine: { n: 2, c: 'return false;', t: 'add' } }),
    ])]]);

    const reviews = new Map<string, LineReview>([
      ['f-my-repo-src-app_service_ts:1', { flag: 'ok', comments: [] }],
    ]);

    const exported = exportMarkdown(result, diffs, reviews);
    const md = exported.get('my-repo')!.markdown;

    expect(md).toContain('# Code Review \u2014 my-repo');
    expect(md).toContain('**Progression** : 1/2 lignes (50%)');
    expect(md).toContain('**Bugs** : 0');
  });

  it('renders bug flag and comment on method', () => {
    const method = mockMethodData({
      name: 'getQuotas',
      status: 'mod',
      crit: 6.2,
      sigChanged: true,
      diff: [
        { t: 'd', c: 'async getQuotas(id: string): Promise<QuotaDto[]> {' },
        { t: 'a', c: 'async getQuotas(id: string): Promise<QuotaStatsDto> {' },
      ],
    });
    const file = mockFileEntry({
      id: 'f-repo-ctrl',
      name: 'consumption.controller',
      ext: '.ts',
      type: 'controller',
      crit: 5.5,
      methods: [method],
    });
    const repo = mockRepoEntry({ files: [file] });
    const result = mockScanResult({ repos: [repo] });

    const diffs = new Map([['f-repo-ctrl', mockTuiFileDiff([
      { type: 'hunkHeader', method: 'getQuotas', methodCrit: 6.2, label: 'Signature changed' },
      mockDiffRow({ reviewLine: { n: 1, c: 'async getQuotas(id: string): Promise<QuotaStatsDto> {', t: 'add' } }),
    ])]]);

    const reviews = new Map<string, LineReview>([
      ['f-repo-ctrl:1', { flag: 'bug', comments: [{ text: 'Swagger pas mis \u00e0 jour.', time: '2026-02-28T10:00:00Z' }] }],
    ]);

    const exported = exportMarkdown(result, diffs, reviews);
    const md = exported.get('my-repo')!.markdown;

    expect(md).toContain('#### getQuotas');
    expect(md).toContain('BUG');
    expect(md).toContain('```diff');
    expect(md).toContain('> **Bug** : Swagger pas mis \u00e0 jour.');
  });

  it('renders side-effect file with lightning emoji', () => {
    const impactedMethod = mockMethodData({ name: 'syncQuotas', impacted: true, status: 'unch' });
    const file = mockFileEntry({
      id: 'f-repo-billing',
      name: 'billing.service',
      ext: '.ts',
      type: 'service',
      crit: 4.5,
      methods: [impactedMethod],
    });
    const repo = mockRepoEntry({ files: [file] });
    const result = mockScanResult({ repos: [repo] });

    const exported = exportMarkdown(result, new Map(), new Map());
    const md = exported.get('my-repo')!.markdown;

    expect(md).toContain('\u26A1');
    expect(md).toContain('billing.service.ts');
    expect(md).toContain('side-effect');
  });

  it('marks fully-reviewed file as complet', () => {
    const result = mockScanResult();
    const diffs = new Map([['f-my-repo-src-app_service_ts', mockTuiFileDiff([
      { type: 'hunkHeader', method: 'doSomething', methodCrit: 5, label: 'Modified' },
      mockDiffRow({ reviewLine: { n: 1, c: 'x', t: 'add' } }),
    ])]]);
    const reviews = new Map<string, LineReview>([
      ['f-my-repo-src-app_service_ts:1', { flag: 'ok', comments: [] }],
    ]);

    const exported = exportMarkdown(result, diffs, reviews);
    const md = exported.get('my-repo')!.markdown;

    expect(md).toContain('complet');
  });

  it('marks file with no reviews as non review\u00e9', () => {
    const result = mockScanResult();
    const diffs = new Map([['f-my-repo-src-app_service_ts', mockTuiFileDiff([
      { type: 'hunkHeader', method: 'doSomething', methodCrit: 5, label: 'Modified' },
      mockDiffRow({ reviewLine: { n: 1, c: 'x', t: 'add' } }),
    ])]]);

    const exported = exportMarkdown(result, diffs, new Map());
    const md = exported.get('my-repo')!.markdown;

    expect(md).toContain('non review\u00e9');
  });
});
