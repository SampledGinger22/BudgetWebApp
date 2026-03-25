'use client'

import { useState } from 'react'
import {
  Avatar,
  Button,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  InboxOutlined,
  PlusOutlined,
  UndoOutlined,
} from '@ant-design/icons'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { HouseholdMember } from '@/lib/api/types'
import {
  useMembers,
  useCreateMember,
  useUpdateMember,
  useArchiveMember,
  useUnarchiveMember,
  useDeleteMember,
  useReorderMembers,
} from '@/lib/api/members'
import { COLORS } from '@/theme'

const { Title, Text } = Typography

const MEMBER_COLORS = [
  '#A95537', '#567559', '#986028', '#5C7A9E',
  '#8B6BA8', '#6B8E6B', '#A0726A', '#4A7A8A',
]

function ColorSwatchPicker({ value, onChange }: { value: string; onChange: (color: string) => void }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {MEMBER_COLORS.map((color) => (
        <div
          key={color}
          onClick={() => onChange(color)}
          style={{
            width: 28, height: 28, borderRadius: '50%', background: color, cursor: 'pointer',
            border: value === color ? '3px solid #333' : '2px solid transparent', boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  )
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Sortable member row ──────────────────────────────────────────────────────

function SortableMemberRow({
  member, onEdit, onArchive, onUnarchive, onDelete,
}: {
  member: HouseholdMember
  onEdit: (member: HouseholdMember) => void
  onArchive: (id: number) => void
  onUnarchive: (id: number) => void
  onDelete: (id: number) => void
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: member.id,
    disabled: member.archived_at != null,
  })
  const isArchived = member.archived_at != null
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : isArchived ? 0.6 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
        background: isArchived ? COLORS.creamDark : COLORS.cream, border: `1px solid ${COLORS.creamDark}`,
        borderRadius: 6, marginBottom: 6, fontStyle: isArchived ? 'italic' : 'normal',
      }}
    >
      {!isArchived ? (
        <span {...attributes} {...listeners} style={{ cursor: isDragging ? 'grabbing' : 'grab', color: '#bbb', fontSize: 16, flexShrink: 0, touchAction: 'none' }}>
          <HolderOutlined />
        </span>
      ) : (
        <span style={{ width: 16, flexShrink: 0 }} />
      )}

      <Avatar size={36} style={{ backgroundColor: member.color ?? MEMBER_COLORS[0], color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
        {member.initials}
      </Avatar>

      <Text style={{ flex: 1, color: isArchived ? '#999' : COLORS.walnut, fontWeight: 500 }}>
        {member.name}
        {isArchived && <span style={{ marginLeft: 8, fontSize: 12, color: COLORS.copper }}>(Archived)</span>}
      </Text>

      <Space size={4}>
        {!isArchived && <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(member)} style={{ color: COLORS.walnut }} />}
        {!isArchived && <Button type="text" size="small" icon={<InboxOutlined />} onClick={() => onArchive(member.id)} style={{ color: '#888' }} title="Archive member" />}
        {isArchived && <Button type="text" size="small" icon={<UndoOutlined />} onClick={() => onUnarchive(member.id)} style={{ color: COLORS.sage }} title="Unarchive member" />}
        <Popconfirm title="Delete this member?" description="This cannot be undone. Members with transactions cannot be deleted." onConfirm={() => onDelete(member.id)} okText="Delete" okButtonProps={{ danger: true }} cancelText="Cancel">
          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      </Space>
    </div>
  )
}

// ─── Edit member modal ────────────────────────────────────────────────────────

function EditMemberModal({ member, open, onClose, onSave }: {
  member: HouseholdMember | null
  open: boolean
  onClose: () => void
  onSave: (id: number, name: string, initials: string, color: string) => Promise<void>
}): React.JSX.Element {
  const [name, setName] = useState(member?.name ?? '')
  const [initials, setInitials] = useState(member?.initials ?? '')
  const [color, setColor] = useState(member?.color ?? MEMBER_COLORS[0])
  const [saving, setSaving] = useState(false)

  const handleOpen = (): void => {
    if (member) {
      setName(member.name)
      setInitials(member.initials)
      setColor(member.color ?? MEMBER_COLORS[0])
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!member) return
    if (!name.trim()) { void message.warning('Name is required'); return }
    if (!initials.trim()) { void message.warning('Initials are required'); return }
    setSaving(true)
    try {
      await onSave(member.id, name.trim(), initials.trim().toUpperCase().slice(0, 2), color)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update member'
      void message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Edit Household Member"
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      okText="Save"
      okButtonProps={{ loading: saving, style: { backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta } }}
      afterOpenChange={(isOpen) => { if (isOpen) handleOpen() }}
      destroyOnClose
    >
      <Space direction="vertical" size={14} style={{ width: '100%', marginTop: 12 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: COLORS.walnut }}>Name</label>
          <Input value={name} onChange={(e) => { setName(e.target.value); setInitials(deriveInitials(e.target.value)) }} placeholder="e.g. Mason" autoFocus />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: COLORS.walnut }}>Initials (max 2 characters)</label>
          <Input value={initials} onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 2))} placeholder="e.g. M" maxLength={2} style={{ width: 80 }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: COLORS.walnut }}>Color</label>
          <ColorSwatchPicker value={color} onChange={setColor} />
          <div style={{ marginTop: 10 }}>
            <Avatar size={36} style={{ backgroundColor: color, color: '#fff', fontWeight: 700 }}>{initials || '?'}</Avatar>
            <Text style={{ marginLeft: 10, color: '#888', fontSize: 13 }}>Preview</Text>
          </div>
        </div>
      </Space>
    </Modal>
  )
}

