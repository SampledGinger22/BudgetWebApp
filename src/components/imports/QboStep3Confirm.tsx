'use client'

import { useState } from 'react'
import { Alert, Button, Space, Statistic, Typography, message } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import type { QboParseResult } from '@/lib/utils/qboParser'
import { useCommitImport } from '@/lib/api/imports'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'
import type { WizardState, StagedTransaction, ImportCommitResult } from './types'

const { Text, Title } = Typography

interface QboStep3Props {
  wizardState: WizardState
  qboParseResult: QboParseResult
  stagedTransactions: StagedTransaction[]
  onImportSuccess: (result: ImportCommitResult, savedProfileName: string | null) => void
}

export function QboStep3Confirm({ wizardState, qboParseResult, stagedTransactions, onImportSuccess }: QboStep3Props): React.JSX.Element {
  const commitImport = useCommitImport()
  const [importing, setImporting] = useState(false)

  const includedTransactions = stagedTransactions.filter((t) => !t.excluded)
  const totalIncome = includedTransactions.filter((t) => t.is_debit === 0).reduce((sum, t) => sum + t.amount_cents, 0)
  const totalExpenses = includedTransactions.filter((t) => t.is_debit === 1).reduce((sum, t) => sum + t.amount_cents, 0)

  const handleImport = async (): Promise<void> => {
    if (!wizardState.accountId || includedTransactions.length === 0) return
    setImporting(true)
    try {
      const result = await commitImport.mutateAsync({
        accountId: wizardState.accountId,
        filename: wizardState.fileName ?? 'import.qbo',
        format: 'qbo',
        transactions: includedTransactions.map((t) => ({
          date: t.date, description: t.description, original_description: t.original_description,
          amount_cents: t.amount_cents, is_debit: t.is_debit,
          category_id: t.category_id, vendor_id: t.vendor_id, member_id: t.member_id,
          fitid: t.fitid,
        })),
      })
      onImportSuccess({ batchId: result.id ?? 0, imported: includedTransactions.length }, null)
    } catch {
      void message.error('Failed to import transactions')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Title level={4} style={{ color: COLORS.walnut, margin: 0 }}>Confirm QBO Import</Title>
      <div style={{ display: 'flex', gap: 24 }}>
        <Statistic title="Transactions" value={includedTransactions.length} />
        <Statistic title="Income" value={formatCurrency(totalIncome)} valueStyle={{ color: COLORS.sage, fontFamily: MONEY_FONT }} />
        <Statistic title="Expenses" value={formatCurrency(totalExpenses)} valueStyle={{ color: COLORS.terracotta, fontFamily: MONEY_FONT }} />
      </div>
      {qboParseResult.accountInfo && (
        <Alert type="info" showIcon message={`Bank: ${qboParseResult.accountInfo.bankId} / Account: ${qboParseResult.accountInfo.acctId} (${qboParseResult.accountInfo.acctType})`} />
      )}
      <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={() => void handleImport()} loading={importing}
        disabled={includedTransactions.length === 0}>
        Import {includedTransactions.length} Transactions
      </Button>
    </Space>
  )
}
