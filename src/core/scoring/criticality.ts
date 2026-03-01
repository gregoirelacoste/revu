import type { ScoringConfig, MethodData, DetectedLink, FileScoringBreakdown } from '../types.js';
import type { GraphSignals } from './graph-signals.js';
import { computeGraphAmplifier } from './graph-signals.js';
import {
  computeChangeCrit, computeChangeCritDetailed, computeContentRisk,
  computeCompoundSigDep, computeChangePropagation, computeCascadeDepth,
  computeDtoContractChange, computeExistingEndpointMod,
  computeFormattingDiscount, computeTestDiscount,
} from './content-signals.js';

// ── File signals (everything needed to score a file) ──

export interface FileSignals {
  additions: number;
  deletions: number;
  dependencyCount: number;
  filePath: string;
  fileType: string;
  methods: MethodData[];
  constants: MethodData[];
  tested: boolean;
  allFiles: Array<{ path: string; type: string; methods: MethodData[] }>;
  links: DetectedLink[];
  graph?: GraphSignals;
}

// ── V1 scorer (backward compat, used before link-detection pass) ──

export function computeFileCriticality(
  config: ScoringConfig,
  fileType: string,
  additions: number,
  deletions: number,
  dependencyCount: number,
  filePath: string,
): number {
  const { weights } = config;
  const typeWeight = config.fileTypes[fileType] ?? 0.4;
  const changeWeight = Math.min(1.0, (additions + deletions) / 200);
  const depWeight = Math.min(1.0, dependencyCount / 10);
  const securityWeight = computeSecurityWeight(config, filePath);

  const raw = (
    typeWeight * weights.fileType +
    changeWeight * weights.changeVolume +
    depWeight * weights.dependencies +
    securityWeight * weights.securityContext
  ) * 10;

  return Math.round(raw * 10) / 10;
}

// ── V3 scorer: changeCrit × graphAmplifier × (1 + compoundBonus) × attenuations ──

export function computeFileBreakdown(config: ScoringConfig, s: FileSignals): FileScoringBreakdown {
  const allMeth = [...s.methods, ...s.constants];

  const detail = computeChangeCritDetailed(allMeth, config);
  const graphAmplifier = computeGraphAmplifier(
    s.graph, config, s.fileType, s.filePath, computeSecurityWeight,
  );

  const sigDep = computeCompoundSigDep(s.methods, s.dependencyCount);
  const propagation = computeChangePropagation(s.filePath, s.allFiles, s.links);
  const cascadeDepth = computeCascadeDepth(s.filePath, s.allFiles, s.links);
  const dtoContract = computeDtoContractChange(s.fileType, s.methods, s.constants);
  const endpointMod = computeExistingEndpointMod(s.fileType, s.methods);
  const compoundBonus = sigDep + propagation + cascadeDepth + dtoContract + endpointMod;

  const fmtDiscount = computeFormattingDiscount(s.methods, s.constants);
  const testDiscount = computeTestDiscount(s.tested);

  const raw = detail.score * graphAmplifier * (1 + compoundBonus) * fmtDiscount * testDiscount;
  const finalScore = Math.round(Math.min(10, Math.max(0, raw)) * 10) / 10;

  return {
    changeCrit: detail.score,
    graphAmplifier,
    compoundBonus,
    compoundDetail: { sigDep, propagation, cascadeDepth, dtoContract, endpointMod },
    fmtDiscount,
    testDiscount,
    finalScore,
    lineCount: detail.lineCount,
    lineCategories: detail.lineCategories,
    topKMean: detail.topKMean,
    fullMean: detail.fullMean,
    graphSignals: s.graph ? { ...s.graph } : undefined,
  };
}

export function computeFileCriticalityV2(config: ScoringConfig, s: FileSignals): number {
  return computeFileBreakdown(config, s).finalScore;
}

// ── Method scorer (v2: 7 factors) ──

export function computeMethodCriticalityV2(
  config: ScoringConfig,
  fileCriticality: number,
  m: MethodData,
  maxUsageCount: number,
  filePath: string,
): number {
  const normalizedUsages = maxUsageCount > 0 ? m.usages / maxUsageCount : 0;
  const sigWeight = m.sigChanged ? 1.0 : 0;
  const secWeight = computeSecurityWeight(config, filePath) > 0 ? 1.0 : 0;
  const statusWeight = m.status === 'del' ? 0.7 : m.status === 'mod' ? 0.5 : 0.2;

  // Per-method content risk
  let contentRisk = 0;
  const changeLines = m.diff.filter(d => d.t !== 'c');
  if (changeLines.length > 0) {
    contentRisk = computeContentRisk([m]);
  }

  const impactedWeight = m.impacted ? 1.0 : 0;

  const raw = (
    (fileCriticality / 10) * 0.25 +
    normalizedUsages * 0.20 +
    sigWeight * 0.15 +
    secWeight * 0.10 +
    statusWeight * 0.10 +
    contentRisk * 0.10 +
    impactedWeight * 0.10
  ) * 10;

  return Math.round(Math.min(10, raw) * 10) / 10;
}

// ── V1 method scorer (kept for rescore compat) ──

export function computeMethodCriticality(
  config: ScoringConfig,
  fileCriticality: number,
  usageCount: number,
  maxUsageCount: number,
  signatureChanged: boolean,
  filePath: string,
): number {
  const normalizedUsages = maxUsageCount > 0 ? usageCount / maxUsageCount : 0;
  const sigWeight = signatureChanged ? 1.0 : 0;
  const secWeight = computeSecurityWeight(config, filePath) > 0 ? 1.0 : 0;

  const raw = (
    (fileCriticality / 10) * 0.4 +
    normalizedUsages * 0.3 +
    sigWeight * 0.2 +
    secWeight * 0.1
  ) * 10;

  return Math.round(raw * 10) / 10;
}

export function computeSecurityWeight(config: ScoringConfig, filePath: string): number {
  const { securityKeywords, securityBonus } = config;
  const lowerPath = filePath.toLowerCase();

  if (securityKeywords.high.some(kw => lowerPath.includes(kw.toLowerCase()))) {
    return securityBonus.high;
  }
  if (securityKeywords.medium.some(kw => lowerPath.includes(kw.toLowerCase()))) {
    return securityBonus.medium;
  }
  if (securityKeywords.low.some(kw => lowerPath.includes(kw.toLowerCase()))) {
    return securityBonus.low;
  }
  return 0;
}
