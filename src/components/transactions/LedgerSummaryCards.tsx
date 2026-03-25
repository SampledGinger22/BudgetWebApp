'use client'

import { Card, Col, Row, Statistic } from 'antd'
import type { TransactionsSummaryResponse } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

interface LedgerSummaryCardsProps {
  summary: TransactionsSummaryResponse | undefined
  isLoading?: boolean
}

export function LedgerSummaryCards({ summary, isLoading }: LedgerSummaryCardsProps): React.JSX.Element {
  const balance = summary?.balance_cents ?? 0
  const income = summary?.income_cents ?? 0
  const expenses = summary?.expense_cents ?? 0
  const count = summary?.count ?? 0

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} sm={12} lg={6}>
        <Card size="small" style={{ height: '100%' }} loading={isLoading}>
          <Statistic
            title="Current Balance"
            value={formatCurrency(Math.abs(balance)).replace('$', '')}
            prefix={balance < 0 ? '-$' : '$'}
            valueStyle={{
              fontFamily: MONEY_FONT,
              color: balance >= 0 ? COLORS.sage : COLORS.terracotta,
              fontSize: 18,
            }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card size="small" style={{ height: '100%' }} loading={isLoading}>
          <Statistic
            title="Income"
            value={formatCurrency(income).replace('$', '')}
            prefix="$"
            valueStyle={{
              fontFamily: MONEY_FONT,
              color: COLORS.sage,
              fontSize: 18,
            }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card size="small" style={{ height: '100%' }} loading={isLoading}>
          <Statistic
            title="Expenses"
            value={formatCurrency(expenses).replace('$', '')}
            prefix="$"
            valueStyle={{
              fontFamily: MONEY_FONT,
              color: COLORS.terracotta,
              fontSize: 18,
            }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card size="small" style={{ height: '100%' }} loading={isLoading}>
          <Statistic
            title="Transactions"
            value={count}
            valueStyle={{
              color: COLORS.walnut,
              fontSize: 18,
            }}
          />
        </Card>
      </Col>
    </Row>
  )
}
