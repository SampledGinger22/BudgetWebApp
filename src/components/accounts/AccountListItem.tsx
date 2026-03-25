'use client'

import {
  BankOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  FileTextOutlined,
  HolderOutlined,
  InboxOutlined,
  SaveOutlined,
  UndoOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Card, Dropdown, Typography } from 'antd'
import type { Account } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

const { Text } = Typography

type AccountType = Account['type']

export const ACCOUNT_TYPE_ICONS: Record<AccountType, React.ReactNode> = {
  checking: <BankOutlined />,
  savings: <SaveOutlined />,
  credit: <CreditCardOutlined />,
  student_loan: <FileTextOutlined />,
  standard_loan: <DollarOutlined />,
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit Card',
  student_loan: 'Student Loan',
  standard_loan: 'Standard Loan',
}

interface AccountListItemProps {
  account: Account
  onEdit: (account: Account) => void
  onArchive: (id: number) => void
  onUnarchive: (id: number) => void
  onDelete: (id: number) => void
  lastReconciledDate?: string
}

export function AccountListItem({
  account,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  lastReconciledDate,
}: AccountListItemProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
  })

  const isArchived = account.archived_at != null
  const isLoan = account.type === 'student_loan' || account.type === 'standard_loan'
  const hasLimit = account.type === 'credit' && account.credit_limit_cents != null

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isArchived ? 0.5 : 1,
  }

  const menuItems = [
    {
      key: 'edit',
      label: 'Edit',
      icon: <EditOutlined />,
      onClick: () => onEdit(account),
    },
    ...(isArchived
      ? [
          {
            key: 'unarchive',
            label: 'Unarchive',
            icon: <UndoOutlined />,
            onClick: () => onUnarchive(account.id),
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: <DeleteOutlined />,
            danger: true as const,
            onClick: () => onDelete(account.id),
          },
        ]
      : [
          {
            key: 'archive',
            label: 'Archive',
            icon: <InboxOutlined />,
            onClick: () => onArchive(account.id),
          },
        ]),
  ]

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        size="small"
        style={{
          marginBottom: 8,
          borderColor: COLORS.creamDark,
          fontStyle: isArchived ? 'italic' : 'normal',
        }}
        styles={{ body: { padding: '10px 16px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Drag handle */}
          <span
            {...attributes}
            {...listeners}
            style={{ cursor: isDragging ? 'grabbing' : 'grab', color: '#bbb', fontSize: 16, flexShrink: 0, touchAction: 'none' }}
          >
            <HolderOutlined />
          </span>

          {/* Account type icon */}
          <span style={{ color: COLORS.terracotta, fontSize: 18, flexShrink: 0 }}>
            {ACCOUNT_TYPE_ICONS[account.type]}
          </span>

          {/* Account info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text
              strong
              style={{ color: COLORS.walnut, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {account.name}
            </Text>
            <Text style={{ fontSize: 12, color: '#888' }}>
              {ACCOUNT_TYPE_LABELS[account.type]}
              {isArchived && <span style={{ marginLeft: 6, color: COLORS.copper }}>(Archived)</span>}
            </Text>
            {!isArchived && (
              <Text style={{ fontSize: 11, color: '#999', display: 'block' }}>
                {lastReconciledDate
                  ? `Last reconciled: ${dayjs(lastReconciledDate).format('MMM D, YYYY')}`
                  : (
                    <>
                      <WarningOutlined style={{ color: COLORS.copper, marginRight: 4 }} />
                      Never reconciled
                    </>
                  )}
                {lastReconciledDate && dayjs().diff(dayjs(lastReconciledDate), 'day') > 30 && (
                  <WarningOutlined style={{ color: COLORS.copper, marginLeft: 4 }} />
                )}
              </Text>
            )}
          </div>

          {/* Balance section */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <Text
              style={{
                fontFamily: MONEY_FONT,
                fontSize: 16,
                fontWeight: 600,
                color: isLoan || account.type === 'credit' ? COLORS.warmRed : COLORS.sage,
                display: 'block',
              }}
            >
              {formatCurrency(account.balance_cents)}
            </Text>
            {hasLimit && account.credit_limit_cents != null && (
              <Text style={{ fontSize: 11, color: '#888', fontFamily: MONEY_FONT }}>
                Avail: {formatCurrency(account.credit_limit_cents - account.balance_cents)} / Limit:{' '}
                {formatCurrency(account.credit_limit_cents)}
              </Text>
            )}
          </div>

          {/* Actions dropdown */}
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button type="text" size="small" style={{ flexShrink: 0, color: '#888' }} aria-label="Account actions">
              •••
            </Button>
          </Dropdown>
        </div>
      </Card>
    </div>
  )
}

export default AccountListItem
