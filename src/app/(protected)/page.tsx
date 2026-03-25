'use client'

import { Card, Col, Empty, Row, Space, Typography } from 'antd'
import {
  BankOutlined, CheckCircleOutlined, CreditCardOutlined,
  PlusOutlined, RetweetOutlined, SettingOutlined, WarningOutlined,
} from '@ant-design/icons'
import Link from 'next/link'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ChecklistItem } from '@/components/dashboard/ChecklistItem'
import { AccountBalanceCard } from '@/components/dashboard/AccountBalanceCard'
import DashboardVariantB from '@/components/dashboard/DashboardVariantB'
import { useDashboard } from '@/lib/api/dashboard'
import { useUnconfirmedCount, useRecurringTemplates } from '@/lib/api/recurring'
import { usePeriods } from '@/lib/api/periods'
import { useAccounts } from '@/lib/api/accounts'
import { useCategories } from '@/lib/api/categories'
import { useFeatureFlag, usePostHog } from '@/lib/posthog/hooks'
import { EVENTS, FLAGS } from '@/lib/posthog/events'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage(): React.JSX.Element {
  const posthog = usePostHog()
  const flagResult = useFeatureFlag(FLAGS.DASHBOARD_LAYOUT)

  // Feature flag: dashboard-layout ('control' | 'test')
  // Renders variant B when PostHog resolves to 'test'.
  // When PostHog isn't configured (dev without key), flagResult is undefined — fall back to control.
  if (flagResult?.variant === 'test') {
    return <DashboardVariantB />
  }

  return <DashboardControl />
}

// ─── Control variant (A) — current vertical card layout ──────────────────────

