'use client'

import { Card, Col, Row, Statistic } from 'antd'
import type { Account } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { centsToDollars, formatCurrency } from '@/lib/utils/money'

interface AccountSummaryCardsProps {
  accounts: Account[]
}

function StatCard({
  title,
  value,
  isNegative,
}: {
  title: string
  value: number
  isNegative?: boolean
}): React.JSX.Element {
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Statistic
        title={title}
        value={centsToDollars(Math.abs(value))}
        precision={2}
        prefix={value < 0 ? '-$' : '$'}
        valueStyle={{
          fontFamily: MONEY_FONT,
          color: isNegative || value < 0 ? COLORS.warmRed : COLORS.sage,
          fontSize: 18,
        }}
        formatter={() => formatCurrency(Math.abs(value)).replace('$', '')}
      />
    </Card>
  )
}

export function AccountSummaryCards({ accounts }: AccountSummaryCardsProps): React.JSX.Element {
  const active = accounts.filter((a) => a.archived_at == null)

  const checkingTotal = active
    .filter((a) => a.type === 'checking')
    .reduce((sum, a) => sum + a.balance_cents, 0)

  const savingsTotal = active
    .filter((a) => a.type === 'savings')
    .reduce((sum, a) => sum + a.balance_cents, 0)

  const creditTotal = active
    .filter((a) => a.type === 'credit')
    .reduce((sum, a) => sum + a.balance_cents, 0)

  const loanTotal = active
    .filter((a) => a.type === 'student_loan' || a.type === 'standard_loan')
    .reduce((sum, a) => sum + a.balance_cents, 0)

  const cashTotal = checkingTotal + savingsTotal
  const debtTotal = creditTotal + loanTotal
  const netBalance = cashTotal - debtTotal

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} sm={12} lg={6}>
        <StatCard title="Checking" value={checkingTotal} />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard title="Savings" value={savingsTotal} />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard title="Credit Cards" value={creditTotal} isNegative={creditTotal > 0} />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard title="Loans" value={loanTotal} isNegative={loanTotal > 0} />
      </Col>
      <Col xs={24} sm={8} lg={8}>
        <Card size="small" style={{ borderColor: COLORS.sage, borderWidth: 1.5, height: '100%' }}>
          <Statistic
            title="Cash Total"
            value={centsToDollars(cashTotal)}
            precision={2}
            prefix="$"
            valueStyle={{ fontFamily: MONEY_FONT, color: COLORS.sage, fontSize: 20, fontWeight: 600 }}
            formatter={() => formatCurrency(cashTotal).replace('$', '')}
          />
        </Card>
      </Col>
      <Col xs={24} sm={8} lg={8}>
        <Card
          size="small"
          style={{ borderColor: debtTotal > 0 ? COLORS.warmRed : COLORS.sage, borderWidth: 1.5, height: '100%' }}
        >
          <Statistic
            title="Debt Total"
            value={centsToDollars(debtTotal)}
            precision={2}
            prefix="$"
            valueStyle={{ fontFamily: MONEY_FONT, color: debtTotal > 0 ? COLORS.warmRed : COLORS.sage, fontSize: 20, fontWeight: 600 }}
            formatter={() => formatCurrency(debtTotal).replace('$', '')}
          />
        </Card>
      </Col>
      <Col xs={24} sm={8} lg={8}>
        <Card
          size="small"
          style={{ borderColor: netBalance >= 0 ? COLORS.sage : COLORS.warmRed, borderWidth: 2, height: '100%' }}
        >
          <Statistic
            title="Net Balance"
            value={centsToDollars(Math.abs(netBalance))}
            precision={2}
            prefix={netBalance < 0 ? '-$' : '$'}
            valueStyle={{ fontFamily: MONEY_FONT, color: netBalance >= 0 ? COLORS.sage : COLORS.warmRed, fontSize: 22, fontWeight: 700 }}
            formatter={() => formatCurrency(Math.abs(netBalance)).replace('$', '')}
          />
        </Card>
      </Col>
    </Row>
  )
}

export default AccountSummaryCards
