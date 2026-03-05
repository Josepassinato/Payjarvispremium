/**
 * PAYJARVIS ENTERPRISE — Anomaly Detection Engine
 * Fechado — Enterprise only
 */

export interface TransactionSignal {
  botId: string
  amount: number
  merchantId: string
  category: string
  decision: 'approved' | 'blocked' | 'pending_human'
  timestamp: Date
  hourUTC: number
}

export interface AnomalyResult {
  botId: string
  score: number
  level: 'none' | 'low' | 'medium' | 'high' | 'critical'
  signals: AnomalySignal[]
  shouldSuspend: boolean
  shouldNotify: boolean
  analyzedAt: Date
}

export interface AnomalySignal {
  type: string
  weight: number
  detail: string
}

export interface BotBaseline {
  botId: string
  avgTransactionsPerHour: number
  avgAmount: number
  avgBlockRate: number
  knownMerchants: string[]
  usualCategories: string[]
  activeHours: number[]
  computedAt: Date
}

const WEIGHTS = {
  velocity_spike: 25, amount_spike: 20, new_merchant_burst: 15,
  off_hours_activity: 10, block_rate_spike: 20, category_drift: 15, round_amount_pattern: 10,
}

export class AnomalyDetector {
  analyze(recent: TransactionSignal[], baseline: BotBaseline): AnomalyResult {
    const signals: AnomalySignal[] = []

    // 1. Velocity
    const lastHour = recent.filter(t => Date.now() - t.timestamp.getTime() < 3_600_000).length
    if (lastHour > baseline.avgTransactionsPerHour * 3)
      signals.push({ type: 'velocity_spike', weight: WEIGHTS.velocity_spike, detail: `${lastHour} tx/hora (média: ${baseline.avgTransactionsPerHour.toFixed(1)})` })

    // 2. Amount spike
    const recentAvg = recent.slice(0, 10).reduce((s, t) => s + t.amount, 0) / 10
    if (recentAvg > baseline.avgAmount * 2.5)
      signals.push({ type: 'amount_spike', weight: WEIGHTS.amount_spike, detail: `Média recente $${recentAvg.toFixed(2)} vs histórico $${baseline.avgAmount.toFixed(2)}` })

    // 3. New merchants
    const newMerchants = recent.slice(0, 20).filter(t => !baseline.knownMerchants.includes(t.merchantId))
    if (newMerchants.length >= 5)
      signals.push({ type: 'new_merchant_burst', weight: WEIGHTS.new_merchant_burst, detail: `${newMerchants.length} merchants desconhecidos nas últimas 20 tx` })

    // 4. Off-hours
    const offHours = recent.slice(0, 20).filter(t => !baseline.activeHours.includes(t.hourUTC)).length
    if (offHours >= 5)
      signals.push({ type: 'off_hours_activity', weight: WEIGHTS.off_hours_activity, detail: `${offHours} tx fora do horário habitual` })

    // 5. Block rate
    const sample = Math.min(20, recent.length)
    const blocked = recent.slice(0, sample).filter(t => t.decision === 'blocked').length
    const blockRate = blocked / sample
    if (blockRate > baseline.avgBlockRate * 3 && blocked >= 3)
      signals.push({ type: 'block_rate_spike', weight: WEIGHTS.block_rate_spike, detail: `Taxa de bloqueio ${(blockRate * 100).toFixed(0)}% (histórico: ${(baseline.avgBlockRate * 100).toFixed(0)}%)` })

    // 6. Category drift
    const newCats = [...new Set(recent.slice(0, 20).map(t => t.category))].filter(c => !baseline.usualCategories.includes(c))
    if (newCats.length >= 3)
      signals.push({ type: 'category_drift', weight: WEIGHTS.category_drift, detail: `Categorias incomuns: ${newCats.join(', ')}` })

    // 7. Round amounts
    const rounds = recent.slice(0, 20).filter(t => t.amount % 50 === 0 || t.amount % 100 === 0).length
    if (rounds >= 8)
      signals.push({ type: 'round_amount_pattern', weight: WEIGHTS.round_amount_pattern, detail: `${rounds}/20 transações com valores redondos` })

    const score = Math.min(100, signals.reduce((s, x) => s + x.weight, 0))
    const level = score >= 85 ? 'critical' : score >= 65 ? 'high' : score >= 40 ? 'medium' : score >= 20 ? 'low' : 'none'

    return { botId: recent[0]?.botId ?? '', score, level, signals, shouldSuspend: level === 'critical', shouldNotify: level === 'high' || level === 'critical', analyzedAt: new Date() }
  }
}

export function computeBaseline(history: TransactionSignal[]): BotBaseline {
  const total = history.length || 1
  const categoryCount: Record<string, number> = {}
  const hourCount: Record<number, number> = {}
  history.forEach(t => {
    categoryCount[t.category] = (categoryCount[t.category] ?? 0) + 1
    hourCount[t.hourUTC] = (hourCount[t.hourUTC] ?? 0) + 1
  })
  return {
    botId: history[0]?.botId ?? '',
    avgTransactionsPerHour: total / (30 * 24),
    avgAmount: history.reduce((s, t) => s + t.amount, 0) / total,
    avgBlockRate: history.filter(t => t.decision === 'blocked').length / total,
    knownMerchants: [...new Set(history.map(t => t.merchantId))],
    usualCategories: Object.entries(categoryCount).filter(([, c]) => c >= 3).map(([k]) => k),
    activeHours: Object.entries(hourCount).filter(([, c]) => c / total >= 0.02).map(([h]) => parseInt(h)),
    computedAt: new Date(),
  }
}
