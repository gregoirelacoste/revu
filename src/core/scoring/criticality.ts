import type { FileType } from '../types.js';

const TYPE_WEIGHTS: Record<FileType, number> = {
  module: 1.0,
  service: 0.8,
  controller: 0.7,
  guard: 0.6,
  interceptor: 0.6,
  pipe: 0.5,
  component: 0.5,
  dto: 0.3,
  model: 0.3,
  html: 0.15,
  scss: 0.1,
  css: 0.1,
  spec: 0.1,
  unknown: 0.4,
};

const SECURITY_KEYWORDS = /\b(crypto|auth|guard|security|signature|certificate)\b/i;
const BILLING_KEYWORDS = /\b(billing|payment|subscription)\b/i;
const TRUST_KEYWORDS = /\b(trust|score|verification)\b/i;

export function computeFileCriticality(
  fileType: FileType,
  additions: number,
  deletions: number,
  dependencyCount: number,
  filePath: string,
): number {
  const typeWeight = TYPE_WEIGHTS[fileType] ?? 0.4;
  const changeWeight = Math.min(1.0, (additions + deletions) / 200);
  const depWeight = Math.min(1.0, dependencyCount / 10);
  const securityWeight = computeSecurityWeight(filePath);

  const raw = (typeWeight * 0.3 + changeWeight * 0.3 + depWeight * 0.2 + securityWeight * 0.2) * 10;
  return Math.round(raw * 10) / 10;
}

export function computeMethodCriticality(
  fileCriticality: number,
  usageCount: number,
  maxUsageCount: number,
  signatureChanged: boolean,
  filePath: string,
): number {
  const normalizedUsages = maxUsageCount > 0 ? usageCount / maxUsageCount : 0;
  const sigWeight = signatureChanged ? 1.0 : 0;
  const secWeight = computeSecurityWeight(filePath) > 0 ? 1.0 : 0;

  const raw = (
    (fileCriticality / 10) * 0.4 +
    normalizedUsages * 0.3 +
    sigWeight * 0.2 +
    secWeight * 0.1
  ) * 10;
  return Math.round(raw * 10) / 10;
}

function computeSecurityWeight(filePath: string): number {
  if (SECURITY_KEYWORDS.test(filePath)) return 0.5;
  if (TRUST_KEYWORDS.test(filePath)) return 0.4;
  if (BILLING_KEYWORDS.test(filePath)) return 0.3;
  return 0;
}
