'use client'

import { Form, Input, InputNumber, Select, DatePicker, Button, Radio, Space, Typography } from 'antd'
import dayjs from 'dayjs'
import { COLORS } from '@/theme'

const { Text } = Typography

type ScheduleType = 'specific_dates' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

const DAY_OF_WEEK_OPTIONS = [
  { label: 'Sunday', value: 0 }, { label: 'Monday', value: 1 }, { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 }, { label: 'Thursday', value: 4 }, { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
]

interface AddScheduleFormProps {
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}

interface AddScheduleFormValues {
  name: string
  schedule_type: ScheduleType
  day_of_month_1: number | null
  day_of_month_2: number | null
  day_of_week: number | null
  anchor_date: dayjs.Dayjs | null
}

export function AddScheduleForm({ onSubmit, onCancel }: AddScheduleFormProps): React.JSX.Element {
  const [form] = Form.useForm<AddScheduleFormValues>()
  const scheduleType = Form.useWatch('schedule_type', form)

  const handleOk = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      await onSubmit({
        name: values.name,
        schedule_type: values.schedule_type,
        day_of_month_1: values.day_of_month_1 ?? null,
        day_of_month_2: values.day_of_month_2 ?? null,
        day_of_week: values.day_of_week ?? null,
        anchor_date: values.anchor_date ? values.anchor_date.format('YYYY-MM-DD') : null,
      })
      form.resetFields()
    } catch { /* validation */ }
  }

  return (
    <Form form={form} layout="vertical">
      <Form.Item label="Schedule Name" name="name" rules={[{ required: true, message: 'Please enter a name' }]}>
        <Input placeholder="e.g. Primary, Spouse" />
      </Form.Item>
      <Form.Item label="Frequency" name="schedule_type" initialValue="semimonthly">
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
          <Form.Item label="First Pay Day" name="day_of_month_1" rules={[{ required: true }]}>
            <InputNumber min={1} max={31} placeholder="e.g. 1" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item label="Second Pay Day" name="day_of_month_2" rules={[{ required: true }]}>
            <InputNumber min={1} max={31} placeholder="e.g. 15" style={{ width: 120 }} />
          </Form.Item>
        </Space>
      )}
      {scheduleType === 'monthly' && (
        <Form.Item label="Pay Day" name="day_of_month_1" rules={[{ required: true }]}>
          <InputNumber min={1} max={31} placeholder="e.g. 1" style={{ width: 120 }} />
        </Form.Item>
      )}
      {(scheduleType === 'weekly' || scheduleType === 'biweekly') && (
        <Space size={16}>
          <Form.Item label="Day of Week" name="day_of_week" rules={[{ required: true }]}>
            <Select options={DAY_OF_WEEK_OPTIONS} placeholder="Select day" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item label="Anchor Date" name="anchor_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: 160 }} />
          </Form.Item>
        </Space>
      )}
      <Form.Item style={{ marginBottom: 0 }}>
        <Space>
          <Button type="primary" onClick={() => void handleOk()} style={{ backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta }}>Create Schedule</Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

export default AddScheduleForm
