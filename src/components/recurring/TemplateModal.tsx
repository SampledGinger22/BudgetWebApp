'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Button, Checkbox, DatePicker, Divider, Form, InputNumber,
  Modal, Select, Space, Tag, Typography,
} from 'antd'
import { CalendarOutlined, PlusOutlined } from '@ant-design/icons'
import { Segmented } from 'antd'
import dayjs from 'dayjs'
import type { RecurringTemplate } from '@/lib/api/types'
import { useAccounts } from '@/lib/api/accounts'
import { useCategories } from '@/lib/api/categories'
import { useVendors } from '@/lib/api/vendors'
import { useMembers } from '@/lib/api/members'
import { COLORS } from '@/theme'
import { centsToDollars, dollarsToCents } from '@/lib/utils/money'

const { Text } = Typography

type RecurringType = 'bill' | 'income' | 'subscription' | 'credit_payment' | 'transfer' | 'investment'

const TYPE_OPTIONS: { value: RecurringType; label: string }[] = [
  { value: 'bill', label: 'Bills' },
  { value: 'income', label: 'Income' },
  { value: 'subscription', label: 'Subscriptions' },
  { value: 'credit_payment', label: 'Credit Payments' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'investment', label: 'Investments / Savings' },
]

const MONTH_DAY_OPTIONS = [
  ...Array.from({ length: 31 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}${['th', 'st', 'nd', 'rd'][((i + 1) % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][(i + 1) % 100] ?? 'th'}`,
  })),
  { value: 32, label: 'Last day of month' },
]

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

// ─── Date preview computation ─────────────────────────────────────────────────

function computeNextOccurrences(
  frequency: 'monthly' | 'weekly', intervalN: number, dayValues: number[],
  startDate: string | null, count: number,
): string[] {
  if (dayValues.length === 0 || intervalN < 1) return []
  const results: string[] = []
  const today = dayjs()
  const fromDate = startDate ? dayjs(startDate) : today

  if (frequency === 'monthly') {
    let currentMonth = fromDate.startOf('month')
    let iterations = 0
    while (results.length < count && iterations < 24) {
      for (const dayVal of dayValues.sort((a, b) => a - b)) {
        const daysInMonth = currentMonth.daysInMonth()
        const actualDay = dayVal === 32 ? daysInMonth : Math.min(dayVal, daysInMonth)
        const candidate = currentMonth.date(actualDay)
        if (candidate.isAfter(today, 'day') || candidate.isSame(today, 'day')) {
          results.push(candidate.format('MMM D, YYYY'))
          if (results.length >= count) break
        }
      }
      currentMonth = currentMonth.add(intervalN, 'month')
      iterations++
    }
  } else {
    let cursor = fromDate
    let iterations = 0
    while (results.length < count && iterations < 52) {
      for (const weekday of dayValues.sort((a, b) => a - b)) {
        const daysUntil = (weekday - cursor.day() + 7) % 7
        const candidate = cursor.add(daysUntil, 'day')
        if (candidate.isAfter(today, 'day') || candidate.isSame(today, 'day')) {
          results.push(candidate.format('MMM D, YYYY'))
          if (results.length >= count) break
        }
      }
      cursor = cursor.add(intervalN, 'week')
      iterations++
    }
  }
  return results.slice(0, count)
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateRecurringInput {
  name: string
  vendor_id: number | null
  amount_cents: number
  is_debit: number
  category_id: number | null
  account_id: number
  member_id: number | null
  type?: 'bill' | 'income' | 'subscription' | 'credit_payment' | 'transfer' | 'investment'
  frequency?: 'monthly' | 'weekly'
  interval_n?: number
  day_values: number[]
  start_date?: string | null
  end_date?: string | null
  auto_confirm?: number
  notes?: string | null
}

interface TemplateModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: CreateRecurringInput) => Promise<void>
  editTemplate?: RecurringTemplate
  prefillData?: Partial<RecurringTemplate>
  historyPanel?: React.ReactNode
}

interface TemplateFormValues {
  name: string
  type: RecurringType
  is_debit: boolean
  amount: number
  account_id: number
  category_id?: number | null
  vendor_id?: number | null
  member_id?: number | null
  frequency: 'monthly' | 'weekly'
  interval_n: number
  start_date?: ReturnType<typeof dayjs> | null
  end_date?: ReturnType<typeof dayjs> | null
  auto_confirm: boolean
  notes?: string
}

export function TemplateModal({ open, onClose, onSave, editTemplate, prefillData, historyPanel }: TemplateModalProps): React.JSX.Element {
  const [form] = Form.useForm<TemplateFormValues>()
  const [saving, setSaving] = useState(false)
  const [dayValues, setDayValues] = useState<number[]>([])
  const [selectedDayToAdd, setSelectedDayToAdd] = useState<number | null>(null)

  // Data from S06 TanStack Query hooks
  const { data: accounts = [] } = useAccounts()
  const { data: categoryGroups = [] } = useCategories()
  const { data: vendors = [] } = useVendors()
  const { data: members = [] } = useMembers()

  const frequency = Form.useWatch('frequency', form) ?? 'monthly'
  const intervalN = Form.useWatch('interval_n', form) ?? 1
  const startDate = Form.useWatch('start_date', form)

  // Pre-fill form when editing or creating from prefillData
  useEffect(() => {
    if (open && editTemplate) {
      form.setFieldsValue({
        name: editTemplate.name,
        type: editTemplate.type as RecurringType,
        is_debit: editTemplate.is_debit === 1,
        amount: centsToDollars(editTemplate.amount_cents),
        account_id: editTemplate.account_id ?? undefined,
        category_id: editTemplate.category_id ?? null,
        vendor_id: editTemplate.vendor_id ?? null,
        member_id: editTemplate.member_id ?? null,
        frequency: editTemplate.frequency as 'monthly' | 'weekly',
        interval_n: editTemplate.interval_n,
        start_date: editTemplate.start_date ? dayjs(editTemplate.start_date) : null,
        end_date: editTemplate.end_date ? dayjs(editTemplate.end_date) : null,
        auto_confirm: editTemplate.auto_confirm === 1,
        notes: editTemplate.notes ?? undefined,
      })
      setDayValues(editTemplate.template_dates.map((d) => d.day_value))
    } else if (open && !editTemplate && prefillData) {
      form.setFieldsValue({
        name: prefillData.name ?? undefined,
        type: (prefillData.type as RecurringType) ?? undefined,
        is_debit: prefillData.is_debit != null ? prefillData.is_debit === 1 : true,
        amount: prefillData.amount_cents != null ? centsToDollars(prefillData.amount_cents) : undefined,
        account_id: prefillData.account_id !== 0 ? (prefillData.account_id ?? undefined) : undefined,
        category_id: prefillData.category_id ?? null,
        vendor_id: prefillData.vendor_id ?? null,
        member_id: prefillData.member_id ?? null,
        frequency: (prefillData.frequency as 'monthly' | 'weekly') ?? 'monthly',
        interval_n: prefillData.interval_n ?? 1,
        auto_confirm: false,
      })
      setDayValues(prefillData.template_dates?.map((d) => d.day_value) ?? [])
    } else if (open && !editTemplate) {
      form.setFieldsValue({ is_debit: true, frequency: 'monthly', interval_n: 1, auto_confirm: false })
      setDayValues([])
    }
  }, [open, editTemplate, prefillData, form])

  const handleAddDayValue = useCallback(() => {
    if (selectedDayToAdd === null) return
    setDayValues((prev) => {
      if (prev.includes(selectedDayToAdd)) return prev
      return [...prev, selectedDayToAdd].sort((a, b) => a - b)
    })
    setSelectedDayToAdd(null)
  }, [selectedDayToAdd])

  const handleRemoveDayValue = useCallback((val: number) => {
    setDayValues((prev) => prev.filter((d) => d !== val))
  }, [])

  const handleOk = async (): Promise<void> => {
    setSaving(true)
    try {
      const values = await form.validateFields()
      if (dayValues.length === 0) {
        void Modal.error({ title: 'Schedule Required', content: 'Please add at least one schedule date before saving.' })
        return
      }
      const uniqueValues = [...new Set(dayValues)]
      const data: CreateRecurringInput = {
        name: values.name,
        vendor_id: values.vendor_id ?? null,
        amount_cents: dollarsToCents(values.amount),
        is_debit: values.is_debit ? 1 : 0,
        category_id: values.category_id ?? null,
        account_id: values.account_id,
        member_id: values.member_id ?? null,
        type: values.type,
        frequency: values.frequency,
        interval_n: values.interval_n,
        day_values: uniqueValues,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
        auto_confirm: values.auto_confirm ? 1 : 0,
        notes: values.notes ?? null,
      }
      await onSave(data)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = (): void => {
    form.resetFields()
    setDayValues([])
    setSelectedDayToAdd(null)
    onClose()
  }

  const afterClose = (): void => {
    form.resetFields()
    setDayValues([])
    setSelectedDayToAdd(null)
  }

  const accountOptions = accounts
    .filter((a) => a.archived_at == null)
    .map((a) => ({ value: a.id, label: `${a.name} (${a.type})` }))

  const categoryOptions = categoryGroups.flatMap((g) =>
    g.categories
      .filter((c) => c.archived_at == null)
      .flatMap((c) => {
        const parent = [{ value: c.id, label: `${g.name} / ${c.name}` }]
        const subs = (c.sub_categories ?? [])
          .filter((sc) => sc.archived_at == null)
          .map((sc) => ({ value: sc.id, label: `${g.name} / ${c.name} / ${sc.name}` }))
        return [...parent, ...subs]
      }),
  )

  const vendorOptions = vendors
    .filter((v) => v.archived_at == null)
    .map((v) => ({ value: v.id, label: v.name }))

  const memberOptions = members
    .filter((m) => m.archived_at == null)
    .map((m) => ({ value: m.id, label: m.name }))

  const hasMembers = memberOptions.length > 0
  const dayOptions = frequency === 'weekly' ? WEEKDAY_OPTIONS : MONTH_DAY_OPTIONS

  function formatDayTag(val: number): string {
    if (frequency === 'weekly') return WEEKDAY_OPTIONS.find((o) => o.value === val)?.label ?? `Day ${val}`
    return MONTH_DAY_OPTIONS.find((o) => o.value === val)?.label ?? `${val}`
  }

  const startDateStr = startDate ? startDate.format('YYYY-MM-DD') : null
  const previewDates = computeNextOccurrences(frequency as 'monthly' | 'weekly', intervalN ?? 1, dayValues, startDateStr, 3)

  return (
    <Modal
      title={editTemplate ? 'Edit Recurring Template' : 'Add Recurring Template'}
      open={open} onOk={() => void handleOk()} onCancel={handleCancel} afterClose={afterClose}
      okText={editTemplate ? 'Save Changes' : 'Create Template'}
      confirmLoading={saving} width={600} destroyOnHidden={false}
    >
      <Form form={form} layout="vertical" key={editTemplate?.id ?? 'new'}>
        <Divider orientationMargin={0} style={{ marginTop: 8, marginBottom: 16 }}>Template Info</Divider>
        <Form.Item name="name" label="Name / Description" rules={[{ required: true, message: 'Name is required' }]}>
          <input className="ant-input" placeholder="e.g., Netflix Subscription" style={{ width: '100%', padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, outline: 'none', background: 'transparent' }} />
        </Form.Item>
        <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Type is required' }]}>
          <Select options={TYPE_OPTIONS} placeholder="Select type" />
        </Form.Item>
        <Space align="start" style={{ width: '100%' }}>
          <Form.Item name="is_debit" label="Direction">
            <Segmented<boolean> options={[{ label: 'Expense (out)', value: true }, { label: 'Income (in)', value: false }]} />
          </Form.Item>
          <Form.Item name="amount" label="Amount" rules={[{ required: true, message: 'Amount is required' }]} style={{ flex: 1 }}>
            <InputNumber prefix="$" precision={2} min={0.01} placeholder="0.00" style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item name="account_id" label="Account" rules={[{ required: true, message: 'Account is required' }]}>
          <Select options={accountOptions} placeholder="Select account" showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
        </Form.Item>
        <Form.Item name="category_id" label="Category">
          <Select options={categoryOptions} placeholder="Select category (optional)" showSearch allowClear filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
        </Form.Item>
        <Form.Item name="vendor_id" label="Vendor / Payee">
          <Select options={vendorOptions} placeholder="Select vendor (optional)" showSearch allowClear filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
        </Form.Item>
        {hasMembers && (
          <Form.Item name="member_id" label="Household Member">
            <Select options={memberOptions} placeholder="No member (optional)" allowClear />
          </Form.Item>
        )}
        <Divider orientationMargin={0} style={{ marginTop: 4, marginBottom: 16 }}>Schedule</Divider>
        <Space align="start">
          <Form.Item name="frequency" label="Frequency" rules={[{ required: true, message: 'Frequency is required' }]}>
            <Select options={[{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'Weekly' }]} style={{ width: 140 }} onChange={() => { setDayValues([]); setSelectedDayToAdd(null) }} />
          </Form.Item>
          <Form.Item name="interval_n" label={frequency === 'weekly' ? 'Every N weeks' : 'Every N months'} rules={[{ required: true, message: 'Interval is required' }]}>
            <InputNumber min={1} max={24} precision={0} style={{ width: 100 }} />
          </Form.Item>
        </Space>
        <Form.Item label={frequency === 'weekly' ? 'Days of week' : 'Days of month'}>
          <div style={{ marginBottom: 8 }}>
            {dayValues.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>No dates added. Click &ldquo;Add date&rdquo; to set when this recurs.</Text>
            ) : (
              <Space wrap>
                {dayValues.sort((a, b) => a - b).map((val) => (
                  <Tag key={val} closable onClose={() => handleRemoveDayValue(val)} color="blue" style={{ margin: 2 }}>
                    {formatDayTag(val)}
                  </Tag>
                ))}
              </Space>
            )}
          </div>
          <Space>
            <Select value={selectedDayToAdd} onChange={setSelectedDayToAdd} options={dayOptions.filter((o) => !dayValues.includes(o.value))} placeholder={frequency === 'weekly' ? 'Select weekday' : 'Select day'} style={{ width: 180 }} showSearch />
            <Button icon={<PlusOutlined />} onClick={handleAddDayValue} disabled={selectedDayToAdd === null} size="small">Add date</Button>
          </Space>
        </Form.Item>
        {previewDates.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: COLORS.creamDark, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
            <CalendarOutlined style={{ color: COLORS.terracotta }} />
            <Text style={{ color: COLORS.walnut }}><strong>Upcoming:</strong> {previewDates.join(', ')}</Text>
          </div>
        )}
        <Space align="start">
          <Form.Item name="start_date" label="Start Date">
            <DatePicker placeholder="Active immediately" style={{ width: 180 }} format="YYYY-MM-DD" allowClear />
          </Form.Item>
          <Form.Item name="end_date" label="End Date">
            <DatePicker placeholder="Runs indefinitely" style={{ width: 180 }} format="YYYY-MM-DD" allowClear />
          </Form.Item>
        </Space>
        <Divider orientationMargin={0} style={{ marginTop: 4, marginBottom: 16 }}>Options</Divider>
        <Form.Item name="auto_confirm" valuePropName="checked">
          <Checkbox>Auto-confirm entries for this template (fixed amount)</Checkbox>
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <textarea className="ant-input" placeholder="Optional notes about this recurring transaction..." rows={3} style={{ width: '100%', padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, outline: 'none', background: 'transparent', resize: 'vertical', fontFamily: 'inherit' }} />
        </Form.Item>
      </Form>
      {historyPanel}
    </Modal>
  )
}

export default TemplateModal
