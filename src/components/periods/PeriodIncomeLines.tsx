'use client'

import { useState } from 'react'
import { Button, InputNumber, Input, Select, Space, Typography, message, Popconfirm } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useAddIncomeLine, useUpdateIncomeLine, useDeleteIncomeLine } from '@/lib/api/periods'
import { useCategories } from '@/lib/api/categories'
import type { PeriodIncomeLine } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency, centsToDollars, dollarsToCents } from '@/lib/utils/money'

const { Text } = Typography

interface PeriodIncomeLinesProps {
  subPeriodId: number
  incomeLines: PeriodIncomeLine[]
}

export function PeriodIncomeLines({ subPeriodId, incomeLines }: PeriodIncomeLinesProps): React.JSX.Element {
  const addIncomeLine = useAddIncomeLine()
  const updateIncomeLine = useUpdateIncomeLine()
  const deleteIncomeLine = useDeleteIncomeLine()
  const { data: categories = [] } = useCategories()

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [expectedDollars, setExpectedDollars] = useState<number | null>(null)
  const [actualDollars, setActualDollars] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)

  const categoryOptions = categories.flatMap((g) =>
    g.categories.filter((c) => !c.archived_at).map((c) => ({ value: c.id, label: `${g.name} / ${c.name}` })),
  )

  const handleAdd = async (): Promise<void> => {
    if (!label.trim()) return
    try {
      await addIncomeLine.mutateAsync({
        budget_sub_period_id: subPeriodId,
        label,
        expected_cents: expectedDollars != null ? dollarsToCents(expectedDollars) : 0,
        actual_cents: actualDollars != null ? dollarsToCents(actualDollars) : null,
        category_id: categoryId,
      })
      setAdding(false); setLabel(''); setExpectedDollars(null); setActualDollars(null); setCategoryId(null)
    } catch { void message.error('Failed to add income line') }
  }

  const handleUpdate = async (line: PeriodIncomeLine): Promise<void> => {
    try {
      await updateIncomeLine.mutateAsync({
        id: line.id, label,
        expected_cents: expectedDollars != null ? dollarsToCents(expectedDollars) : undefined,
        actual_cents: actualDollars != null ? dollarsToCents(actualDollars) : null,
        category_id: categoryId,
      })
      setEditingId(null)
    } catch { void message.error('Failed to update income line') }
  }

  const handleDelete = async (id: number): Promise<void> => {
    try { await deleteIncomeLine.mutateAsync({ id }) }
    catch { void message.error('Failed to delete income line') }
  }

  const totalExpected = incomeLines.reduce((sum, l) => sum + l.expected_cents, 0)
  const totalActual = incomeLines.reduce((sum, l) => sum + (l.actual_cents ?? 0), 0)

  return (
    <Space orientation="vertical" size={6} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: COLORS.walnut, fontWeight: 600 }}>Income Lines</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => { setAdding(true); setLabel(''); setExpectedDollars(null); setActualDollars(null); setCategoryId(null) }}>Add</Button>
      </div>
      {incomeLines.map((line) => (
        <div key={line.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(92, 61, 30, 0.06)' }}>
          {editingId === line.id ? (
            <Space>
              <Input size="small" value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: 120 }} />
              <InputNumber size="small" prefix="$" precision={2} value={expectedDollars} onChange={(v) => setExpectedDollars(v)} style={{ width: 100 }} placeholder="Expected" />
              <InputNumber size="small" prefix="$" precision={2} value={actualDollars} onChange={(v) => setActualDollars(v)} style={{ width: 100 }} placeholder="Actual" />
              <Button size="small" type="primary" onClick={() => void handleUpdate(line)}>Save</Button>
              <Button size="small" onClick={() => setEditingId(null)}>Cancel</Button>
            </Space>
          ) : (
            <>
              <Text style={{ flex: 1, fontSize: 12 }}>{line.label}</Text>
              <Text style={{ fontFamily: MONEY_FONT, fontSize: 12, color: COLORS.walnut }}>{formatCurrency(line.expected_cents)}</Text>
              {line.actual_cents != null && (
                <Text style={{ fontFamily: MONEY_FONT, fontSize: 12, color: COLORS.sage }}>{formatCurrency(line.actual_cents)}</Text>
              )}
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => {
                setEditingId(line.id); setLabel(line.label)
                setExpectedDollars(centsToDollars(line.expected_cents))
                setActualDollars(line.actual_cents != null ? centsToDollars(line.actual_cents) : null)
                setCategoryId(line.category_id)
              }} />
              <Popconfirm title="Delete?" onConfirm={() => void handleDelete(line.id)}>
                <Button type="text" size="small" icon={<DeleteOutlined />} danger />
              </Popconfirm>
            </>
          )}
        </div>
      ))}
      {adding && (
        <Space style={{ padding: 6, background: COLORS.creamDark, borderRadius: 4 }}>
          <Input size="small" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" style={{ width: 120 }} />
          <InputNumber size="small" prefix="$" precision={2} value={expectedDollars} onChange={(v) => setExpectedDollars(v)} placeholder="Expected" style={{ width: 100 }} />
          <Button size="small" type="primary" onClick={() => void handleAdd()} loading={addIncomeLine.isPending}>Add</Button>
          <Button size="small" onClick={() => setAdding(false)}>Cancel</Button>
        </Space>
      )}
      {incomeLines.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, paddingTop: 4 }}>
          <Text style={{ fontFamily: MONEY_FONT, fontSize: 11, color: COLORS.walnut }}>Expected: {formatCurrency(totalExpected)}</Text>
          <Text style={{ fontFamily: MONEY_FONT, fontSize: 11, color: COLORS.sage }}>Actual: {formatCurrency(totalActual)}</Text>
        </div>
      )}
    </Space>
  )
}

export default PeriodIncomeLines
