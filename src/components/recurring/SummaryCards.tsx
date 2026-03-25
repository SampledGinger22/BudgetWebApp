'use client'

import { Card, Col, Row, Select, Statistic } from 'antd'
import type { RecurringTemplate } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

interface SummaryCardsProps {
  templates: RecurringTemplate[]
  timeView: string
  onTimeViewChange: (view: string) => void
}

const TIME_VIEW_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
]

function timeViewMultiplier(view: string): number {
  switch (view) {
    case 'daily': return 1 / 30.44
    case 'weekly': return 1 / 4.33
    case 'quarterly': return 3
    case 'annual': return 12
    case 'monthly':
    default: return 1
  }
}

function monthlyEquivalentCents(template: RecurringTemplate): number {
  if (template.frequency === 'weekly') {
    return Math.round((template.amount_cents * 4.33) / template.interval_n)
  }
  return Math.round(template.amount_cents / template.interval_n)
}

interface StatCardProps {
  title: string
  cents: number
  color: string
}

function StatCard({ title, cents, color }: StatCardProps): React.JSX.Element {
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Statistic
        title={title}
        value={0}
        valueStyle={{
          fontFamily: MONEY_FONT,
          color,
          fontSize: 18,
          fontWeight: 600,
        }}
        formatter={() => formatCurrency(Math.abs(cents)).replace(/^\$/, '')}
        prefix={cents < 0 ? '-$' : '$'}
      />
    </Card>
  )
}

export function SummaryCards({ templates, timeView, onTimeViewChange }: SummaryCardsProps): React.JSX.Element {
  const multiplier = timeViewMultiplier(timeView)
  const activeTemplates = templates.filter((t) => t.status === 'active')

  const billsCents = activeTemplates
    .filter((t) => t.type === 'bill' && t.is_debit === 1)
    .reduce((sum, t) => sum + monthlyEquivalentCents(t), 0)

  const incomeCents = activeTemplates
    .filter((t) => t.type === 'income' && t.is_debit === 0)
    .reduce((sum, t) => sum + monthlyEquivalentCents(t), 0)

  const subscriptionsCents = activeTemplates
    .filter((t) => t.type === 'subscription' && t.is_debit === 1)
    .reduce((sum, t) => sum + monthlyEquivalentCents(t), 0)

  const totalExpensesCents = activeTemplates
    .filter((t) => t.is_debit === 1)
    .reduce((sum, t) => sum + monthlyEquivalentCents(t), 0)

  const netCents = incomeCents - totalExpensesCents

  const billsDisplay = Math.round(billsCents * multiplier)
  const incomeDisplay = Math.round(incomeCents * multiplier)
  const subscriptionsDisplay = Math.round(subscriptionsCents * multiplier)
  const netDisplay = Math.round(netCents * multiplier)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Select
          size="small"
          value={timeView}
          onChange={onTimeViewChange}
          options={TIME_VIEW_OPTIONS}
          style={{ width: 120 }}
        />
      </div>
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Bills" cents={billsDisplay} color={COLORS.terracotta} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Income" cents={incomeDisplay} color={COLORS.sage} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Subscriptions" cents={subscriptionsDisplay} color={COLORS.copper} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            size="small"
            style={{
              height: '100%',
              borderColor: netDisplay >= 0 ? COLORS.sage : COLORS.terracotta,
              borderWidth: 2,
            }}
          >
            <Statistic
              title="Net"
              value={0}
              valueStyle={{
                fontFamily: MONEY_FONT,
                color: netDisplay >= 0 ? COLORS.sage : COLORS.terracotta,
                fontSize: 18,
                fontWeight: 700,
              }}
              formatter={() => formatCurrency(Math.abs(netDisplay)).replace(/^\$/, '')}
              prefix={netDisplay < 0 ? '-$' : '$'}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default SummaryCards
