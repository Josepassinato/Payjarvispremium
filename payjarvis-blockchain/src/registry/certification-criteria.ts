export interface BotMetrics {
  trustScore: number
  ownerVerified: boolean
  approvedTxCount: number
  daysActive: number
  blockedLast7Days: number
  hasPolicyConfigured: boolean
}

export interface CertificationResult {
  eligible: boolean
  reasons: string[]
}

export const CERTIFICATION_THRESHOLDS = {
  minTrustScore: 65,
  minApprovedTx: 10,
  minDaysActive: 3,
  maxBlockedLast7Days: 0,
  requirePolicyConfigured: true,
  requireOwnerVerified: true
}

export function evaluateCertification(metrics: BotMetrics): CertificationResult {
  const reasons: string[] = []

  if (metrics.trustScore < CERTIFICATION_THRESHOLDS.minTrustScore)
    reasons.push(`trustScore ${metrics.trustScore} < ${CERTIFICATION_THRESHOLDS.minTrustScore}`)

  if (!metrics.ownerVerified)
    reasons.push('ownerVerified is false')

  if (metrics.approvedTxCount < CERTIFICATION_THRESHOLDS.minApprovedTx)
    reasons.push(`approvedTxCount ${metrics.approvedTxCount} < ${CERTIFICATION_THRESHOLDS.minApprovedTx}`)

  if (metrics.daysActive < CERTIFICATION_THRESHOLDS.minDaysActive)
    reasons.push(`daysActive ${metrics.daysActive} < ${CERTIFICATION_THRESHOLDS.minDaysActive}`)

  if (metrics.blockedLast7Days > CERTIFICATION_THRESHOLDS.maxBlockedLast7Days)
    reasons.push(`blocked events in last 7 days: ${metrics.blockedLast7Days}`)

  if (!metrics.hasPolicyConfigured)
    reasons.push('no spending policy configured')

  return {
    eligible: reasons.length === 0,
    reasons
  }
}
