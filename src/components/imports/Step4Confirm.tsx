'use client'

import { useState } from 'react'
import { Alert, Button, Input, Space, Statistic, Typography, message } from 'antd'
import { CheckCircleOutlined, SaveOutlined } from '@ant-design/icons'
import { useCommitImport, useCreateProfile } from '@/lib/api/imports'
import { buildFingerprint } from '@/lib/utils/csvParser'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'
import type { WizardState, StagedTransaction, ImportCommitResult } from './types'

const { Text, Title } = Typography

interface Step4Props {
  wizardState: WizardState
  stagedTransactions: StagedTransaction[]
  onImportSuccess: (result: ImportCommitResult, savedProfileName: string | null) => void
}

export function Step4Confirm({ wizardState, stagedTransactions, onImportSuccess }: Step4Props): React.JSX.Element {
  const commitImport = useCommitImport()
  const createProfile = useCreateProfile()
  const [saveProfileName, setSaveProfileName] = useState('')
  const [importing, setImporting] = useState(false)

  const includedTransactions = stagedTransactions.filter((t) => !t.excluded && !t.parseError)
  const totalIncome = includedTransactions.filter((t) => t.is_debit === 0).reduce((sum, t) => sum + t.amount_cents, 0)
  const totalExpenses = includedTransactions.filter((t) => t.is_debit === 1).reduce((sum, t) => sum + t.amount_cents, 0)

  const handleImport = async (): Promise<void> => {
    if (!wizardState.accountId || includedTransactions.length === 0) return
    setImporting(true)
    try {
      // Save profile if name provided
      let savedProfileName: string | null = null
      if (saveProfileName.trim() && !wizardState.profileId) {
        try {
          const fingerprint = buildFingerprint(wizardState.headers)
          await createProfile.mutateAsync({
            name: saveProfileName, header_fingerprint: fingerprint,
            mapping_json: JSON.stringify(wizardState.mapping),
          })
          savedProfileName = saveProfileName
        } catch { /* non-critical */ }
      }

      const result = await commitImport.mutateAsync({
        accountId: wizardState.accountId,
        filename: wizardState.fileName ?? 'import.csv',
        profileName: savedProfileName,
        format: 'csv',
        transactions: includedTransactions.map((t) => ({
          date: t.date, description: t.description, original_description: t.original_description,
          amount_cents: t.amount_cents, is_debit: t.is_debit,
          category_id: t.category_id, vendor_id: t.vendor_id, member_id: t.member_id,
        })),
      })
      onImportSuccess({ batchId: result.id ?? 0, imported: includedTransactions.length }, savedProfileName)
    } catch {
      void message.error('Failed to import transactions')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Title level={4} style={{ color: COLORS.walnut, margin: 0 }}>Confirm Import</Title>
      <div style={{ display: 'flex', gap: 24 }}>
        <Statistic title="Transactions" value={includedTransactions.length} />
        <Statistic title="Income" value={formatCurrency(totalIncome)} valueStyle={{ color: COLORS.sage, fontFamily: MONEY_FONT }} />
        <Statistic title="Expenses" value={formatCurrency(totalExpenses)} valueStyle={{ color: COLORS.terracotta, fontFamily: MONEY_FONT }} />
      </div>
      <Alert type="info" message={`Importing ${includedTransactions.length} transactions into the selected account from "${wizardState.fileName}".`} showIcon />

      {!wizardState.profileId && (
        <div style={{ background: COLORS.creamDark, borderRadius: 8, padding: 16 }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Text style={{ color: COLORS.walnut }}>Save column mapping as profile? (optional)</Text>
            <Input placeholder="Profile name..." value={saveProfileName} onChange={(e) => setSaveProfileName(e.target.value)} style={{ maxWidth: 300 }} />
          </Space>
        </div>
      )}

      <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={() => void handleImport()} loading={importing}
        disabled={includedTransactions.length === 0}>
        Import {includedTransactions.length} Transactions
      </Button>
    </Space>
  )
}
