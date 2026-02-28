import { describe, it, expect } from 'vitest';
import { computeFileCriticality, computeMethodCriticality } from './criticality.js';
import { defaultScoringConfig } from '../../__tests__/fixtures.js';

const cfg = defaultScoringConfig();

describe('computeFileCriticality', () => {
  it('scores a controller with moderate changes', () => {
    const score = computeFileCriticality(cfg, 'controller', 50, 30, 0, 'src/case.controller.ts');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(10);
  });

  it('caps changeWeight at high volume', () => {
    const low = computeFileCriticality(cfg, 'service', 10, 5, 0, 'src/app.service.ts');
    const high = computeFileCriticality(cfg, 'service', 500, 500, 0, 'src/app.service.ts');
    expect(high).toBeGreaterThan(low);
    // changeWeight should cap at 1.0 → (200+)/200 = 1.0
    const capped = computeFileCriticality(cfg, 'service', 200, 200, 0, 'src/app.service.ts');
    expect(capped).toBe(high);
  });

  it('adds security bonus for high keyword match', () => {
    const noSec = computeFileCriticality(cfg, 'service', 10, 5, 0, 'src/app.service.ts');
    const withSec = computeFileCriticality(cfg, 'service', 10, 5, 0, 'src/auth.service.ts');
    expect(withSec).toBeGreaterThan(noSec);
  });

  it('falls back to 0.4 for unknown type', () => {
    const unknown = computeFileCriticality(cfg, 'someNewType', 10, 5, 0, 'src/foo.ts');
    const service = computeFileCriticality(cfg, 'service', 10, 5, 0, 'src/foo.ts');
    // unknown (0.4) < service (0.8)
    expect(unknown).toBeLessThan(service);
  });
});

describe('computeMethodCriticality', () => {
  it('scores higher when signature changed', () => {
    const noSig = computeMethodCriticality(cfg, 5.0, 1, 10, false, 'src/app.service.ts');
    const withSig = computeMethodCriticality(cfg, 5.0, 1, 10, true, 'src/app.service.ts');
    expect(withSig).toBeGreaterThan(noSig);
  });

  it('normalizes usages correctly', () => {
    const lowUsage = computeMethodCriticality(cfg, 5.0, 1, 10, false, 'src/app.ts');
    const highUsage = computeMethodCriticality(cfg, 5.0, 10, 10, false, 'src/app.ts');
    expect(highUsage).toBeGreaterThan(lowUsage);
  });

  it('rounds to 1 decimal place', () => {
    const score = computeMethodCriticality(cfg, 7.3, 3, 5, true, 'src/app.ts');
    const decimals = score.toString().split('.')[1] ?? '';
    expect(decimals.length).toBeLessThanOrEqual(1);
  });
});
