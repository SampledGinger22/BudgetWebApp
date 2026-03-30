'use client'

import { Card, Col, Empty, Row, Space, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BankOutlined, CreditCardOutlined, PlusOutlined,
  RetweetOutlined, SettingOutlined, WarningOutlined,
} from '@ant-design/icons'
import Link from 'next/link'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ChecklistItem } from '@/components/dashboard/ChecklistItem'
import { useDashboard } from '@/lib/api/dashboard'
import { useUnconfirmedCount, useRecurringTemplates } from '@/lib/api/recurring'
import { usePeriods } from '@/lib/api/periods'
import { useAccounts } from '@/lib/api/accounts'
import { useCategories } from '@/lib/api/categories'
import { usePostHog } from '@/lib/posthog/hooks'
import { EVENTS } from '@/lib/posthog/events'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// ─── Compact accounts table columns ──────────────────────────────────────────

interface AccountRow {
  key: number
  name: string
  type: string
  balance_cents: number
}

const TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit Card',
  student_loan: 'Student Loan',
  standard_loan: 'Loan',
}

// ─── Variant B: Compact Summary Dashboard ────────────────────────────────────

export default function DashboardVariantB(): React.JSX.Element {
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

  // Onboarding state
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

  // Conversion tracking: dashboard_interaction with variant='test'
  const trackInteraction = (action: string) => {
    posthog?.capture(EVENTS.DASHBOARD_INTERACTION, { variant: 'test', action })
  }

  // Table data
  const activeAccounts = accounts.filter((a) => !a.archived_at)
  const tableData: AccountRow[] = activeAccounts.map((a) => ({
    key: a.id,
    name: a.name,
    type: a.type,
    balance_cents: a.balance_cents,
  }))

  const columns: ColumnsType<AccountRow> = [
    {
      title: 'Account',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong style={{ color: COLORS.walnut }}>{name}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Text type="secondary">{TYPE_LABELS[type] ?? type}</Text>,
    },
    {
      title: 'Balance',
      dataIndex: 'balance_cents',
      key: 'balance',
      align: 'right',
      render: (cents: number) => (
        <Text style={{ fontFamily: MONEY_FONT, fontWeight: 600, color: cents < 0 ? COLORS.terracotta : COLORS.sage }}>
          {formatCurrency(cents)}
        </Text>
      ),
    },
  ]

  // Summary bar data
  const summaryItems = totals
    ? [
        { label: 'Net Worth', cents: totals.net, color: totals.net >= 0 ? COLORS.sage : COLORS.terracotta },
        { label: 'Checking', cents: totals.checking, color: COLORS.sage },
        { label: 'Savings', cents: totals.savings, color: COLORS.sage },
        { label: 'Credit', cents: totals.credit, color: totals.credit < 0 ? COLORS.terracotta : COLORS.sage },
      ]
    : []

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0, color: COLORS.walnut }}>Dashboard</Title>

      {/* Compact horizontal summary bar — all key numbers at a glance */}
      {summaryItems.length > 0 && (
        <ErrorBoundary label="Summary Bar">
          <Card size="small" style={{ borderColor: 'rgba(169, 85, 55, 0.2)' }}>
            <Row gutter={[16, 8]} align="middle">
              {summaryItems.map(({ label, cents, color }) => (
                <Col xs={12} sm={6} key={label} style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', lineHeight: 1 }}>{label}</Text>
                  <Text style={{ fontFamily: MONEY_FONT, fontWeight: 700, color, fontSize: 18, lineHeight: 1.4 }}>
                    {formatCurrency(cents)}
                  </Text>
                </Col>
              ))}
            </Row>
          </Card>
        </ErrorBoundary>
      )}

      {/* Onboarding Checklist — shown when setup is incomplete */}
      {!setupComplete && (
        <ErrorBoundary label="Onboarding">
          <Card
            title={<Space><SettingOutlined style={{ color: COLORS.terracotta }} /><span>Get Started</span></Space>}
            size="small"
            style={{ borderColor: 'rgba(169, 85, 55, 0.2)' }}
          >
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
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

      {/* Compact accounts table — replaces the card-per-account layout */}
      <ErrorBoundary label="Accounts Table">
        {activeAccounts.length > 0 ? (
          <Card
            title={<Space><BankOutlined style={{ color: COLORS.terracotta }} /><span>Accounts</span></Space>}
            size="small"
            style={{ borderColor: 'rgba(169, 85, 55, 0.2)' }}
          >
            <Table<AccountRow>
              dataSource={tableData}
              columns={columns}
              pagination={false}
              size="small"
              showHeader
              onRow={(record) => ({
                onClick: () => trackInteraction('click_account'),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        ) : (
          !loadingDashboard && (
            <Card size="small" style={{ borderColor: 'rgba(169, 85, 55, 0.2)' }}>
              <Empty description={<Text type="secondary">No accounts yet. Add one to get started.</Text>} />
            </Card>
          )
        )}
      </ErrorBoundary>

      {/* Recurring summary widget — compact inline version */}
      {templates.length > 0 && (
        <ErrorBoundary label="Recurring Summary">
          <Card
            title={<Space><RetweetOutlined style={{ color: COLORS.terracotta }} /><span>Recurring This Period</span></Space>}
            size="small"
            style={{ borderColor: 'rgba(169, 85, 55, 0.2)' }}
          >
            <Row gutter={[16, 8]} align="middle">
              <Col xs={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontFamily: MONEY_FONT, fontWeight: 700, color: COLORS.sage, lineHeight: 1 }}>{confirmedCount}</div>
                <Text type="secondary" style={{ fontSize: 11 }}>Confirmed</Text>
              </Col>
              <Col xs={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontFamily: MONEY_FONT, fontWeight: 700, color: unconfirmedCount > 0 ? COLORS.terracotta : COLORS.walnut, lineHeight: 1 }}>
                  {unconfirmedCount}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {unconfirmedCount > 0 && <WarningOutlined style={{ color: COLORS.terracotta, fontSize: 11 }} />}
                  <Text type="secondary" style={{ fontSize: 11 }}>Unconfirmed</Text>
                </div>
              </Col>
              <Col xs={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontFamily: MONEY_FONT, fontWeight: 600, color: COLORS.walnut, lineHeight: 1 }}>{formatCurrency(totalExpectedCents)}</div>
                <Text type="secondary" style={{ fontSize: 11 }}>Expected</Text>
              </Col>
            </Row>
            {unconfirmedCount > 0 && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
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
