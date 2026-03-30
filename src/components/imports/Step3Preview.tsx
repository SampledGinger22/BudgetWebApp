'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button, Input, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import { parseDate, detectDateFormat } from '@/lib/utils/dateParser'
import { parseAmountCents, parseSplitAmountCents } from '@/lib/utils/amountParser'
import { useCheckDuplicates } from '@/lib/api/imports'
import { useCategories } from '@/lib/api/categories'
import { useVendors } from '@/lib/api/vendors'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'
import type { WizardState, StagedTransaction } from './types'

const { Text } = Typography

interface Step3Props {
  wizardState: WizardState
  stagedTransactions: StagedTransaction[]
  onStagedChange: (transactions: StagedTransaction[]) => void
}

/**
 * Step3Preview uses useRef + renderTick pattern for mutable arrays.
 * This avoids deep-cloning the entire staged array on every inline edit,
 * which would be expensive with hundreds of imported rows.
 */
export function Step3Preview({ wizardState, stagedTransactions, onStagedChange }: Step3Props): React.JSX.Element {
  const checkDuplicates = useCheckDuplicates()
  const { data: categories = [] } = useCategories()
  const { data: vendors = [] } = useVendors()
  const [renderTick, setRenderTick] = useState(0)
  const txnRef = useRef<StagedTransaction[]>(stagedTransactions)
  const [showDuplicates, setShowDuplicates] = useState(true)

  const categoryOptions = categories.flatMap((g) =>
    g.categories.filter((c) => !c.archived_at).flatMap((c) => {
      const parent = [{ value: c.id, label: `${g.name} / ${c.name}` }]
      const subs = (c.sub_categories ?? []).filter((sc) => !sc.archived_at).map((sc) => ({ value: sc.id, label: `${g.name} / ${c.name} / ${sc.name}` }))
      return [...parent, ...subs]
    }),
  )

  const vendorOptions = vendors.filter((v) => !v.archived_at).map((v) => ({ value: v.id, label: v.name }))

  // Parse rows on first mount
  useEffect(() => {
    if (stagedTransactions.length > 0) return // Already staged

    const { mapping, rows } = wizardState
    const staged: StagedTransaction[] = rows.map((row, idx) => {
      let date = ''
      let parseError: string | null = null

      try {
        const rawDate = row[mapping.dateColumn ?? 0] ?? ''
        const fmt = mapping.dateFormat || detectDateFormat([rawDate]) || 'YYYY-MM-DD'
        const parsed = parseDate(rawDate, fmt)
        date = parsed ?? ''
        if (!date) parseError = `Invalid date: "${rawDate}"`
      } catch { parseError = 'Date parse error' }

      const description = row[mapping.descriptionColumn ?? 1] ?? ''

      let amount_cents = 0
      let is_debit = 1
      try {
        if (mapping.amountMode === 'single') {
          const rawAmount = row[mapping.amountColumn ?? 2] ?? '0'
          const parsed = parseAmountCents(rawAmount, mapping.signConvention)
          if (parsed) { amount_cents = Math.abs(parsed.cents); is_debit = parsed.isDebit }
        } else {
          const debitRaw = row[mapping.debitColumn ?? 2] ?? ''
          const creditRaw = row[mapping.creditColumn ?? 3] ?? ''
          const splitResult = parseSplitAmountCents(debitRaw, creditRaw)
          if (splitResult) { amount_cents = Math.abs(splitResult.cents); is_debit = splitResult.isDebit }
        }
      } catch { parseError = parseError ?? 'Amount parse error' }

      return {
        idx, date, description, original_description: description,
        amount_cents, is_debit, category_id: null, vendor_id: null, member_id: null,
        excluded: false, parseError, isDuplicate: false, fitid: null,
      }
    })

    txnRef.current = staged
    onStagedChange(staged)

    // Check for duplicates
    if (wizardState.accountId && staged.length > 0) {
      const validTxns = staged.filter((t) => !t.parseError).map((t) => ({
        date: t.date, description: t.description, amount_cents: t.amount_cents, is_debit: t.is_debit,
      }))
      if (validTxns.length > 0) {
        checkDuplicates.mutateAsync({ accountId: wizardState.accountId, transactions: validTxns })
          .then((resp) => {
            const dupes = resp.duplicates ?? []
            let validIdx = 0
            for (const t of txnRef.current) {
              if (!t.parseError) {
                if (dupes[validIdx]) { t.isDuplicate = true; t.excluded = true }
                validIdx++
              }
            }
            setRenderTick((t) => t + 1)
            onStagedChange([...txnRef.current])
          })
          .catch(() => { /* non-critical */ })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateField = useCallback((idx: number, field: keyof StagedTransaction, value: unknown): void => {
    const item = txnRef.current.find((t) => t.idx === idx)
    if (item) { (item as unknown as Record<string, unknown>)[field] = value }
    setRenderTick((t) => t + 1)
    onStagedChange([...txnRef.current])
  }, [onStagedChange])

  const toggleExclude = useCallback((idx: number): void => {
    const item = txnRef.current.find((t) => t.idx === idx)
    if (item) item.excluded = !item.excluded
    setRenderTick((t) => t + 1)
    onStagedChange([...txnRef.current])
  }, [onStagedChange])

  const displayed = txnRef.current.filter((t) => showDuplicates || !t.isDuplicate)
  const includedCount = txnRef.current.filter((t) => !t.excluded && !t.parseError).length
  const duplicateCount = txnRef.current.filter((t) => t.isDuplicate).length
  const errorCount = txnRef.current.filter((t) => t.parseError).length

  const columns = [
    {
      title: '', key: 'include', width: 50,
      render: (_: unknown, record: StagedTransaction) => (
        <Switch size="small" checked={!record.excluded} onChange={() => toggleExclude(record.idx)} disabled={!!record.parseError} />
      ),
    },
    {
      title: 'Date', key: 'date', width: 110,
      render: (_: unknown, record: StagedTransaction) => record.parseError ? (
        <Tag color="error" style={{ fontSize: 11 }}>{record.parseError}</Tag>
      ) : (
        <Text style={{ fontSize: 12 }}>{record.date}</Text>
      ),
    },
    {
      title: 'Description', key: 'description',
      render: (_: unknown, record: StagedTransaction) => (
        <Input size="small" value={record.description} onChange={(e) => updateField(record.idx, 'description', e.target.value)}
          style={{ fontSize: 12 }} disabled={record.excluded} />
      ),
    },
    {
      title: 'Amount', key: 'amount', width: 120, align: 'right' as const,
      render: (_: unknown, record: StagedTransaction) => (
        <Text style={{ fontFamily: MONEY_FONT, color: record.is_debit === 1 ? COLORS.terracotta : COLORS.sage, fontWeight: 600, fontSize: 12 }}>
          {record.is_debit === 1 ? '-' : '+'}{formatCurrency(record.amount_cents)}
        </Text>
      ),
    },
    {
      title: 'Category', key: 'category', width: 180,
      render: (_: unknown, record: StagedTransaction) => (
        <Select size="small" value={record.category_id ?? undefined} onChange={(v) => updateField(record.idx, 'category_id', v ?? null)}
          options={categoryOptions} placeholder="—" allowClear showSearch style={{ width: '100%' }}
          filterOption={(input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
          disabled={record.excluded}
        />
      ),
    },
    {
      title: 'Payee', key: 'vendor', width: 160,
      render: (_: unknown, record: StagedTransaction) => (
        <Select size="small" value={record.vendor_id ?? undefined} onChange={(v) => updateField(record.idx, 'vendor_id', v ?? null)}
          options={vendorOptions} placeholder="—" allowClear showSearch style={{ width: '100%' }}
          filterOption={(input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
          disabled={record.excluded}
        />
      ),
    },
    {
      title: 'Status', key: 'status', width: 100,
      render: (_: unknown, record: StagedTransaction) => (
        <Space size={4}>
          {record.isDuplicate && <Tag color="orange" style={{ fontSize: 10 }}>Dup</Tag>}
          {record.excluded && <Tag color="default" style={{ fontSize: 10 }}>Excluded</Tag>}
        </Space>
      ),
    },
  ]

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text strong style={{ color: COLORS.walnut }}>{includedCount} transactions to import</Text>
          {duplicateCount > 0 && <Tag color="orange">{duplicateCount} potential duplicates</Tag>}
          {errorCount > 0 && <Tag color="error">{errorCount} parse errors</Tag>}
        </Space>
        {duplicateCount > 0 && (
          <Space>
            <Text style={{ fontSize: 12 }}>Show duplicates</Text>
            <Switch size="small" checked={showDuplicates} onChange={setShowDuplicates} />
          </Space>
        )}
      </div>
      <Table dataSource={displayed} columns={columns} rowKey="idx" size="small" pagination={{ pageSize: 50 }}
        rowClassName={(record) => record.excluded ? 'import-row-excluded' : ''} scroll={{ x: 'max-content' }} />
    </Space>
  )
}
