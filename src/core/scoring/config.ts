import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { RevuConfig, ScoringConfig } from '../types.js';

const DEFAULT_SCORING: ScoringConfig = {
  weights: {
    fileType: 0.25,
    changeVolume: 0.25,
    dependencies: 0.25,
    securityContext: 0.25,
  },
  fileTypes: {
    module: 1.0,
    guard: 0.9,
    interceptor: 0.8,
    service: 0.8,
    controller: 0.7,
    component: 0.5,
    pipe: 0.4,
    dto: 0.3,
    model: 0.3,
    html: 0.1,
    scss: 0.05,
    css: 0.05,
    spec: 0.1,
    unknown: 0.4,
  },
  securityKeywords: {
    high: ['crypto', 'auth', 'guard', 'security', 'signature', 'certificate', 'secret', 'private.key'],
    medium: ['billing', 'payment', 'subscription', 'trust', 'score', 'verify'],
    low: ['config', 'env', 'migration'],
  },
  securityBonus: { high: 0.5, medium: 0.3, low: 0.1 },
  lineCriticality: {
    signatureChange: 2.0,
    returnTypeChange: 1.8,
    parameterChange: 1.5,
    guardDecorator: 1.3,
    newDependencyInjection: 1.2,
    errorHandling: 1.0,
    regularCode: 0.5,
    comment: 0.1,
    import: 0.1,
    whitespace: 0.0,
  },
};

const DEFAULT_CONFIG: RevuConfig = {
  version: 1,
  stack: 'generic',
  scoring: DEFAULT_SCORING,
  rules: {
    alwaysShow: [],
    sideEffectDetection: true,
    minCritForDisplay: 0,
  },
};

export async function loadConfig(rootDir: string): Promise<RevuConfig> {
  const configPath = join(rootDir, '.revu', 'config.json');
  try {
    const raw = await readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(raw) as Partial<RevuConfig>;
    return mergeConfig(DEFAULT_CONFIG, userConfig);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function initConfig(rootDir: string): Promise<string> {
  const configPath = join(rootDir, '.revu', 'config.json');
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  return configPath;
}

function mergeConfig(base: RevuConfig, user: Partial<RevuConfig>): RevuConfig {
  return {
    version: user.version ?? base.version,
    stack: user.stack ?? base.stack,
    scoring: {
      weights: { ...base.scoring.weights, ...user.scoring?.weights },
      fileTypes: { ...base.scoring.fileTypes, ...user.scoring?.fileTypes },
      securityKeywords: {
        high: user.scoring?.securityKeywords?.high ?? base.scoring.securityKeywords.high,
        medium: user.scoring?.securityKeywords?.medium ?? base.scoring.securityKeywords.medium,
        low: user.scoring?.securityKeywords?.low ?? base.scoring.securityKeywords.low,
      },
      securityBonus: { ...base.scoring.securityBonus, ...user.scoring?.securityBonus },
      lineCriticality: { ...base.scoring.lineCriticality, ...user.scoring?.lineCriticality },
    },
    rules: {
      alwaysShow: user.rules?.alwaysShow ?? base.rules.alwaysShow,
      sideEffectDetection: user.rules?.sideEffectDetection ?? base.rules.sideEffectDetection,
      minCritForDisplay: user.rules?.minCritForDisplay ?? base.rules.minCritForDisplay,
    },
  };
}
