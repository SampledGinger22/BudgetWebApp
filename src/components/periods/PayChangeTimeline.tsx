'use client'

import { useState } from 'react'
import { Button, DatePicker, InputNumber, Input, List, Popconfirm, Space, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { usePayHistory, useAddPayChange, useUpdatePayChange, useDeletePayChange } from '@/lib/api/periods'
import type { PayHistoryEntry } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency, centsToDollars, dollarsToCents } from '@/lib/utils/money'

const { Text } = Typography

interface PayChangeTimelineProps {
  scheduleId: number
}

export function PayChangeTimeline({ scheduleId }: PayChangeTimelineProps): React.JSX.Element {
  const { data: history, isLoading } = usePayHistory(scheduleId)
  const addPayChange = useAddPayChange()
  const updatePayChange = useUpdatePayChange()
  const deletePayChange = useDeletePayChange()

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newDate, setNewDate] = useState<dayjs.Dayjs | null>(null)
  const [newAmount, setNewAmount] = useState<number | null>(null)
  const [newNotes, setNewNotes] = useState('')

  const entries = (history ?? []).sort((a, b) => b.effective_date.localeCompare(a.effective_date))

  const handleAdd = async (): Promise<void> => {
    if (!newDate || !newAmount) return
    try {
      await addPayChange.mutateAsync({
        pay_schedule_id: scheduleId,
        effective_date: newDate.format('YYYY-MM-DD'),
        amount_cents: dollarsToCents(newAmount),
        notes: newNotes || null,
      })
      setAdding(false)
      setNewDate(null)
      setNewAmount(null)
      setNewNotes('')
    } catch { void message.error('Failed to add pay change') }
  }

  const handleUpdate = async (entry: PayHistoryEntry): Promise<void> => {
    if (!newDate || !newAmount) return
    try {
      await updatePayChange.mutateAsync({
        id: entry.id,
        effective_date: newDate.format('YYYY-MM-DD'),
        amount_cents: dollarsToCents(newAmount),
        notes: newNotes || null,
      })
      setEditingId(null)
    } catch { void message.error('Failed to update pay change') }
  }

  const handleDelete = async (id: number): Promise<void> => {
    try { await deletePayChange.mutateAsync({ id }) }
    catch { void message.error('Failed to delete pay change') }
  }

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ color: COLORS.walnut, fontSize: 13 }}>Pay Rate History</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => { setAdding(true); setNewDate(dayjs()); setNewAmount(null); setNewNotes('') }}>Add Change</Button>
      </div>

      {adding && (
        <Space style={{ padding: 8, background: COLORS.creamDark, borderRadius: 6 }}>
          <DatePicker size="small" value={newDate} onChange={setNewDate} style={{ width: 140 }} />
          <InputNumber size="small" prefix="$" precision={2} min={0} value={newAmount} onChange={(v) => setNewAmount(v)} placeholder="Amount" style={{ width: 120 }} />
          <Input size="small" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Notes" style={{ width: 140 }} />
          <Button size="small" type="primary" onClick={() => void handleAdd()} loading={addPayChange.isPending}>Save</Button>
          <Button size="small" onClick={() => setAdding(false)}>Cancel</Button>
        </Space>
      )}

      {isLoading ? <Text type="secondary">Loading...</Text> : entries.length === 0 ? <Text type="secondary">No pay rate changes recorded.</Text> : (
        <List size="small" dataSource={entries} renderItem={(entry) => (
          <List.Item
            actions={[
              <Button key="edit" type="text" size="small" icon={<EditOutlined />} onClick={() => {
                setEditingId(entry.id); setNewDate(dayjs(entry.effective_date))
                setNewAmount(centsToDollars(entry.amount_cents)); setNewNotes(entry.notes ?? '')
              }} />,
              <Popconfirm key="del" title="Delete?" onConfirm={() => void handleDelete(entry.id)}>
                <Button type="text" size="small" icon={<DeleteOutlined />} danger />
              </Popconfirm>,
            ]}
          >
            {editingId === entry.id ? (
              <Space>
                <DatePicker size="small" value={newDate} onChange={setNewDate} style={{ width: 130 }} />
                <InputNumber size="small" prefix="$" precision={2} value={newAmount} onChange={(v) => setNewAmount(v)} style={{ width: 110 }} />
                <Input size="small" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} style={{ width: 120 }} />
                <Button size="small" type="primary" onClick={() => void handleUpdate(entry)}>Save</Button>
                <Button size="small" onClick={() => setEditingId(null)}>Cancel</Button>
              </Space>
            ) : (
              <Space>
                <Text style={{ fontSize: 12 }}>{dayjs(entry.effective_date).format('MMM D, YYYY')}</Text>
                <Text style={{ fontFamily: MONEY_FONT, fontWeight: 600, color: COLORS.sage }}>{formatCurrency(entry.amount_cents)}</Text>
                {entry.notes && <Text type="secondary" style={{ fontSize: 12 }}>{entry.notes}</Text>}
              </Space>
            )}
          </List.Item>
        )} />
      )}
    </Space>
  )
}

export default PayChangeTimeline
