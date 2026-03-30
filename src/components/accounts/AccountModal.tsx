'use client'

import {
  BankOutlined,
  CreditCardOutlined,
  DollarOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { DatePicker, Divider, Form, InputNumber, Modal, Select, Space, Tooltip } from 'antd'
import dayjs from 'dayjs'
import type { Account } from '@/lib/api/types'
import { COLORS } from '@/theme'
import { dollarsToCents } from '@/lib/utils/money'

type AccountType = Account['type']

interface CreateAccountPayload {
  name: string
  type: AccountType
  opening_balance_cents?: number
  balance_cents?: number
  as_of_date?: string | null
  credit_limit_cents?: number | null
  interest_rate_basis_points?: number | null
  minimum_payment_cents?: number | null
  statement_date?: number | null
  interest_date?: number | null
}

interface AccountModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (data: CreateAccountPayload) => void | Promise<void>
  editAccount?: Account | null
}

interface AccountFormValues {
  name: string
  type: AccountType
  balance: number
  as_of_date: ReturnType<typeof dayjs> | null
  credit_limit?: number | null
  interest_rate?: number | null
  minimum_payment?: number | null
  statement_date?: number | null
  interest_date?: number | null
}

function TooltipLabel({ label, tooltip }: { label: string; tooltip: string }): React.JSX.Element {
  return (
    <Space size={4}>
      {label}
      <Tooltip title={tooltip}>
        <QuestionCircleOutlined style={{ color: COLORS.copper, cursor: 'help' }} />
      </Tooltip>
    </Space>
  )
}

export function AccountModal({ open, onClose, onSuccess, editAccount }: AccountModalProps): React.JSX.Element {
  const [form] = Form.useForm<AccountFormValues>()

  const handleOk = async (): Promise<void> => {
    const values = await form.validateFields()
    const balanceCents = dollarsToCents(values.balance ?? 0)

    const data: CreateAccountPayload = {
      name: values.name,
      type: values.type,
      opening_balance_cents: balanceCents,
      as_of_date: values.as_of_date ? values.as_of_date.format('YYYY-MM-DD') : null,
      credit_limit_cents: values.credit_limit != null ? dollarsToCents(values.credit_limit) : null,
      interest_rate_basis_points: values.interest_rate != null ? Math.round(values.interest_rate * 100) : null,
      minimum_payment_cents: values.minimum_payment != null ? dollarsToCents(values.minimum_payment) : null,
      statement_date: values.statement_date ?? null,
      interest_date: values.interest_date ?? null,
    }

    onSuccess(data)
  }

  const handleCancel = (): void => {
    form.resetFields()
    onClose()
  }

  const afterClose = (): void => {
    form.resetFields()
  }

  const initialValues: Partial<AccountFormValues> = editAccount
    ? {
        name: editAccount.name,
        type: editAccount.type,
        balance: editAccount.opening_balance_cents / 100,
        as_of_date: editAccount.as_of_date ? dayjs(editAccount.as_of_date) : null,
        credit_limit: editAccount.credit_limit_cents != null ? editAccount.credit_limit_cents / 100 : null,
        interest_rate: editAccount.interest_rate_basis_points != null ? editAccount.interest_rate_basis_points / 100 : null,
        minimum_payment: editAccount.minimum_payment_cents != null ? editAccount.minimum_payment_cents / 100 : null,
        statement_date: editAccount.statement_date ?? undefined,
        interest_date: editAccount.interest_date ?? undefined,
      }
    : { type: 'checking' as const, balance: 0 }

  return (
    <Modal
      title={editAccount ? 'Edit Account' : 'Add Account'}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      afterClose={afterClose}
      okText={editAccount ? 'Save Changes' : 'Add Account'}
      destroyOnHidden={false}
      width={520}
    >
      <Form form={form} layout="vertical" initialValues={initialValues} key={editAccount?.id ?? 'new'}>
        <Divider orientationMargin={0} style={{ marginTop: 8, marginBottom: 16 }}>Basic Info</Divider>

        <Form.Item name="name" label="Account Name" rules={[{ required: true, message: 'Account name is required' }]}>
          <input
            className="ant-input"
            placeholder="e.g., Chase Checking"
            style={{ width: '100%', padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, outline: 'none', background: 'transparent' }}
          />
        </Form.Item>

        <Form.Item name="type" label="Account Type" rules={[{ required: true, message: 'Account type is required' }]}>
          <Select
            options={[
              { value: 'checking', label: <Space><BankOutlined /> Checking</Space> },
              { value: 'savings', label: <Space><SaveOutlined /> Savings</Space> },
              { value: 'credit', label: <Space><CreditCardOutlined /> Credit Card</Space> },
              { value: 'student_loan', label: <Space><FileTextOutlined /> Student Loan</Space> },
              { value: 'standard_loan', label: <Space><DollarOutlined /> Standard Loan</Space> },
            ]}
          />
        </Form.Item>

        <Form.Item name="balance" label="Starting Balance" rules={[{ required: true, message: 'Starting balance is required' }]}>
          <InputNumber style={{ width: '100%' }} prefix="$" precision={2} min={0} placeholder="0.00" />
        </Form.Item>

        <Form.Item
          name="as_of_date"
          label={<TooltipLabel label="As-of Date" tooltip="The date your starting balance is accurate as of. Used to reconcile future transactions." />}
          rules={[{ required: true, message: 'As-of date is required' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Divider orientationMargin={0} style={{ marginTop: 16, marginBottom: 16 }}>Credit Card / Loan Details</Divider>

        <Form.Item name="credit_limit" label="Credit Limit (Optional - Credit Cards)">
          <InputNumber style={{ width: '100%' }} prefix="$" precision={2} min={0} placeholder="0.00" />
        </Form.Item>

        <Form.Item
          name="interest_rate"
          label={<TooltipLabel label="Interest Rate (Optional - Loans)" tooltip="The annual percentage rate (APR) charged on your loan balance." />}
        >
          <InputNumber style={{ width: '100%' }} suffix="%" precision={2} min={0} max={100} placeholder="0.00" />
        </Form.Item>

        <Form.Item name="minimum_payment" label="Minimum Payment (Optional - Loans)">
          <InputNumber style={{ width: '100%' }} prefix="$" precision={2} min={0} placeholder="0.00" />
        </Form.Item>

        <Form.Item
          name="statement_date"
          label={<TooltipLabel label="Statement Date (Optional)" tooltip="The day of the month your statement closes." />}
        >
          <InputNumber style={{ width: '100%' }} min={1} max={31} precision={0} placeholder="e.g., 15" />
        </Form.Item>

        <Form.Item
          name="interest_date"
          label={<TooltipLabel label="Interest Date (Optional)" tooltip="The day of the month interest is calculated and charged to your account." />}
        >
          <InputNumber style={{ width: '100%' }} min={1} max={31} precision={0} placeholder="e.g., 20" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default AccountModal
