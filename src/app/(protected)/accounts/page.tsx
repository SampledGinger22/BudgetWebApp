'use client'

import { useMemo, useState } from 'react'
import { PlusOutlined } from '@ant-design/icons'
import { Button, Space, Spin, Typography, message } from 'antd'
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useArchiveAccount,
  useUnarchiveAccount,
  useDeleteAccount,
  useReorderAccounts,
} from '@/lib/api/accounts'
import { useLastReconciledDates } from '@/lib/api/reconciliation'
import type { Account } from '@/lib/api/types'
import { AccountList } from '@/components/accounts/AccountList'
import { AccountModal } from '@/components/accounts/AccountModal'
import { AccountSummaryCards } from '@/components/accounts/AccountSummaryCards'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { COLORS } from '@/theme'

const { Title } = Typography

export default function AccountsPage(): React.JSX.Element {
  const [showArchived, setShowArchived] = useState(false)
  const { data: accounts = [], isLoading } = useAccounts({ includeArchived: showArchived })
  const { data: reconDates = [] } = useLastReconciledDates()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const archiveAccount = useArchiveAccount()
  const unarchiveAccount = useUnarchiveAccount()
  const deleteAccount = useDeleteAccount()
  const reorderAccounts = useReorderAccounts()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  // Build a lookup map from reconDates array
  const lastReconciledDates = useMemo(() => {
    const map: Record<number, string> = {}
    for (const entry of reconDates) {
      map[entry.account_id] = entry.last_statement_date
    }
    return map
  }, [reconDates])

  const handleAddClick = (): void => {
    setEditingAccount(null)
    setModalOpen(true)
  }

  const handleEdit = (account: Account): void => {
    setEditingAccount(account)
    setModalOpen(true)
  }

  const handleModalClose = (): void => {
    setModalOpen(false)
    setEditingAccount(null)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleModalSuccess = async (data: any): Promise<void> => {
    try {
      if (editingAccount) {
        await updateAccount.mutateAsync({ id: editingAccount.id, ...data })
        message.success('Account updated')
      } else {
        await createAccount.mutateAsync(data)
        message.success('Account created')
      }
      setModalOpen(false)
      setEditingAccount(null)
    } catch {
      message.error('Failed to save account')
    }
  }

  const handleArchive = async (id: number): Promise<void> => {
    try {
      await archiveAccount.mutateAsync({ id })
      message.success('Account archived')
    } catch {
      message.error('Failed to archive account')
    }
  }

  const handleUnarchive = async (id: number): Promise<void> => {
    try {
      await unarchiveAccount.mutateAsync({ id })
      message.success('Account unarchived')
    } catch {
      message.error('Failed to unarchive account')
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    try {
      await deleteAccount.mutateAsync({ id })
      message.success('Account deleted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account'
      message.error(msg)
    }
  }

  const handleReorder = async (ids: number[]): Promise<void> => {
    try {
      await reorderAccounts.mutateAsync({ ids })
    } catch {
      message.error('Failed to reorder accounts')
    }
  }

  const handleShowArchivedChange = (value: boolean): void => {
    setShowArchived(value)
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  const activeAccounts = accounts.filter((a) => a.archived_at == null)
  const hasAccounts = accounts.length > 0

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0, color: COLORS.walnut }}>Accounts</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick} loading={isLoading}>
          Add Account
        </Button>
      </div>

      <ErrorBoundary label="Accounts">
        {hasAccounts && activeAccounts.length > 0 && (
          <AccountSummaryCards accounts={accounts} />
        )}
        <AccountList
          accounts={accounts}
          showArchived={showArchived}
          onShowArchivedChange={handleShowArchivedChange}
          onReorder={handleReorder}
          onEdit={handleEdit}
          onArchive={handleArchive}
          onUnarchive={handleUnarchive}
          onDelete={handleDelete}
          onAddClick={handleAddClick}
          lastReconciledDates={lastReconciledDates}
        />
      </ErrorBoundary>

      <AccountModal
        open={modalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        editAccount={editingAccount}
      />
    </Space>
  )
}
