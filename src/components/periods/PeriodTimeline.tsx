'use client'

import { Collapse, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import type { BudgetPeriod } from '@/lib/api/types'
import { PeriodIncomeLines } from './PeriodIncomeLines'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

const { Text } = Typography

interface PeriodTimelineProps {
  periods: BudgetPeriod[]
}

export function PeriodTimeline({ periods }: PeriodTimelineProps): React.JSX.Element {
  const today = dayjs().format('YYYY-MM-DD')
  const sortedPeriods = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date))

  if (sortedPeriods.length === 0) {
    return <Text type="secondary">No budget periods generated yet.</Text>
  }

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Text strong style={{ color: COLORS.walnut, fontSize: 14 }}>Budget Periods</Text>
      <Collapse accordion>
        {sortedPeriods.map((period) => {
          const isCurrent = period.start_date <= today && today <= period.end_date
          const isPast = period.end_date < today
          return (
            <Collapse.Panel
              key={period.id}
              header={
                <Space>
                  <Text style={{ color: COLORS.walnut, fontWeight: isCurrent ? 600 : 400 }}>
                    {dayjs(period.start_date).format('MMM D')} — {dayjs(period.end_date).format('MMM D, YYYY')}
                  </Text>
                  {isCurrent && <Tag color="blue">Current</Tag>}
                  {isPast && <Tag color="default">Past</Tag>}
                  <Text type="secondary" style={{ fontSize: 12 }}>{period.sub_periods.length} sub-period{period.sub_periods.length !== 1 ? 's' : ''}</Text>
                </Space>
              }
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {period.sub_periods.map((sp) => {
                  const spIsCurrent = sp.start_date <= today && today <= sp.end_date
                  return (
                    <div key={sp.id} style={{ padding: 12, border: `1px solid rgba(92, 61, 30, ${spIsCurrent ? '0.2' : '0.08'})`, borderRadius: 6, backgroundColor: spIsCurrent ? COLORS.creamDark : 'transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Space>
                          <Text style={{ fontSize: 13, color: COLORS.walnut, fontWeight: spIsCurrent ? 600 : 400 }}>
                            {dayjs(sp.start_date).format('MMM D')} — {dayjs(sp.end_date).format('MMM D, YYYY')}
                          </Text>
                          {spIsCurrent && <Tag color="blue" style={{ fontSize: 10 }}>Current</Tag>}
                          {sp.closed_at && <Tag color="default" style={{ fontSize: 10 }}>Closed</Tag>}
                          {sp.locked_at && <Tag color="red" style={{ fontSize: 10 }}>Locked</Tag>}
                        </Space>
                        {sp.surplus_carry_forward_cents !== 0 && (
                          <Text style={{ fontFamily: MONEY_FONT, fontSize: 11, color: sp.surplus_carry_forward_cents > 0 ? COLORS.sage : COLORS.terracotta }}>
                            Carry: {formatCurrency(sp.surplus_carry_forward_cents)}
                          </Text>
                        )}
                      </div>
                      <PeriodIncomeLines subPeriodId={sp.id} incomeLines={sp.income_lines} />
                    </div>
                  )
                })}
              </Space>
            </Collapse.Panel>
          )
        })}
      </Collapse>
    </Space>
  )
}

export default PeriodTimeline
