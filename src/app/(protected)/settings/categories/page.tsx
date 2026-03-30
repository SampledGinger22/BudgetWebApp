'use client'

import { useState } from 'react'
import { Button, Modal, Space, Spin, Switch, Tooltip, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import {
  useCategories,
  useCreateCategoryGroup,
  useCreateCategory,
  useUpdateCategory,
  useArchiveCategory,
  useUnarchiveCategory,
  useDeleteCategory,
  useReorderCategories,
} from '@/lib/api/categories'
import { CategoryTree } from '@/components/categories/CategoryTree'
import { TemplatePicker } from '@/components/categories/TemplatePicker'
import { COLORS } from '@/theme'

const { Title, Text } = Typography

function AddGroupModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (name: string) => Promise<void>
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleOk = async () => {
    if (!name.trim()) {
      void message.warning('Please enter a group name')
      return
    }
    setSubmitting(true)
    try {
      await onAdd(name.trim())
      setName('')
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create group'
      void message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Add Category Group"
      open={open}
      onOk={handleOk}
      onCancel={() => { setName(''); onClose() }}
      okText="Add Group"
      okButtonProps={{ loading: submitting, style: { backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta } }}
      destroyOnHidden
    >
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 8, color: COLORS.walnut, fontWeight: 500 }}>Group Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Investments"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') void handleOk() }}
          style={{ width: '100%', border: '1px solid #d9d9d9', borderRadius: 6, padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', background: COLORS.cream, outline: 'none' }}
        />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          You can have up to 2 custom groups in addition to Income, Expense, and Savings/Goals.
        </Text>
      </div>
    </Modal>
  )
}

export default function CategoriesPage(): React.JSX.Element {
  const { data: groups = [], isLoading } = useCategories()
  const createGroup = useCreateCategoryGroup()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const archiveCategory = useArchiveCategory()
  const unarchiveCategory = useUnarchiveCategory()
  const deleteCategory = useDeleteCategory()
  const reorderCategories = useReorderCategories()

  const [showArchived, setShowArchived] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [addGroupModalOpen, setAddGroupModalOpen] = useState(false)

  const totalCategories = groups.reduce((sum, g) => sum + g.categories.length, 0)
  const hasCategories = totalCategories > 0
  const shouldShowTemplatePicker = !hasCategories && !isLoading && !showTemplatePicker
  const hasArchivedCategories = groups.some((g) =>
    g.categories.some((c) => c.archived_at || (c.sub_categories ?? []).some((s) => s.archived_at)),
  )
  const totalGroups = groups.length
  const maxGroupsReached = totalGroups >= 5

  const handleTemplateApply = async () => {
    setShowTemplatePicker(false)
  }

  const handleTemplateSkip = () => {
    setShowTemplatePicker(false)
  }

  const handleAddGroup = async (name: string) => {
    await createGroup.mutateAsync({ name, color: undefined })
  }

  const handleCreateCategory = async (data: {
    category_group_id: number
    parent_id: number | null
    name: string
    ref_number: string | null
  }) => {
    await createCategory.mutateAsync({
      ...data,
      ref_number: data.ref_number ?? undefined,
    })
  }

  const handleUpdateCategory = async (id: number, data: { name: string; ref_number: string | null }) => {
    await updateCategory.mutateAsync({ id, name: data.name, ref_number: data.ref_number ?? undefined })
  }

  const handleArchiveCategory = async (id: number) => {
    await archiveCategory.mutateAsync({ id })
  }

  const handleUnarchiveCategory = async (id: number) => {
    await unarchiveCategory.mutateAsync({ id })
  }

  const handleDeleteCategory = async (id: number) => {
    await deleteCategory.mutateAsync({ id })
  }

  const handleReorderCategories = async (scopeId: number, ids: number[]) => {
    await reorderCategories.mutateAsync({ groupId: scopeId, ids })
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (shouldShowTemplatePicker) {
    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Title level={4} style={{ margin: 0, color: COLORS.walnut }}>Categories</Title>
        <TemplatePicker groups={groups} onApply={handleTemplateApply} onSkip={handleTemplateSkip} />
      </Space>
    )
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0, color: COLORS.walnut }}>Categories</Title>
        <Space>
          {hasArchivedCategories && (
            <Space>
              <Text type="secondary" style={{ fontSize: 13 }}>Show archived</Text>
              <Switch size="small" checked={showArchived} onChange={setShowArchived} />
            </Space>
          )}
          <Tooltip title={maxGroupsReached ? 'Maximum 5 groups reached' : undefined}>
            <Button
              icon={<PlusOutlined />}
              disabled={maxGroupsReached}
              onClick={() => setAddGroupModalOpen(true)}
              style={!maxGroupsReached ? { borderColor: COLORS.sage, color: COLORS.sage } : {}}
            >
              Add Group
            </Button>
          </Tooltip>
        </Space>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
          <Text type="secondary">No category groups found. Reload the app to seed system groups.</Text>
        </div>
      ) : (
        <CategoryTree
          groups={groups}
          showArchived={showArchived}
          onCreateCategory={handleCreateCategory}
          onUpdateCategory={handleUpdateCategory}
          onArchiveCategory={handleArchiveCategory}
          onUnarchiveCategory={handleUnarchiveCategory}
          onDeleteCategory={handleDeleteCategory}
          onReorderCategories={handleReorderCategories}
        />
      )}

      <AddGroupModal open={addGroupModalOpen} onClose={() => setAddGroupModalOpen(false)} onAdd={handleAddGroup} />
    </Space>
  )
}
