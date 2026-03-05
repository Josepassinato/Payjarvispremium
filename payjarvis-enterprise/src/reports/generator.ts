/**
 * PAYJARVIS ENTERPRISE — Report Generator
 *
 * Gera relatórios de auditoria em PDF para clientes Enterprise.
 * Inclui: resumo executivo, histórico de transações, Trust Score,
 * Domain Scores, anomalias detectadas e timeline de eventos.
 *
 * Usa PDFKit para geração server-side.
 * Fechado — Enterprise only
 */

import type { AnomalyResult } from '../anomaly/detector'
import type { BotDomainProfile } from '../domain-scores/calculator'

export interface ReportInput {
  bot: {
    id: string
    name: string
    platform: string | null
    trustScore: number
    status: string
    createdAt: Date
  }
  owner: {
    id: string
    email: string
    fullName: string | null
  }
  period: {
    start: Date
    end: Date
  }
  stats: {
    totalTransactions: number
    totalApproved: number
    totalBlocked: number
    totalPendingHuman: number
    totalAmountApproved: number
    avgAmount: number
    topMerchants: Array<{ name: string; count: number; totalAmount: number }>
    topCategories: Array<{ category: string; count: number }>
  }
  anomalies: AnomalyResult[]
  domainProfile: BotDomainProfile | null
  trustScoreHistory: Array<{ date: Date; score: number; event: string }>
}

export interface ReportOutput {
  filename: string
  buffer: Buffer
  generatedAt: Date
  pageCount: number
}

// ─────────────────────────────────────────
// GERADOR
// ─────────────────────────────────────────

export class ReportGenerator {

  async generate(input: ReportInput): Promise<ReportOutput> {
    // Importação lazy para não quebrar em ambientes sem PDFKit
    const PDFDocument = await import('pdfkit').then(m => m.default)

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    await new Promise<void>((resolve) => {
      doc.on('end', resolve)

      // ── CAPA ──────────────────────────────────
      this.renderCover(doc, input)

      // ── RESUMO EXECUTIVO ──────────────────────
      doc.addPage()
      this.renderExecutiveSummary(doc, input)

      // ── MÉTRICAS DE TRANSAÇÕES ────────────────
      doc.addPage()
      this.renderTransactionMetrics(doc, input)

      // ── TRUST SCORE ───────────────────────────
      if (input.trustScoreHistory.length > 0) {
        doc.addPage()
        this.renderTrustScore(doc, input)
      }

      // ── DOMAIN SCORES ─────────────────────────
      if (input.domainProfile) {
        doc.addPage()
        this.renderDomainScores(doc, input)
      }

      // ── ANOMALIAS ─────────────────────────────
      if (input.anomalies.length > 0) {
        doc.addPage()
        this.renderAnomalies(doc, input)
      }

      // ── RODAPÉ ────────────────────────────────
      this.renderFooter(doc, input)

      doc.end()
    })

    const buffer = Buffer.concat(chunks)
    const filename = `payjarvis-report-${input.bot.id}-${this.formatDate(input.period.start)}-${this.formatDate(input.period.end)}.pdf`

    return { filename, buffer, generatedAt: new Date(), pageCount: doc.bufferedPageRange().count }
  }

  // ─────────────────────────────────────────
  // SEÇÕES
  // ─────────────────────────────────────────

