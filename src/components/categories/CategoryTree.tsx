'use client'

import { useState } from 'react'
import { Button, Collapse, Dropdown, Space, Tag, Tooltip, Typography } from 'antd'
import {
  PlusOutlined,
  DownOutlined,
  EditOutlined,
  DeleteOutlined,
  InboxOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Category, CategoryGroup, CategoryWithSubs } from '@/lib/api/types'
import { COLORS } from '@/theme'
import { CategoryModal } from './CategoryModal'

const { Text } = Typography

interface CategoryTreeProps {
  groups: CategoryGroup[]
  showArchived: boolean
  onCreateCategory: (data: {
    category_group_id: number
    parent_id: number | null
    name: string
    ref_number: string | null
  }) => Promise<void>
  onUpdateCategory: (id: number, data: { name: string; ref_number: string | null }) => Promise<void>
  onArchiveCategory: (id: number) => Promise<void>
  onUnarchiveCategory: (id: number) => Promise<void>
  onDeleteCategory: (id: number) => Promise<void>
  onReorderCategories: (scopeId: number, ids: number[]) => Promise<void>
}

// ─── Sortable Category Item ────────────────────────────────────────────────────

interface SortableCategoryItemProps {
  category: CategoryWithSubs | Category
  indent: number
  showArchived: boolean
  onEdit: (cat: Category) => void
  onAddSub: (cat: Category) => void
  onArchive: (id: number) => void
  onUnarchive: (id: number) => void
  onDelete: (id: number) => void
}

