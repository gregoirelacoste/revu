import type { ScoringConfig, MethodData, DetectedLink } from '../types.js';
import {
  computeContentRisk, computeMethodRisk, computeStabilityRisk,
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

// ── V2 scorer (3 layers: base + compound bonus + attenuation) ──

export function computeFileCriticalityV2(config: ScoringConfig, s: FileSignals): number {
  const { weights } = config;
  const allMethods = [...s.methods, ...s.constants];

  // Layer 1: 7 base weights (sum = 1.0)
  const typeWeight = config.fileTypes[s.fileType] ?? 0.4;
  const changeWeight = Math.min(1.0, (s.additions + s.deletions) / 200);
  const depWeight = Math.min(1.0, s.dependencyCount / 10);
  const securityWeight = computeSecurityWeight(config, s.filePath);
  const contentRisk = computeContentRisk(allMethods);
  const methodRisk = computeMethodRisk(s.methods);
  const stability = computeStabilityRisk(s.additions, s.deletions);

  const baseScore = (
    typeWeight * weights.fileType +
    changeWeight * weights.changeVolume +
    depWeight * weights.dependencies +
    securityWeight * weights.securityContext +
    contentRisk * weights.contentRisk +
    methodRisk * weights.methodRisk +
    stability * weights.stability
  ) * 10;

  // Layer 2: compound bonuses (0 to +0.85 max)
  const compoundBonus =
    computeCompoundSigDep(s.methods, s.dependencyCount) +
    computeChangePropagation(s.filePath, s.allFiles, s.links) +
    computeCascadeDepth(s.filePath, s.allFiles, s.links) +
    computeDtoContractChange(s.fileType, s.methods, s.constants) +
    computeExistingEndpointMod(s.fileType, s.methods);

  // Layer 3: attenuations
  const fmtDiscount = computeFormattingDiscount(s.methods, s.constants);
  const testDiscount = computeTestDiscount(s.tested);

  const raw = baseScore * (1 + compoundBonus) * fmtDiscount * testDiscount;
  return Math.round(Math.min(10, Math.max(0, raw)) * 10) / 10;
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

function computeSecurityWeight(config: ScoringConfig, filePath: string): number {
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
