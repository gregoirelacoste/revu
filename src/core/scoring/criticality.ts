import type { ScoringConfig } from '../types.js';

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
