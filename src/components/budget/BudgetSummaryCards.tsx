'use client'

import { Card, Col, Row, Statistic, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import type { BudgetSummaryResponse } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

interface BudgetSummaryCardsProps {
  summary: BudgetSummaryResponse | null
  loading?: boolean
}

interface StatCardProps {
  title: string
  cents: number
  /** When true, positive values render in sage, negative in terracotta */
  signSensitive?: boolean
  /** Always render in this color regardless of value sign */
  fixedColor?: string
}

function StatCard({ title, cents, signSensitive, fixedColor }: StatCardProps): React.JSX.Element {
  let color: string
  if (fixedColor) {
    color = fixedColor
  } else if (signSensitive) {
    color = cents >= 0 ? COLORS.sage : COLORS.terracotta
  } else {
    color = COLORS.walnut
  }

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
        formatter={() => formatCurrency(cents).replace('$', '')}
        prefix={cents < 0 ? '-$' : '$'}
      />
    </Card>
  )
}

export function BudgetSummaryCards({
  summary,
  loading,
}: BudgetSummaryCardsProps): React.JSX.Element {
  const s = summary ?? {
    total_income_cents: 0,
    carry_forward_cents: 0,
    total_allocated_cents: 0,
    total_spent_cents: 0,
    total_remaining_cents: 0,
  }

  if (loading && !summary) {
    return (
      <Row gutter={[12, 12]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Col key={i} xs={24} sm={12} lg={8} xl={5}>
            <Card size="small" loading style={{ height: '100%' }} />
          </Col>
        ))}
      </Row>
    )
  }

  // UX-05: "Surplus" → "Left Over" (positive), "Deficit" → "Overspent" (negative)
  const remainingLabel =
    s.total_remaining_cents >= 0 ? 'Left Over (Budgeted)' : 'Overspent (Budgeted)'

  return (
    <Row gutter={[12, 12]}>
      {/* Total Income — always sage/positive */}
      <Col xs={24} sm={12} lg={8} xl={5}>
        <StatCard title="Total Income" cents={s.total_income_cents} fixedColor={COLORS.sage} />
      </Col>

      {/* UX-05: "Carry-Forward" → "Rolled Over" — sign-sensitive */}
      <Col xs={24} sm={12} lg={8} xl={5}>
        <StatCard
          title="Rolled Over"
          cents={s.carry_forward_cents}
          signSensitive
        />
      </Col>

      {/* Total Allocated */}
      <Col xs={24} sm={12} lg={8} xl={5}>
        <StatCard title="Total Allocated" cents={s.total_allocated_cents} />
      </Col>

      {/* Total Spent — always terracotta */}
      <Col xs={24} sm={12} lg={8} xl={5}>
        <StatCard
          title="Total Spent"
          cents={s.total_spent_cents}
          fixedColor={COLORS.terracotta}
        />
      </Col>

      {/* Remaining (Budgeted) — sign-sensitive, UX-05 labels, with tooltip for clarity */}
      <Col xs={24} sm={12} lg={8} xl={4}>
        <Card
          size="small"
          style={{
            height: '100%',
            borderColor: s.total_remaining_cents >= 0 ? COLORS.sage : COLORS.terracotta,
            borderWidth: 2,
          }}
        >
          <Statistic
            title={
              <span>
                {remainingLabel}
                <Tooltip title="Remaining spendable money from budgeted categories (excludes unallocated funds)">
                  <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 12, color: COLORS.walnut, opacity: 0.5 }} />
                </Tooltip>
              </span>
            }
            value={0}
            valueStyle={{
              fontFamily: MONEY_FONT,
              color: s.total_remaining_cents >= 0 ? COLORS.sage : COLORS.terracotta,
              fontSize: 20,
              fontWeight: 700,
            }}
            formatter={() => formatCurrency(Math.abs(s.total_remaining_cents)).replace('$', '')}
            prefix={s.total_remaining_cents < 0 ? '-$' : '$'}
          />
        </Card>
      </Col>
    </Row>
  )
}

export default BudgetSummaryCards
