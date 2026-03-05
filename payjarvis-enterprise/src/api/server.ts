/**
 * PAYJARVIS ENTERPRISE — API Server
 *
 * Endpoints exclusivos para clientes Enterprise.
 * Autenticação: Enterprise API Key no header X-Enterprise-Key
 */

import Fastify from 'fastify'
import { AnomalyDetector, computeBaseline } from '../anomaly/detector'
import { DomainScoreCalculator } from '../domain-scores/calculator'
import { ReportGenerator } from '../reports/generator'

const app = Fastify({ logger: true })

// ─────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────

app.addHook('onRequest', async (request, reply) => {
  const key = request.headers['x-enterprise-key']
  if (!key || key !== process.env.ENTERPRISE_API_KEY) {
    return reply.status(401).send({ error: 'Unauthorized — Enterprise key required' })
  }
})

// ─────────────────────────────────────────
// ANOMALY DETECTION
// ─────────────────────────────────────────

const detector = new AnomalyDetector()

/**
 * POST /v1/enterprise/anomaly/analyze
 * Analisa transações recentes de um bot e retorna score de anomalia.
 */
app.post('/v1/enterprise/anomaly/analyze', async (request, reply) => {
  const { recent, history } = request.body as any

  if (!recent?.length) {
    return reply.status(400).send({ error: 'recent transactions required' })
  }

  // Parsear timestamps
  const recentParsed = recent.map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) }))
  const historyParsed = (history ?? []).map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) }))

  const baseline = historyParsed.length > 0
    ? computeBaseline(historyParsed)
    : computeBaseline(recentParsed) // fallback: usa recente como baseline

  const result = detector.analyze(recentParsed, baseline)
  return reply.send({ success: true, data: result })
})

/**
 * GET /v1/enterprise/anomaly/baseline/:botId
 * Retorna o baseline calculado para um bot a partir do histórico.
 */
app.get('/v1/enterprise/anomaly/baseline/:botId', async (request, reply) => {
  const { botId } = request.params as any

  // Buscar histórico do bot via PayJarvis core
  const history = await fetchBotHistory(botId, 30)
  if (!history.length) {
    return reply.status(404).send({ error: 'No history found for bot' })
  }

  const baseline = computeBaseline(history)
  return reply.send({ success: true, data: baseline })
})

// ─────────────────────────────────────────
// DOMAIN SCORES
// ─────────────────────────────────────────

const domainCalculator = new DomainScoreCalculator()

/**
 * GET /v1/enterprise/domain-scores/:botId
 * Retorna o perfil de domain scores de um bot.
 */
app.get('/v1/enterprise/domain-scores/:botId', async (request, reply) => {
  const { botId } = request.params as any
  const { days = '90' } = request.query as any

  const history = await fetchBotHistory(botId, parseInt(days))
  if (!history.length) {
    return reply.status(404).send({ error: 'No history found for bot' })
  }

  const profile = domainCalculator.compute(botId, history)
  return reply.send({ success: true, data: profile })
})

/**
 * GET /v1/enterprise/domain-scores/:botId/:category
 * Retorna o limite de autonomia para uma categoria específica.
 */
app.get('/v1/enterprise/domain-scores/:botId/:category', async (request, reply) => {
  const { botId, category } = request.params as any

  const history = await fetchBotHistory(botId, 90)
  const profile = domainCalculator.compute(botId, history)
  const autonomyLimit = domainCalculator.getAutonomyLimit(profile, category)

  return reply.send({
    success: true,
    data: {
      botId,
      category,
      autonomyLimit,
      domainProfile: profile.domains,
    },
  })
})

// ─────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────

const reportGen = new ReportGenerator()

/**
 * POST /v1/enterprise/reports/generate
 * Gera um relatório PDF de auditoria para um bot.
 */
app.post('/v1/enterprise/reports/generate', async (request, reply) => {
  const { botId, periodStart, periodEnd } = request.body as any

  if (!botId || !periodStart || !periodEnd) {
    return reply.status(400).send({ error: 'botId, periodStart, periodEnd required' })
  }

  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  // Buscar dados do bot via PayJarvis core
  const [botData, stats, history] = await Promise.all([
    fetchBotData(botId),
    fetchBotStats(botId, start, end),
    fetchBotHistory(botId, 90),
  ])

  if (!botData) {
    return reply.status(404).send({ error: 'Bot not found' })
  }

  const recentTxs = history.slice(0, 50)
  const baseline = computeBaseline(history)
  const anomalies = recentTxs.length > 0 ? [detector.analyze(recentTxs, baseline)] : []
  const domainProfile = history.length > 0 ? domainCalculator.compute(botId, history) : null

  const reportInput = {
    bot: botData,
    owner: botData.owner,
    period: { start, end },
    stats,
    anomalies,
    domainProfile,
    trustScoreHistory: botData.trustScoreHistory ?? [],
  }

  const output = await reportGen.generate(reportInput)

  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${output.filename}"`)
    .send(output.buffer)
})

// ─────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────

app.get('/health', async () => ({
  status: 'ok',
  service: 'payjarvis-enterprise',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}))

// ─────────────────────────────────────────
// HELPERS — chamam a API do PayJarvis core
// ─────────────────────────────────────────

async function fetchBotHistory(botId: string, days: number) {
  try {
    const start = new Date()
    start.setDate(start.getDate() - days)
    const res = await fetch(`${process.env.PAYJARVIS_API_URL}/internal/bots/${botId}/transactions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, limit: 500 }),
    })
    if (!res.ok) return []
    const data = await res.json() as any
    return (data.transactions ?? []).map((t: any) => ({
      botId: t.botId,
      amount: parseFloat(t.amount),
      merchantId: t.merchantId ?? 'unknown',
      category: t.category ?? 'other',
      decision: t.decision,
      timestamp: new Date(t.decisionAt),
      hourUTC: new Date(t.decisionAt).getUTCHours(),
    }))
  } catch { return [] }
}

async function fetchBotData(botId: string) {
  try {
    const res = await fetch(`${process.env.PAYJARVIS_API_URL}/internal/bots/${botId}`, {
      headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function fetchBotStats(botId: string, start: Date, end: Date) {
  try {
    const res = await fetch(`${process.env.PAYJARVIS_API_URL}/internal/bots/${botId}/stats`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end }),
    })
    if (!res.ok) return { totalTransactions: 0, totalApproved: 0, totalBlocked: 0, totalPendingHuman: 0, totalAmountApproved: 0, avgAmount: 0, topMerchants: [], topCategories: [] }
    return res.json()
  } catch {
    return { totalTransactions: 0, totalApproved: 0, totalBlocked: 0, totalPendingHuman: 0, totalAmountApproved: 0, avgAmount: 0, topMerchants: [], topCategories: [] }
  }
}

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────

const start = async () => {
  await app.listen({ port: parseInt(process.env.PORT ?? '3004'), host: '0.0.0.0' })
}

start().catch(console.error)

export { app }
