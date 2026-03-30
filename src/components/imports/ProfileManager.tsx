'use client'

import { useState } from 'react'
import { Button, Input, List, Popconfirm, Space, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useRenameProfile, useDeleteProfile } from '@/lib/api/imports'
import type { ImportProfile } from '@/lib/api/types'
import { COLORS } from '@/theme'
import type { WizardState, ImportMappingConfig } from './types'

const { Text } = Typography

interface ProfileManagerProps {
  profiles: ImportProfile[]
  wizardState: WizardState
  onUpdate: (updates: Partial<WizardState>) => void
}

export function ProfileManager({ profiles, wizardState, onUpdate }: ProfileManagerProps): React.JSX.Element {
  const renameProfile = useRenameProfile()
  const deleteProfile = useDeleteProfile()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const handleLoadProfile = (profile: ImportProfile): void => {
    try {
      const mapping = JSON.parse(profile.mapping_json) as ImportMappingConfig
      onUpdate({ mapping: { ...mapping, headerRowIndex: wizardState.mapping.headerRowIndex }, profileId: profile.id, profileModified: false })
    } catch { void message.error('Invalid profile mapping') }
  }

  const handleRename = async (id: number): Promise<void> => {
    if (!editName.trim()) return
    try {
      await renameProfile.mutateAsync({ id, name: editName })
      setEditingId(null)
    } catch { void message.error('Failed to rename profile') }
  }

  const handleDelete = async (id: number): Promise<void> => {
    try {
      await deleteProfile.mutateAsync({ id })
      if (wizardState.profileId === id) onUpdate({ profileId: null })
    } catch { void message.error('Failed to delete profile') }
  }

  if (profiles.length === 0) {
    return <Text type="secondary">No saved import profiles yet.</Text>
  }

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <Text strong style={{ color: COLORS.walnut }}>Saved Profiles</Text>
      <List size="small" dataSource={profiles} renderItem={(profile) => (
        <List.Item
          actions={[
            <Button key="load" type="link" size="small" onClick={() => handleLoadProfile(profile)}
              style={{ color: wizardState.profileId === profile.id ? COLORS.sage : undefined }}>
              {wizardState.profileId === profile.id ? 'Active' : 'Load'}
            </Button>,
            <Button key="edit" type="text" size="small" icon={<EditOutlined />}
              onClick={() => { setEditingId(profile.id); setEditName(profile.name) }} />,
            <Popconfirm key="del" title="Delete this profile?" onConfirm={() => void handleDelete(profile.id)}>
              <Button type="text" size="small" icon={<DeleteOutlined />} danger />
            </Popconfirm>,
          ]}
        >
          {editingId === profile.id ? (
            <Space>
              <Input size="small" value={editName} onChange={(e) => setEditName(e.target.value)}
                onPressEnter={() => void handleRename(profile.id)} style={{ width: 200 }} />
              <Button size="small" onClick={() => void handleRename(profile.id)}>Save</Button>
              <Button size="small" onClick={() => setEditingId(null)}>Cancel</Button>
            </Space>
          ) : (
            <Text>{profile.name}</Text>
          )}
        </List.Item>
      )} />
    </Space>
  )
}