  private renderCover(doc: any, input: ReportInput) {
    // Header verde PayJarvis
    doc.rect(0, 0, doc.page.width, 180).fill('#0a0a0a')
    doc.fill('#b8ff2e').fontSize(32).font('Helvetica-Bold')
      .text('PAYJARVIS', 50, 60)
    doc.fill('#ffffff').fontSize(14).font('Helvetica')
      .text('Enterprise Audit Report', 50, 100)
    doc.fill('#888888').fontSize(10)
      .text(`Generated: ${new Date().toISOString()}`, 50, 125)

    // Dados do bot
    doc.fill('#000000').fontSize(20).font('Helvetica-Bold')
      .text(input.bot.name, 50, 210)
    doc.fontSize(11).font('Helvetica').fill('#444444')
      .text(`Bot ID: ${input.bot.id}`, 50, 240)
      .text(`Owner: ${input.owner.fullName ?? input.owner.email}`, 50, 258)
      .text(`Platform: ${input.bot.platform ?? 'n/a'}`, 50, 276)
      .text(`Period: ${this.fmtDate(input.period.start)} → ${this.fmtDate(input.period.end)}`, 50, 294)

    // Trust Score badge
    const ts = input.bot.trustScore
    const tsColor = ts >= 76 ? '#22c55e' : ts >= 61 ? '#3b82f6' : ts >= 41 ? '#f59e0b' : '#ef4444'
    doc.rect(50, 330, 200, 80).fill(tsColor)
    doc.fill('#ffffff').fontSize(42).font('Helvetica-Bold')
      .text(ts.toString(), 50, 342, { width: 200, align: 'center' })
    doc.fontSize(11).text('Trust Score', 50, 388, { width: 200, align: 'center' })
  }