function SortableCategoryItem({
  category,
  indent,
  showArchived,
  onEdit,
  onAddSub,
  onArchive,
  onUnarchive,
  onDelete,
}: SortableCategoryItemProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })

  const [expanded, setExpanded] = useState(true)
  const [hovered, setHovered] = useState(false)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : category.archived_at ? 0.55 : 1,
  }

  const menuItems = [
    { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => onEdit(category) },
    { key: 'add-sub', icon: <PlusOutlined />, label: 'Add Sub-category', onClick: () => onAddSub(category), disabled: category.parent_id !== null },
    category.archived_at
      ? { key: 'unarchive', icon: <UndoOutlined />, label: 'Unarchive', onClick: () => onUnarchive(category.id) }
      : { key: 'archive', icon: <InboxOutlined />, label: 'Archive', onClick: () => onArchive(category.id) },
    { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true as const, onClick: () => onDelete(category.id) },
  ]

  const subCategories = 'sub_categories' in category ? category.sub_categories : []
  const hasSubCategories = subCategories.length > 0
  const visibleSubCats = showArchived ? subCategories : subCategories.filter((s) => !s.archived_at)

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 4,
          backgroundColor: isDragging ? COLORS.creamDark : hovered ? 'rgba(169, 85, 55, 0.06)' : 'transparent',
          marginLeft: indent * 20, position: 'relative', transition: 'background-color 0.15s ease',
        }}
      >
        {indent > 0 && <div style={{ position: 'absolute', left: -14, top: 0, bottom: 0, width: 1, backgroundColor: '#d9d9d9' }} />}
        {indent > 0 && <div style={{ position: 'absolute', left: -14, top: '50%', width: 14, height: 1, backgroundColor: '#d9d9d9' }} />}

        <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#bbb', fontSize: 16, lineHeight: 1, padding: '0 2px', userSelect: 'none' }} title="Drag to reorder">
          ⠿
        </div>

        {hasSubCategories && indent === 0 ? (
          <Button type="text" size="small" icon={<DownOutlined rotate={expanded ? 0 : -90} style={{ fontSize: 10, transition: 'transform 0.15s' }} />} onClick={() => setExpanded(!expanded)} style={{ padding: '0 4px', minWidth: 0 }} />
        ) : (
          <div style={{ width: 24 }} />
        )}

        <Text style={{ flex: 1, fontSize: 13, color: category.archived_at ? '#aaa' : COLORS.walnut, textDecoration: category.archived_at ? 'line-through' : 'none' }}>
          {category.name}
        </Text>

        {category.archived_at && <Tag color="default" style={{ fontSize: 11 }}>Archived</Tag>}
        {category.ref_number && <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>#{category.ref_number}</Text>}

        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <Button type="text" size="small" style={{ padding: '0 6px', color: '#999' }}>•••</Button>
        </Dropdown>
      </div>

      {hasSubCategories && expanded && visibleSubCats.length > 0 && (
        <div style={{ marginLeft: (indent + 1) * 20, position: 'relative' }}>
          {visibleSubCats.map((sub) => (
            <SortableCategoryItem key={sub.id} category={sub} indent={0} showArchived={showArchived} onEdit={onEdit} onAddSub={onAddSub} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Group Section ─────────────────────────────────────────────────────────────

interface GroupSectionProps {
  group: CategoryGroup
  showArchived: boolean
  onAddCategory: (groupId: number) => void
  onEdit: (cat: Category) => void
  onAddSub: (cat: Category) => void
  onArchive: (id: number) => void
  onUnarchive: (id: number) => void
  onDelete: (id: number) => void
  onReorder: (scopeId: number, ids: number[]) => Promise<void>
}

function GroupSection({
  group, showArchived, onAddCategory, onEdit, onAddSub, onArchive, onUnarchive, onDelete, onReorder,
}: GroupSectionProps): React.JSX.Element {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const visibleCategories = showArchived ? group.categories : group.categories.filter((c) => !c.archived_at)

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = visibleCategories.findIndex((c) => c.id === active.id)
    const newIndex = visibleCategories.findIndex((c) => c.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(visibleCategories, oldIndex, newIndex)
    await onReorder(group.id, reordered.map((c) => c.id))
  }

  const categoryCount = group.categories.filter((c) => !c.archived_at).length

  return (
    <Collapse defaultActiveKey={[group.id]} items={[{
      key: group.id,
      label: (
        <Space>
          {group.color && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: group.color, display: 'inline-block' }} />}
          <Text strong style={{ color: COLORS.walnut }}>{group.name}</Text>
          <Tag color="default" style={{ fontSize: 11 }}>{categoryCount}</Tag>
        </Space>
      ),
      children: (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {visibleCategories.map((cat) => (
                <SortableCategoryItem key={cat.id} category={cat} indent={0} showArchived={showArchived} onEdit={onEdit} onAddSub={onAddSub} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={onDelete} />
              ))}
            </SortableContext>
          </DndContext>
          <Button type="dashed" icon={<PlusOutlined />} size="small" onClick={() => onAddCategory(group.id)} style={{ marginTop: 8, color: COLORS.terracotta, borderColor: COLORS.terracotta }}>
            Add Category
          </Button>
        </>
      ),
    }]} />
  )
}

// ─── CategoryTree Root ─────────────────────────────────────────────────────────

export function CategoryTree({
  groups, showArchived, onCreateCategory, onUpdateCategory, onArchiveCategory, onUnarchiveCategory, onDeleteCategory, onReorderCategories,
}: CategoryTreeProps): React.JSX.Element {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [parentForNewSub, setParentForNewSub] = useState<Category | null>(null)
  const [addToGroupId, setAddToGroupId] = useState<number | null>(null)

  const handleAddCategory = (groupId: number) => {
    setEditingCategory(null)
    setParentForNewSub(null)
    setAddToGroupId(groupId)
    setModalOpen(true)
  }

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat)
    setParentForNewSub(null)
    setAddToGroupId(null)
    setModalOpen(true)
  }

  const handleAddSub = (parent: Category) => {
    setEditingCategory(null)
    setParentForNewSub(parent)
    setAddToGroupId(null)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingCategory(null)
    setParentForNewSub(null)
    setAddToGroupId(null)
  }

  const modalGroupId = addToGroupId ?? editingCategory?.category_group_id ?? parentForNewSub?.category_group_id
  const enrichedGroups = modalGroupId
    ? [groups.find((g) => g.id === modalGroupId) ?? groups[0], ...groups.filter((g) => g.id !== modalGroupId)]
    : groups

  return (
    <div>
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {groups.map((group) => (
          <GroupSection key={group.id} group={group} showArchived={showArchived} onAddCategory={handleAddCategory} onEdit={handleEdit} onAddSub={handleAddSub} onArchive={onArchiveCategory} onUnarchive={onUnarchiveCategory} onDelete={onDeleteCategory} onReorder={onReorderCategories} />
        ))}
      </Space>

      <CategoryModal open={modalOpen} onClose={handleModalClose} onSuccess={() => {}} editCategory={editingCategory} groups={enrichedGroups} parentCategory={parentForNewSub} onCreateCategory={onCreateCategory} onUpdateCategory={onUpdateCategory} />

      <Tooltip title={<Text style={{ color: '#fff', fontSize: 12 }}>Drag the <strong>⠿</strong> handle to reorder categories within a group.</Text>} placement="bottom">
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>Drag to reorder within group</Text>
      </Tooltip>
    </div>
  )
}

export default CategoryTree
