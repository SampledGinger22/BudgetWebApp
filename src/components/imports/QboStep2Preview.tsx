'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Input, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import { parseQboFile } from '@/lib/utils/qboParser'
import type { QboParseResult, QboTransaction } from '@/lib/utils/qboParser'
import { useCheckFitid } from '@/lib/api/imports'
import { useCategories } from '@/lib/api/categories'
import { useVendors } from '@/lib/api/vendors'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'
import type { WizardState, StagedTransaction } from './types'

const { Text } = Typography

interface QboStep2Props {
  wizardState: WizardState
  qboParseResult: QboParseResult | null
  stagedTransactions: StagedTransaction[]
  onStagedChange: (transactions: StagedTransaction[]) => void
  onParseResult: (result: QboParseResult) => void
}

export function QboStep2Preview({ wizardState, qboParseResult, stagedTransactions, onStagedChange, onParseResult }: QboStep2Props): React.JSX.Element {
  const checkFitid = useCheckFitid()
  const { data: categories = [] } = useCategories()
  const { data: vendors = [] } = useVendors()
  const [renderTick, setRenderTick] = useState(0)
  const txnRef = useRef<StagedTransaction[]>(stagedTransactions)

  const categoryOptions = categories.flatMap((g) =>
    g.categories.filter((c) => !c.archived_at).flatMap((c) => {
      const parent = [{ value: c.id, label: `${g.name} / ${c.name}` }]
      const subs = (c.sub_categories ?? []).filter((sc) => !sc.archived_at).map((sc) => ({ value: sc.id, label: `${g.name} / ${c.name} / ${sc.name}` }))
      return [...parent, ...subs]
    }),
  )
  const vendorOptions = vendors.filter((v) => !v.archived_at).map((v) => ({ value: v.id, label: v.name }))

  // Parse QBO file on mount
  useEffect(() => {
    if (qboParseResult || !wizardState.rawText) return
    try {
      const result = parseQboFile(wizardState.rawText)
      onParseResult(result)

      const staged: StagedTransaction[] = result.transactions.map((tx, idx) => ({
        idx, date: tx.date, description: tx.description, original_description: tx.description,
        amount_cents: tx.amount_cents, is_debit: tx.is_debit, category_id: null, vendor_id: null, member_id: null,
        excluded: false, parseError: null, isDuplicate: false, fitid: tx.fitid,
      }))

      txnRef.current = staged
      onStagedChange(staged)

      // Check FITID duplicates
      if (wizardState.accountId && staged.length > 0) {
        const fitids = staged.map((t) => t.fitid).filter(Boolean) as string[]
        if (fitids.length > 0) {
          checkFitid.mutateAsync({ accountId: wizardState.accountId, fitids })
            .then((resp) => {
              // resp.exists is a single boolean; for batch checking we mark all if exists
              if (resp.exists) {
                for (const t of txnRef.current) {
                  if (t.fitid) { t.isDuplicate = true; t.excluded = true }
                }
                setRenderTick((tick) => tick + 1)
                onStagedChange([...txnRef.current])
              }
            })
            .catch(() => { /* non-critical */ })
        }
      }
    } catch (err) {
      void message.error('Failed to parse QBO/OFX file')
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

  const includedCount = txnRef.current.filter((t) => !t.excluded).length
  const duplicateCount = txnRef.current.filter((t) => t.isDuplicate).length

  const columns = [
    { title: '', key: 'include', width: 50, render: (_: unknown, record: StagedTransaction) => <Switch size="small" checked={!record.excluded} onChange={() => toggleExclude(record.idx)} /> },
    { title: 'Date', key: 'date', width: 110, render: (_: unknown, record: StagedTransaction) => <Text style={{ fontSize: 12 }}>{record.date}</Text> },
    { title: 'Description', key: 'description', render: (_: unknown, record: StagedTransaction) => <Input size="small" value={record.description} onChange={(e) => updateField(record.idx, 'description', e.target.value)} style={{ fontSize: 12 }} disabled={record.excluded} /> },
    { title: 'Amount', key: 'amount', width: 120, align: 'right' as const, render: (_: unknown, record: StagedTransaction) => <Text style={{ fontFamily: MONEY_FONT, color: record.is_debit === 1 ? COLORS.terracotta : COLORS.sage, fontWeight: 600, fontSize: 12 }}>{record.is_debit === 1 ? '-' : '+'}{formatCurrency(record.amount_cents)}</Text> },
    { title: 'Category', key: 'category', width: 180, render: (_: unknown, record: StagedTransaction) => <Select size="small" value={record.category_id ?? undefined} onChange={(v) => updateField(record.idx, 'category_id', v ?? null)} options={categoryOptions} placeholder="—" allowClear showSearch style={{ width: '100%' }} filterOption={(input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())} disabled={record.excluded} /> },
    { title: 'Payee', key: 'vendor', width: 160, render: (_: unknown, record: StagedTransaction) => <Select size="small" value={record.vendor_id ?? undefined} onChange={(v) => updateField(record.idx, 'vendor_id', v ?? null)} options={vendorOptions} placeholder="—" allowClear showSearch style={{ width: '100%' }} filterOption={(input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())} disabled={record.excluded} /> },
    { title: 'Status', key: 'status', width: 80, render: (_: unknown, record: StagedTransaction) => record.isDuplicate ? <Tag color="orange" style={{ fontSize: 10 }}>Dup</Tag> : null },
  ]

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text strong style={{ color: COLORS.walnut }}>{includedCount} transactions to import</Text>
          {duplicateCount > 0 && <Tag color="orange">{duplicateCount} potential duplicates (by FITID)</Tag>}
        </Space>
        {qboParseResult?.warnings && qboParseResult.warnings.length > 0 && (
          <Tag color="warning" icon={<WarningOutlined />}>{qboParseResult.warnings.length} warnings</Tag>
        )}
      </div>
      <Table dataSource={txnRef.current} columns={columns} rowKey="idx" size="small" pagination={{ pageSize: 50 }}
        rowClassName={(record) => record.excluded ? 'import-row-excluded' : ''} scroll={{ x: 'max-content' }} />
    </Space>
  )
}
