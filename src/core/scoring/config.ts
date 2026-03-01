import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import type { RevuConfig, ScoringConfig } from '../types.js';

export function hashConfig(scoring: ScoringConfig): string {
  return createHash('sha256').update(JSON.stringify(scoring)).digest('hex').slice(0, 8);
}

const DEFAULT_SCORING: ScoringConfig = {
  weights: {
    // Graph-based (source of truth, sum = 0.75)
    graphImportance: 0.25,
    callerCritWeight: 0.20,
    entryProximity: 0.20,
    exclusivity: 0.10,
    // Content-based (complementary, sum = 0.25)
    contentRisk: 0.15,
    stability: 0.10,
    // Legacy (secondary bonus in compound layer, not part of base sum)
    fileType: 0.20,
    changeVolume: 0.15,
    dependencies: 0.20,
    securityContext: 0.15,
    methodRisk: 0.10,
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
    security: 2.5,
    signature: 2.0,
    errorHandling: 1.5,
    database: 1.5,
    controlFlow: 1.2,
    injection: 1.2,
    async: 1.1,
    dataTransform: 0.9,
    returnLogic: 1.0,
    assignment: 0.8,
    declaration: 0.6,
    typeDecl: 0.4,
    logging: 0.3,
    import: 0.2,
    comment: 0.1,
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