function DashboardControl(): React.JSX.Element {
  const posthog = usePostHog()
  const { data: dashboardData, isLoading: loadingDashboard } = useDashboard()
  const { data: unconfirmedResp } = useUnconfirmedCount()
  const { data: templatesResp } = useRecurringTemplates()
  const { data: periodsResp } = usePeriods()
  const { data: allAccounts = [] } = useAccounts()
  const { data: categoryGroups = [] } = useCategories()

  const accounts = dashboardData?.accounts ?? []
  const totals = dashboardData?.totals
  const unconfirmedCount = unconfirmedResp?.count ?? 0
  const templates = templatesResp?.data ?? []
  const periods = periodsResp?.data ?? []

  // Onboarding: check if basics are set up
  const hasAccounts = allAccounts.length > 0
  const hasPeriods = periods.length > 0
  const hasCategories = categoryGroups.some((g) => g.categories.length > 0)
  const hasTemplates = templates.length > 0
  const setupComplete = hasAccounts && hasPeriods && hasCategories

  // Recurring summary
  const activeTemplates = templates.filter((t) => t.status === 'active')
  const today = dayjs().format('YYYY-MM-DD')
  const totalExpectedCents = activeTemplates
    .filter((t) => (!t.start_date || t.start_date <= today) && (!t.end_date || t.end_date >= today))
    .reduce((sum, t) => sum + t.amount_cents, 0)
  const confirmedCount = Math.max(0, activeTemplates.length - unconfirmedCount)

  // Conversion tracking: dashboard_interaction with variant='control'
  const trackInteraction = (action: string) => {
    posthog?.capture(EVENTS.DASHBOARD_INTERACTION, { variant: 'control', action })
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0, color: COLORS.walnut }}>Dashboard</Title>

      {/* Onboarding Checklist (UX-09) — shown when setup is incomplete */}
      {!setupComplete && (
        <ErrorBoundary label="Onboarding">
          <Card
            title={<Space><SettingOutlined style={{ color: COLORS.terracotta }} /><span>Get Started</span></Space>}
            style={{ borderColor: 'rgba(169, 85, 55, 0.2)' }}
          >
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text type="secondary">Complete these steps to set up your budget:</Text>
              <ChecklistItem
                done={hasAccounts} label="Add your first account" href="/accounts"
                icon={<BankOutlined />}
                onClick={() => trackInteraction('checklist_add_account')}
              />
              <ChecklistItem
                done={hasPeriods} label="Set up your pay schedule" href="/settings/pay-schedule"
                icon={<SettingOutlined />}
                onClick={() => trackInteraction('checklist_pay_schedule')}
              />
              <ChecklistItem
                done={hasCategories} label="Create budget categories" href="/settings/categories"
                icon={<CreditCardOutlined />}
                onClick={() => trackInteraction('checklist_categories')}
              />
              {hasAccounts && hasPeriods && hasCategories && !hasTemplates && (
                <ChecklistItem
                  done={false} label="Set up recurring transactions" href="/recurring"
                  icon={<RetweetOutlined />}
                  onClick={() => trackInteraction('checklist_recurring')}
                />
              )}
            </Space>
          </Card>
        </ErrorBoundary>
      )}

      {/* Account Balances */}
      <ErrorBoundary label="Account Overview">
        {accounts.length > 0 ? (
          <Card title={<Space><BankOutlined style={{ color: COLORS.terracotta }} /><span>Account Balances</span></Space>}
            style={{ borderColor: 'rgba(169, 85, 55, 0.2)' }}>
            {accounts.filter((a) => !a.archived_at).map((account) => (
              <AccountBalanceCard
                key={account.id} name={account.name} type={account.type} balance_cents={account.balance_cents}
                onClick={() => trackInteraction('click_account')}
              />
            ))}
            {totals && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 4px', borderTop: `2px solid rgba(92, 61, 30, 0.2)`, marginTop: 8 }}>
                <Text strong style={{ color: COLORS.walnut, fontSize: 15 }}>Net Worth</Text>
                <Text style={{ fontFamily: MONEY_FONT, fontWeight: 700, fontSize: 18, color: totals.net >= 0 ? COLORS.sage : COLORS.terracotta }}>
                  {formatCurrency(totals.net)}
                </Text>
              </div>
            )}
          </Card>
        ) : (
          !loadingDashboard && (
            <Card style={{ borderColor: 'rgba(169, 85, 55, 0.2)' }}>
              <Empty description={<Text type="secondary">No accounts yet. Add one to get started.</Text>} />
            </Card>
          )
        )}
      </ErrorBoundary>

      {/* Totals by type */}
      {totals && (
        <ErrorBoundary label="Balance Totals">
          <Row gutter={[12, 12]}>
            {[
              { label: 'Checking', cents: totals.checking, color: COLORS.sage },
              { label: 'Savings', cents: totals.savings, color: COLORS.sage },
              { label: 'Credit Cards', cents: totals.credit, color: totals.credit < 0 ? COLORS.terracotta : COLORS.sage },
              { label: 'Loans', cents: totals.student_loan + totals.standard_loan, color: COLORS.terracotta },
            ].map(({ label, cents, color }) => (
              <Col xs={12} sm={6} key={label}>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{label}</Text>
                  <Text style={{ fontFamily: MONEY_FONT, fontWeight: 600, color, fontSize: 16 }}>
                    {formatCurrency(cents)}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>
        </ErrorBoundary>
      )}

      {/* Recurring summary widget */}
      {templates.length > 0 && (
        <ErrorBoundary label="Recurring Summary">
          <Card
            title={<Space><RetweetOutlined style={{ color: COLORS.terracotta }} /><span>Recurring This Period</span></Space>}
            style={{ borderColor: 'rgba(169, 85, 55, 0.2)' }}
          >
            <Space size={32}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontFamily: MONEY_FONT, fontWeight: 700, color: COLORS.sage, lineHeight: 1 }}>{confirmedCount}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Confirmed</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontFamily: MONEY_FONT, fontWeight: 700, color: unconfirmedCount > 0 ? COLORS.terracotta : COLORS.walnut, lineHeight: 1 }}>{unconfirmedCount}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {unconfirmedCount > 0 && <WarningOutlined style={{ color: COLORS.terracotta, fontSize: 11 }} />}
                  <Text type="secondary" style={{ fontSize: 12 }}>Unconfirmed</Text>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontFamily: MONEY_FONT, fontWeight: 600, color: COLORS.walnut, lineHeight: 1 }}>{formatCurrency(totalExpectedCents)}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Total Expected</Text>
              </div>
            </Space>
            {unconfirmedCount > 0 && (
              <div style={{ marginTop: 12 }}>
                <Link
                  href="/recurring"
                  style={{ color: COLORS.terracotta, fontSize: 13 }}
                  onClick={() => trackInteraction('review_unconfirmed')}
                >
                  Review {unconfirmedCount} unconfirmed entr{unconfirmedCount === 1 ? 'y' : 'ies'} →
                </Link>
              </div>
            )}
          </Card>
        </ErrorBoundary>
      )}
    </Space>
  )
}
