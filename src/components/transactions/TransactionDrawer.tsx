'use client'

import { Avatar, Button, DatePicker, Drawer, Form, InputNumber, Modal, Select, Segmented, Space } from 'antd'
import { TeamOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { TransactionRow } from '@/lib/api/types'
import { useCategories } from '@/lib/api/categories'
import { useMembers } from '@/lib/api/members'
import { useVendors } from '@/lib/api/vendors'
import { useUpdateTransaction, useDeleteTransaction } from '@/lib/api/transactions'
import { dollarsToCents } from '@/lib/utils/money'

interface TransactionDrawerProps {
  open: boolean
  transaction: TransactionRow | null
  /** Whether the selected sub-period is locked. Determines Delete vs Void behavior. */
  isLocked?: boolean
  onClose: () => void
}

interface DrawerFormValues {
  date: ReturnType<typeof dayjs>
  description: string
  amount: number
  is_debit: boolean
  category_id: number | null
  vendor_id: number | null
  member_id?: number | null
}

/**
 * Slide-out drawer for viewing/editing a single transaction.
 * Uses S06 useUpdateTransaction and useDeleteTransaction hooks.
 * TXNS-04: Voided transactions indicated by void badge.
 */
export function TransactionDrawer({
  open,
  transaction,
  isLocked = false,
  onClose,
}: TransactionDrawerProps): React.JSX.Element {
  const [form] = Form.useForm<DrawerFormValues>()
  const { data: groups = [] } = useCategories()
  const { data: vendors = [] } = useVendors()
  const { data: members = [] } = useMembers()
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()
  const [saving, setSaving] = useState(false)

  const hasMembers = members.filter((m) => m.archived_at == null).length > 0

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

  // Pre-fill form when transaction changes
  useEffect(() => {
    if (transaction) {
      form.setFieldsValue({
        date: dayjs(transaction.date),
        description: transaction.description,
        amount: transaction.amount_cents / 100,
        is_debit: transaction.is_debit === 1,
        category_id: transaction.category_id ?? null,
        vendor_id: transaction.vendor_id ?? null,
        member_id: transaction.member_id ?? null,
      })
    }
  }, [transaction, form])

  const handleSave = async (): Promise<void> => {
    if (!transaction) return
    setSaving(true)
    try {
      const values = await form.validateFields()
      await updateTransaction.mutateAsync({
        id: transaction.id,
        date: values.date.format('YYYY-MM-DD'),
        description: values.description,
        amount_cents: dollarsToCents(values.amount),
        is_debit: values.is_debit ? 1 : 0,
        category_id: values.category_id ?? undefined,
        vendor_id: values.vendor_id ?? undefined,
        member_id: values.member_id ?? null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (): void => {
    if (!transaction) return

    Modal.confirm({
      title: isLocked ? 'Void Transaction' : 'Delete Transaction',
      content: isLocked
        ? 'This period is frozen. The transaction will be voided (hidden but preserved for audit trail).'
        : 'Are you sure? This will permanently delete the transaction.',
      okText: isLocked ? 'Void' : 'Delete',
      okType: 'danger',
      onOk: async () => {
        await deleteTransaction.mutateAsync({ id: transaction.id })
        onClose()
      },
    })
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <Button
        danger
        loading={deleteTransaction.isPending}
        onClick={handleDelete}
        disabled={!transaction}
      >
        {isLocked ? 'Void' : 'Delete'}
      </Button>
      <Space>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="primary" loading={saving} onClick={handleSave}>
          Save Changes
        </Button>
      </Space>
    </div>
  )

  return (
    <Drawer
      title={transaction ? 'Edit Transaction' : 'Transaction'}
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      footer={footer}
      destroyOnHidden={false}
    >
      <Form
        form={form}
        layout="vertical"
        key={transaction?.id ?? 'empty'}
      >
        <Form.Item
          name="date"
          label="Date"
          rules={[{ required: true, message: 'Date is required' }]}
        >
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
          rules={[{ required: true, message: 'Description is required' }]}
        >
          <input
            className="ant-input"
            placeholder="Transaction description"
            style={{
              width: '100%',
              padding: '4px 11px',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              fontSize: 14,
              outline: 'none',
              background: 'transparent',
            }}
          />
        </Form.Item>

        <Form.Item
          name="amount"
          label="Amount"
          rules={[{ required: true, message: 'Amount is required' }]}
        >
          <InputNumber
            prefix="$"
            precision={2}
            min={0.01}
            placeholder="0.00"
            style={{ width: '100%' }}
          />
        </Form.Item>

        {/* UX-04: "Expense"/"Income" not "Debit"/"Credit" */}
        <Form.Item name="is_debit" label="Type">
          <Segmented<boolean>
            options={[
              { label: 'Expense (money out)', value: true },
              { label: 'Income (money in)', value: false },
            ]}
          />
        </Form.Item>

        <Form.Item name="category_id" label="Category">
          <Select
            placeholder="Select category"
            showSearch
            allowClear
            options={categoryOptions}
            filterOption={(input, option) =>
              (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item name="vendor_id" label="Payee">
          <Select
            placeholder="Select payee"
            showSearch
            allowClear
            options={vendorOptions}
            filterOption={(input, option) =>
              (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        {hasMembers && (
          <Form.Item
            name="member_id"
            label={
              <span>
                <TeamOutlined style={{ marginRight: 6 }} />
                Household Member
              </span>
            }
          >
            <Select
              placeholder="No member (optional)"
              allowClear
              options={memberOptions.map((opt) => ({
                value: opt.value,
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar
                      size={18}
                      style={{ backgroundColor: opt.color ?? '#aaa', color: '#fff', fontSize: 9, fontWeight: 700 }}
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
      </Form>
    </Drawer>
  )
}
