/**
 * PAYJARVIS ENTERPRISE — Domain Scores
 *
 * Trust Score granular por domínio de pagamento.
 * Um bot pode ter score 95 em "food" e 30 em "travel",
 * permitindo limites de autonomia diferentes por categoria.
 *
 * Fechado — Enterprise only
 */

import type { TransactionSignal } from '../anomaly/detector'

export const PAYMENT_DOMAINS = [
  'food', 'travel', 'transport', 'accommodation', 'streaming',
  'software', 'shopping', 'health', 'education', 'electronics',
  'subscription', 'transfer', 'other',
] as const

export type PaymentDomain = typeof PAYMENT_DOMAINS[number]
export type DomainTier = 'unknown' | 'novice' | 'regular' | 'trusted' | 'expert'

export interface DomainScore {
  domain: PaymentDomain
  score: number
  tier: DomainTier
  totalTransactions: number
  approvedCount: number
  blockedCount: number
  avgAmount: number
  autonomyLimit: number
  lastActivityAt: Date | null
  computedAt: Date
}

export interface BotDomainProfile {
  botId: string
  domains: Partial<Record<PaymentDomain, DomainScore>>
  strongestDomain: PaymentDomain | null
  weakestDomain: PaymentDomain | null
  updatedAt: Date
}

// Limites de autonomia por tier (USD)
const TIER_LIMITS: Record<DomainTier, number> = {
  unknown: 0, novice: 15, regular: 50, trusted: 120, expert: 250,
}

function scoreToTier(score: number, txCount: number): DomainTier {
  if (txCount < 3) return 'unknown'
  if (score >= 85 && txCount >= 20) return 'expert'
  if (score >= 70 && txCount >= 10) return 'trusted'
  if (score >= 50 && txCount >= 5)  return 'regular'
  return 'novice'
}

// ─────────────────────────────────────────
// CALCULADORA PRINCIPAL
// ─────────────────────────────────────────

export class DomainScoreCalculator {

  /**
   * Calcula o score de cada domínio com base no histórico de transações.
   * Considera: taxa de aprovação, valor médio, consistência e recência.
   */
  compute(botId: string, history: TransactionSignal[]): BotDomainProfile {
    const byDomain: Partial<Record<PaymentDomain, TransactionSignal[]>> = {}

    // Agrupar transações por categoria/domínio
    for (const tx of history) {
      const domain = this.categoryToDomain(tx.category)
      if (!byDomain[domain]) byDomain[domain] = []
      byDomain[domain]!.push(tx)
    }

    const domains: Partial<Record<PaymentDomain, DomainScore>> = {}

    for (const [domain, txList] of Object.entries(byDomain) as [PaymentDomain, TransactionSignal[]][]) {
      const total = txList.length
      const approved = txList.filter(t => t.decision === 'approved').length
      const blocked = txList.filter(t => t.decision === 'blocked').length
      const avgAmount = txList.reduce((s, t) => s + t.amount, 0) / total

      // Score base: taxa de aprovação (0-70 pts)
      const approvalRate = approved / total
      let score = Math.round(approvalRate * 70)

      // Bônus por volume (até +20 pts)
      if (total >= 50) score += 20
      else if (total >= 20) score += 15
      else if (total >= 10) score += 10
      else if (total >= 5)  score += 5

      // Bônus por consistência de valor (até +10 pts)
      const amounts = txList.map(t => t.amount)
      const stdDev = this.stdDev(amounts)
      const cv = stdDev / (avgAmount || 1) // coeficiente de variação
      if (cv < 0.3) score += 10
      else if (cv < 0.6) score += 5

      score = Math.min(100, Math.max(0, score))
      const tier = scoreToTier(score, total)
      const lastActivity = txList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp ?? null

      domains[domain] = {
        domain,
        score,
        tier,
        totalTransactions: total,
        approvedCount: approved,
        blockedCount: blocked,
        avgAmount,
        autonomyLimit: TIER_LIMITS[tier],
        lastActivityAt: lastActivity,
        computedAt: new Date(),
      }
    }

    // Melhor e pior domínio
    const domainList = Object.values(domains) as DomainScore[]
    const sorted = domainList.sort((a, b) => b.score - a.score)
    const strongestDomain = sorted[0]?.domain ?? null
    const weakestDomain = sorted[sorted.length - 1]?.domain ?? null

    return { botId, domains, strongestDomain, weakestDomain, updatedAt: new Date() }
  }

  /**
   * Retorna o limite de autonomia para uma categoria específica.
   * Usado pelo Rules Engine para substituir o limite global.
   */
  getAutonomyLimit(profile: BotDomainProfile, category: string): number {
    const domain = this.categoryToDomain(category)
    return profile.domains[domain]?.autonomyLimit ?? 0
  }

  private categoryToDomain(category: string): PaymentDomain {
    const map: Record<string, PaymentDomain> = {
      food: 'food', restaurant: 'food', delivery: 'food',
      travel: 'travel', flight: 'travel', airline: 'travel',
      transport: 'transport', uber: 'transport', taxi: 'transport',
      accommodation: 'accommodation', hotel: 'accommodation', airbnb: 'accommodation',
      streaming: 'streaming', netflix: 'streaming', spotify: 'streaming',
      software: 'software', saas: 'software', subscription: 'subscription',
      shopping: 'shopping', ecommerce: 'shopping',
      health: 'health', pharmacy: 'health',
      education: 'education', course: 'education',
      electronics: 'electronics', tech: 'electronics',
      transfer: 'transfer',
    }
    return map[category.toLowerCase()] ?? 'other'
  }

  private stdDev(values: number[]): number {
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
    return Math.sqrt(variance)
  }
}
