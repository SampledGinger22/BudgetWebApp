'use client'

import { useState } from 'react'
import {
  Form, Input, InputNumber, Select, DatePicker, Button, Radio,
  Space, Tag, Typography, Divider, message, Popconfirm,
} from 'antd'
import dayjs from 'dayjs'
import type { PaySchedule } from '@/lib/api/types'
import { useUpdateSchedule, useDeleteSchedule, useSetPrimarySchedule, usePayHistory, useAddPayChange, useUpdatePayChange, useDeletePayChange } from '@/lib/api/periods'
import { PayChangeTimeline } from './PayChangeTimeline'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency, centsToDollars, dollarsToCents } from '@/lib/utils/money'

const { Text } = Typography

type ScheduleType = 'specific_dates' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

function getStatusInfo(endDate: string | null): { label: string; color: string } {
  if (!endDate) return { label: 'Active', color: 'green' }
  const end = dayjs(endDate)
  const now = dayjs()
  if (end.isBefore(now, 'day')) return { label: 'Ended', color: 'default' }
  if (end.diff(now, 'day') <= 30) return { label: 'Ending Soon', color: 'gold' }
  return { label: 'Active', color: 'green' }
}

const DAY_OF_WEEK_OPTIONS = [
  { label: 'Sunday', value: 0 }, { label: 'Monday', value: 1 }, { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 }, { label: 'Thursday', value: 4 }, { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
]

const FREQUENCY_LABELS: Record<string, string> = {
  specific_dates: 'Semi-monthly', semimonthly: 'Semi-monthly', monthly: 'Monthly',
  biweekly: 'Bi-weekly', weekly: 'Weekly',
}

interface PayScheduleCardProps {
  schedule: PaySchedule
  isPrimary: boolean
  onSave: (id: number, data: Record<string, unknown>) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onSetPrimary: (id: number) => Promise<void>
}

interface CardFormValues {
  name: string
  schedule_type: ScheduleType
  day_of_month_1: number | null
  day_of_month_2: number | null
  day_of_week: number | null
  anchor_date: dayjs.Dayjs | null
  amount_display: number | null
  end_date: dayjs.Dayjs | null
}

export function scheduleCollapseHeader(schedule: PaySchedule, isPrimary: boolean): React.ReactNode {
  const status = getStatusInfo(schedule.end_date)
  return (
    <Space>
      <Text strong style={{ color: COLORS.walnut }}>{schedule.name}</Text>
      <Tag color="blue">{FREQUENCY_LABELS[schedule.schedule_type] ?? schedule.schedule_type}</Tag>
      <Tag color={status.color}>{status.label}</Tag>
      {isPrimary && <Tag color="gold">Primary</Tag>}
      {schedule.amount_cents != null && (
        <Text style={{ fontFamily: MONEY_FONT, color: COLORS.sage, fontSize: 13 }}>{formatCurrency(schedule.amount_cents)}/period</Text>
      )}
    </Space>
  )
}

export function PayScheduleCard({ schedule, isPrimary, onSave, onDelete, onSetPrimary }: PayScheduleCardProps): React.JSX.Element {
  const [form] = Form.useForm<CardFormValues>()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const scheduleType = Form.useWatch('schedule_type', form)

  const startEditing = (): void => {
    form.setFieldsValue({
      name: schedule.name,
      schedule_type: schedule.schedule_type as ScheduleType,
      day_of_month_1: schedule.day_of_month_1,
      day_of_month_2: schedule.day_of_month_2,
      day_of_week: schedule.day_of_week,
      anchor_date: schedule.anchor_date ? dayjs(schedule.anchor_date) : null,
      amount_display: schedule.amount_cents != null ? centsToDollars(schedule.amount_cents) : null,
      end_date: schedule.end_date ? dayjs(schedule.end_date) : null,
    })
    setEditing(true)
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const values = await form.validateFields()
      await onSave(schedule.id, {
        name: values.name,
        schedule_type: values.schedule_type,
        day_of_month_1: values.day_of_month_1 ?? null,
        day_of_month_2: values.day_of_month_2 ?? null,
        day_of_week: values.day_of_week ?? null,
        anchor_date: values.anchor_date ? values.anchor_date.format('YYYY-MM-DD') : null,
        amount_cents: values.amount_display != null ? dollarsToCents(values.amount_display) : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
      })
      setEditing(false)
    } catch { /* validation */ } finally { setSaving(false) }
  }

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {editing ? (
        <Form form={form} layout="vertical" style={{ maxWidth: 500 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="schedule_type" label="Frequency">
            <Radio.Group>
              <Space orientation="vertical">
                <Radio value="semimonthly">Semi-monthly</Radio>
                <Radio value="monthly">Monthly</Radio>
                <Radio value="biweekly">Bi-weekly</Radio>
                <Radio value="weekly">Weekly</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
          {(scheduleType === 'semimonthly' || scheduleType === 'specific_dates') && (
            <Space size={16}>
              <Form.Item name="day_of_month_1" label="First Pay Day" rules={[{ required: true }]}>
                <InputNumber min={1} max={31} style={{ width: 120 }} />
              </Form.Item>
              <Form.Item name="day_of_month_2" label="Second Pay Day" rules={[{ required: true }]}>
                <InputNumber min={1} max={31} style={{ width: 120 }} />
              </Form.Item>
            </Space>
          )}
          {scheduleType === 'monthly' && (
            <Form.Item name="day_of_month_1" label="Pay Day" rules={[{ required: true }]}>
              <InputNumber min={1} max={31} style={{ width: 120 }} />
            </Form.Item>
          )}
          {(scheduleType === 'weekly' || scheduleType === 'biweekly') && (
            <Space size={16}>
              <Form.Item name="day_of_week" label="Pay Day" rules={[{ required: true }]}>
                <Select options={DAY_OF_WEEK_OPTIONS} style={{ width: 150 }} />
              </Form.Item>
              <Form.Item name="anchor_date" label="Anchor Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: 160 }} />
              </Form.Item>
            </Space>
          )}
          <Form.Item name="amount_display" label="Pay Amount (per period)">
            <InputNumber prefix="$" precision={2} min={0} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="end_date" label="End Date">
            <DatePicker placeholder="No end date" allowClear style={{ width: 180 }} />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={() => void handleSave()} loading={saving}>Save</Button>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
          </Space>
        </Form>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" onClick={startEditing}>Edit</Button>
            {!isPrimary && <Button size="small" onClick={() => void onSetPrimary(schedule.id)}>Set as Primary</Button>}
            <Popconfirm title="Delete this schedule?" onConfirm={() => void onDelete(schedule.id)}>
              <Button size="small" danger>Delete</Button>
            </Popconfirm>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 400 }}>
            <Text type="secondary">Frequency:</Text><Text>{FREQUENCY_LABELS[schedule.schedule_type]}</Text>
            {schedule.amount_cents != null && (<><Text type="secondary">Amount:</Text><Text style={{ fontFamily: MONEY_FONT }}>{formatCurrency(schedule.amount_cents)}</Text></>)}
            {schedule.end_date && (<><Text type="secondary">Ends:</Text><Text>{dayjs(schedule.end_date).format('MMM D, YYYY')}</Text></>)}
          </div>
        </>
      )}

      <Divider style={{ margin: '8px 0' }} />
      <PayChangeTimeline scheduleId={schedule.id} />
    </Space>
  )
}

export default PayScheduleCard