// ─── MembersPage ──────────────────────────────────────────────────────────────

export default function MembersPage(): React.JSX.Element {
  const { data: members = [], isLoading } = useMembers()
  const createMember = useCreateMember()
  const updateMember = useUpdateMember()
  const archiveMember = useArchiveMember()
  const unarchiveMember = useUnarchiveMember()
  const deleteMember = useDeleteMember()
  const reorderMembers = useReorderMembers()

  const [showArchived, setShowArchived] = useState(false)
  const [addName, setAddName] = useState('')
  const [addInitials, setAddInitials] = useState('')
  const [addColor, setAddColor] = useState(MEMBER_COLORS[0])
  const [adding, setAdding] = useState(false)
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)

  const activeMembers = members.filter((m) => m.archived_at == null)
  const archivedMembers = members.filter((m) => m.archived_at != null)
  const hasArchived = archivedMembers.length > 0
  const displayMembers = showArchived ? members : activeMembers

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleAddMember = async (): Promise<void> => {
    if (!addName.trim()) { void message.warning('Name is required'); return }
    const initials = addInitials.trim() || deriveInitials(addName)
    setAdding(true)
    try {
      await createMember.mutateAsync({
        name: addName.trim(),
        initials: initials.toUpperCase().slice(0, 2),
        color: addColor,
      })
      setAddName('')
      setAddInitials('')
      setAddColor(MEMBER_COLORS[0])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add member'
      void message.error(msg)
    } finally {
      setAdding(false)
    }
  }

  const handleEditSave = async (id: number, name: string, initials: string, color: string): Promise<void> => {
    await updateMember.mutateAsync({ id, name, initials, color })
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = activeMembers.findIndex((m) => m.id === active.id)
    const newIndex = activeMembers.findIndex((m) => m.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(activeMembers, oldIndex, newIndex)
    void reorderMembers.mutateAsync({ ids: reordered.map((m) => m.id) })
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: COLORS.walnut }}>Household Members</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Add family members to tag transactions by person. Leave empty if tracking as a single household.
          </Text>
        </div>
        {hasArchived && (
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>Show archived</Text>
            <Switch size="small" checked={showArchived} onChange={setShowArchived} />
          </Space>
        )}
      </div>

      {/* Add member form */}
      <div style={{ padding: '14px 16px', background: COLORS.creamDark, borderRadius: 8, border: '1px solid #ddd' }}>
        <Text strong style={{ display: 'block', marginBottom: 12, color: COLORS.walnut }}>Add New Member</Text>
        <Space wrap align="end">
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Name</label>
            <Input value={addName} onChange={(e) => { setAddName(e.target.value); setAddInitials(deriveInitials(e.target.value)) }} placeholder="e.g. Mason" style={{ width: 160 }} onPressEnter={handleAddMember} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Initials</label>
            <Input value={addInitials} onChange={(e) => setAddInitials(e.target.value.toUpperCase().slice(0, 2))} placeholder="M" maxLength={2} style={{ width: 60 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Color</label>
            <ColorSwatchPicker value={addColor} onChange={setAddColor} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Preview</label>
            <Avatar size={32} style={{ backgroundColor: addColor, color: '#fff', fontWeight: 700 }}>
              {addInitials || (addName ? deriveInitials(addName) : '?')}
            </Avatar>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddMember} loading={adding} style={{ backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta }}>
            Add
          </Button>
        </Space>
      </div>

      {/* Member list */}
      {displayMembers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#aaa' }}>
          <Text type="secondary">No household members yet. Add one above.</Text>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={activeMembers.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {displayMembers.map((member) => (
              <SortableMemberRow
                key={member.id}
                member={member}
                onEdit={(m) => { setEditingMember(m); setEditModalOpen(true) }}
                onArchive={(id) => void archiveMember.mutateAsync({ id })}
                onUnarchive={(id) => void unarchiveMember.mutateAsync({ id })}
                onDelete={(id) => void deleteMember.mutateAsync({ id })}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      <EditMemberModal
        member={editingMember}
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingMember(null) }}
        onSave={handleEditSave}
      />
    </Space>
  )
}