  private renderExecutiveSummary(doc: any, input: ReportInput) {
    this.sectionHeader(doc, 'Executive Summary')

    const approvalRate = input.stats.totalTransactions > 0
      ? ((input.stats.totalApproved / input.stats.totalTransactions) * 100).toFixed(1)
      : '0.0'

    const criticalAnomalies = input.anomalies.filter(a => a.level === 'critical').length
    const highAnomalies = input.anomalies.filter(a => a.level === 'high').length

    const bullets = [
      `Total de transações no período: ${input.stats.totalTransactions.toLocaleString()}`,
      `Taxa de aprovação: ${approvalRate}%`,
      `Volume aprovado: $${input.stats.totalAmountApproved.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `Trust Score atual: ${input.bot.trustScore}/100`,
      `Anomalias críticas detectadas: ${criticalAnomalies}`,
      `Anomalias de alto risco: ${highAnomalies}`,
    ]

    let y = doc.y + 10
    for (const bullet of bullets) {
      doc.circle(62, y + 5, 3).fill('#b8ff2e')
      doc.fill('#222222').fontSize(11).font('Helvetica')
        .text(bullet, 74, y)
      y += 22
    }
  }

  private renderTransactionMetrics(doc: any, input: ReportInput) {
    this.sectionHeader(doc, 'Transaction Metrics')
    const s = input.stats

    // Cards de métricas
    const cards = [
      { label: 'Total', value: s.totalTransactions.toString(), color: '#3b82f6' },
      { label: 'Approved', value: s.totalApproved.toString(), color: '#22c55e' },
      { label: 'Blocked', value: s.totalBlocked.toString(), color: '#ef4444' },
      { label: 'Human Review', value: s.totalPendingHuman.toString(), color: '#f59e0b' },
    ]

    let x = 50
    const y = doc.y + 10
    for (const card of cards) {
      doc.rect(x, y, 110, 65).fill(card.color)
      doc.fill('#ffffff').fontSize(26).font('Helvetica-Bold')
        .text(card.value, x, y + 10, { width: 110, align: 'center' })
      doc.fontSize(9).font('Helvetica')
        .text(card.label, x, y + 42, { width: 110, align: 'center' })
      x += 120
    }

    doc.moveDown(5)

    // Top Merchants
    if (s.topMerchants.length > 0) {
      doc.fontSize(13).font('Helvetica-Bold').fill('#111111').text('Top Merchants', 50, doc.y + 10)
      doc.moveDown(0.5)
      for (const m of s.topMerchants.slice(0, 5)) {
        doc.fontSize(10).font('Helvetica').fill('#444444')
          .text(`${m.name}`, 60, doc.y, { continued: true, width: 300 })
          .text(`${m.count} tx — $${m.totalAmount.toFixed(2)}`, { align: 'right' })
      }
    }

    // Top Categories
    if (s.topCategories.length > 0) {
      doc.moveDown(1)
      doc.fontSize(13).font('Helvetica-Bold').fill('#111111').text('Top Categories')
      doc.moveDown(0.5)
      for (const c of s.topCategories.slice(0, 5)) {
        doc.fontSize(10).font('Helvetica').fill('#444444')
          .text(`${c.category}`, 60, doc.y, { continued: true, width: 300 })
          .text(`${c.count} transactions`, { align: 'right' })
      }
    }
  }

  private renderTrustScore(doc: any, input: ReportInput) {
    this.sectionHeader(doc, 'Trust Score History')

    const history = input.trustScoreHistory.slice(-20)
    let y = doc.y + 10

    for (const entry of history) {
      const color = entry.score >= 76 ? '#22c55e' : entry.score >= 61 ? '#3b82f6' : entry.score >= 41 ? '#f59e0b' : '#ef4444'
      doc.rect(50, y, 6, 18).fill(color)
      doc.fill('#444444').fontSize(10).font('Helvetica')
        .text(this.fmtDate(entry.date), 64, y + 3, { width: 90 })
        .text(entry.event, 160, y + 3, { width: 280 })
      doc.fill(color).font('Helvetica-Bold')
        .text(entry.score.toString(), 446, y + 3, { width: 50, align: 'right' })
      y += 24
      if (y > 720) { doc.addPage(); y = 80 }
    }
  }

  private renderDomainScores(doc: any, input: ReportInput) {
    if (!input.domainProfile) return
    this.sectionHeader(doc, 'Domain Trust Scores')

    const domains = Object.values(input.domainProfile.domains)
      .sort((a, b) => b.score - a.score)

    let y = doc.y + 10
    for (const d of domains) {
      const barWidth = Math.round((d.score / 100) * 300)
      const color = d.score >= 76 ? '#22c55e' : d.score >= 61 ? '#3b82f6' : d.score >= 41 ? '#f59e0b' : '#ef4444'

      doc.fill('#222222').fontSize(10).font('Helvetica-Bold')
        .text(d.domain.toUpperCase(), 50, y)
      doc.rect(50, y + 14, 300, 10).fill('#e5e7eb')
      doc.rect(50, y + 14, barWidth, 10).fill(color)
      doc.fill('#444444').fontSize(9).font('Helvetica')
        .text(`${d.score}/100 — ${d.tier} — ${d.totalTransactions} tx — autonomy $${d.autonomyLimit}`, 360, y + 14)

      y += 40
      if (y > 720) { doc.addPage(); y = 80 }
    }
  }

  private renderAnomalies(doc: any, input: ReportInput) {
    this.sectionHeader(doc, 'Anomaly Detection')

    let y = doc.y + 10
    for (const anomaly of input.anomalies) {
      const levelColor = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#84cc16', none: '#9ca3af' }[anomaly.level]

      doc.rect(50, y, doc.page.width - 100, 1).fill('#e5e7eb')
      y += 8
      doc.fill(levelColor).fontSize(11).font('Helvetica-Bold')
        .text(`[${anomaly.level.toUpperCase()}] Score: ${anomaly.score}`, 50, y)
      doc.fill('#666666').fontSize(9).font('Helvetica')
        .text(anomaly.analyzedAt.toISOString(), 400, y)
      y += 16

      for (const signal of anomaly.signals) {
        doc.circle(62, y + 4, 2).fill(levelColor)
        doc.fill('#444444').fontSize(9).font('Helvetica')
          .text(`${signal.type}: ${signal.detail}`, 70, y)
        y += 14
      }
      y += 8
      if (y > 720) { doc.addPage(); y = 80 }
    }
  }

  private renderFooter(doc: any, input: ReportInput) {
    const pages = doc.bufferedPageRange()
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i)
      doc.fill('#aaaaaa').fontSize(8).font('Helvetica')
        .text(
          `PayJarvis Enterprise Report — ${input.bot.name} — Page ${i + 1} of ${pages.count} — Confidential`,
          50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 }
        )
    }
  }

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────

  private sectionHeader(doc: any, title: string) {
    doc.rect(50, doc.y, doc.page.width - 100, 36).fill('#0a0a0a')
    doc.fill('#b8ff2e').fontSize(14).font('Helvetica-Bold')
      .text(title, 62, doc.y - 30)
    doc.moveDown(0.5)
  }

  private fmtDate(d: Date): string {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0]
  }
}
