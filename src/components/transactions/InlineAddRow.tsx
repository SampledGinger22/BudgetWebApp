'use client'

import { PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { Avatar, Button, DatePicker, Form, InputNumber, Select, Segmented, Space } from 'antd'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import { useCategories } from '@/lib/api/categories'
import { useMembers } from '@/lib/api/members'
import { useVendors } from '@/lib/api/vendors'
import { useCreateTransaction } from '@/lib/api/transactions'
import { dollarsToCents } from '@/lib/utils/money'

interface InlineAddRowProps {
  accountId: number
  periodId: number | null
}

interface InlineFormValues {
  date: ReturnType<typeof dayjs>
  description: string
  amount: number
  is_debit: boolean
  category_id: number
  vendor_id: number
  member_id?: number | null
}

/**
 * Inline form row for quick transaction creation.
 * UX-04: Toggle uses "Expense"/"Income" (not "Debit"/"Credit").
 */
export function InlineAddRow({ accountId, periodId }: InlineAddRowProps): React.JSX.Element {
  const [form] = Form.useForm<InlineFormValues>()
  const { data: groups = [] } = useCategories()
  const { data: vendors = [] } = useVendors()
  const { data: members = [] } = useMembers()
  const createTransaction = useCreateTransaction()

  const hasMembers = members.filter((m) => m.archived_at == null).length > 0

  // Flatten categories for select options
  const categoryOptions = groups.flatMap((g) =>
    g.categories
      .filter((c) => c.archived_at == null)
      .map((c) => ({ value: c.id, label: `${g.name} / ${c.name}` })),
  )

  const vendorOptions = vendors
    .filter((v) => v.archived_at == null)
    .map((v) => ({ value: v.id, label: v.name }))

  const memberOptions = members
    .filter((m) => m.archived_at == null)
    .map((m) => ({
      value: m.id,
      label: m.name,
      color: m.color,
      initials: m.initials,
    }))

  // Reset form when account or period changes
  useEffect(() => {
    form.resetFields()
    form.setFieldsValue({ date: dayjs(), is_debit: true })
  }, [accountId, periodId, form])

  const handleSubmit = async (): Promise<void> => {
    const values = await form.validateFields()
    await createTransaction.mutateAsync({
      account_id: accountId,
      date: values.date.format('YYYY-MM-DD'),
      description: values.description,
      amount_cents: dollarsToCents(values.amount),
      is_debit: values.is_debit ? 1 : 0,
      category_id: values.category_id,
      vendor_id: values.vendor_id,
      member_id: values.member_id ?? null,
    })
    // Reset for next entry — keep date as today and type
    form.resetFields()
    form.setFieldsValue({ date: dayjs(), is_debit: true })
  }

  return (
    <Form
      form={form}
      layout="inline"
      initialValues={{ date: dayjs(), is_debit: true }}
      onFinish={handleSubmit}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 12px',
        background: '#fafafa',
        borderRadius: 6,
        border: '1px solid #e8e8e8',
        flexWrap: 'wrap',
      }}
    >
      <Form.Item
        name="date"
        rules={[{ required: true, message: 'Date required' }]}
        style={{ marginBottom: 0 }}
      >
        <DatePicker
          format="YYYY-MM-DD"
          style={{ width: 130 }}
          placeholder="Date"
        />
      </Form.Item>

      <Form.Item
        name="description"
        rules={[{ required: true, message: 'Description required' }]}
        style={{ marginBottom: 0, flex: 1, minWidth: 150 }}
      >
        <input
          className="ant-input"
          placeholder="Description"
          style={{
            width: '100%',
            padding: '4px 11px',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            fontSize: 14,
            outline: 'none',
            background: 'transparent',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleSubmit()
            }
          }}
        />
      </Form.Item>

      <Form.Item
        name="amount"
        rules={[{ required: true, message: 'Amount required' }]}
        style={{ marginBottom: 0 }}
      >
        <InputNumber
          prefix="$"
          precision={2}
          min={0.01}
          placeholder="0.00"
          style={{ width: 120 }}
        />
      </Form.Item>

      {/* UX-04: "Expense"/"Income" not "Debit"/"Credit" */}
      <Form.Item name="is_debit" style={{ marginBottom: 0 }}>
        <Segmented<boolean>
          options={[
            { label: 'Expense', value: true },
            { label: 'Income', value: false },
          ]}
        />
      </Form.Item>

      <Form.Item
        name="category_id"
        rules={[{ required: true, message: 'Category required' }]}
        style={{ marginBottom: 0 }}
      >
        <Select
          style={{ minWidth: 180 }}
          placeholder="Category"
          showSearch
          options={categoryOptions}
          filterOption={(input, option) =>
            (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase())
          }
        />
      </Form.Item>

      <Form.Item
        name="vendor_id"
        rules={[{ required: true, message: 'Payee required' }]}
        style={{ marginBottom: 0 }}
      >
        <Select
          style={{ minWidth: 160 }}
          placeholder="Payee"
          showSearch
          options={vendorOptions}
          filterOption={(input, option) =>
            (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase())
          }
        />
      </Form.Item>

      {hasMembers && (
        <Form.Item name="member_id" style={{ marginBottom: 0 }}>
          <Select
            style={{ minWidth: 140 }}
            placeholder={
              <span>
                <TeamOutlined style={{ marginRight: 6 }} />
                Member
              </span>
            }
            allowClear
            options={memberOptions.map((opt) => ({
              value: opt.value,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Avatar
                    size={16}
                    style={{ backgroundColor: opt.color ?? '#aaa', color: '#fff', fontSize: 8, fontWeight: 700 }}
                  >
                    {opt.initials}
                  </Avatar>
                  {opt.label}
                </span>
              ),
            }))}
          />
        </Form.Item>
      )}

      <Form.Item style={{ marginBottom: 0 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            htmlType="submit"
            loading={createTransaction.isPending}
          >
            Add
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
