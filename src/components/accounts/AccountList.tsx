'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Empty, Space, Switch, Typography } from 'antd'
import type { Account } from '@/lib/api/types'
import { AccountListItem } from './AccountListItem'

const { Text } = Typography

interface AccountListProps {
  accounts: Account[]
  showArchived: boolean
  onShowArchivedChange: (value: boolean) => void
  onReorder: (ids: number[]) => void
  onEdit: (account: Account) => void
  onArchive: (id: number) => void
  onUnarchive: (id: number) => void
  onDelete: (id: number) => void
  onAddClick: () => void
  lastReconciledDates?: Record<number, string>
}

export function AccountList({
  accounts,
  showArchived,
  onShowArchivedChange,
  onReorder,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onAddClick,
  lastReconciledDates,
}: AccountListProps): React.JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeAccounts = accounts.filter((a) => a.archived_at == null)
  const archivedAccounts = accounts.filter((a) => a.archived_at != null)
  const hasArchived = archivedAccounts.length > 0
  const displayAccounts = showArchived ? accounts : activeAccounts

  if (accounts.length === 0) {
    return (
      <Empty
        description={
          <span style={{ color: '#888', fontSize: 15 }}>
            Add your first account to get started
          </span>
        }
        style={{ padding: '48px 0' }}
      >
        <button
          onClick={onAddClick}
          style={{
            background: '#A95537',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 24px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add Account
        </button>
      </Empty>
    )
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = activeAccounts.findIndex((a) => a.id === active.id)
    const newIndex = activeAccounts.findIndex((a) => a.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(activeAccounts, oldIndex, newIndex)
    onReorder(reordered.map((a) => a.id))
  }

  return (
    <div>
      {hasArchived && (
        <Space style={{ marginBottom: 12 }}>
          <Switch checked={showArchived} onChange={onShowArchivedChange} size="small" />
          <Text style={{ fontSize: 13, color: '#888' }}>Show archived</Text>
        </Space>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeAccounts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          {displayAccounts.map((account) => (
            <AccountListItem
              key={account.id}
              account={account}
              onEdit={onEdit}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
              lastReconciledDate={lastReconciledDates?.[account.id]}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default AccountList
