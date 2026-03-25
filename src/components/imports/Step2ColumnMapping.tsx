'use client'

import { useState, useEffect, useMemo } from 'react'
import { Alert, Button, Divider, Select, Space, Table, Tag, Typography } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { buildFingerprint } from '@/lib/utils/csvParser'
import { useImportProfiles, useCreateProfile, useUpdateProfile } from '@/lib/api/imports'
import { COLORS, MONEY_FONT } from '@/theme'
import type { ImportMappingConfig, WizardState } from './types'
import { ProfileManager } from './ProfileManager'

const { Text } = Typography

interface Step2Props {
  wizardState: WizardState
  onUpdate: (updates: Partial<WizardState>) => void
}

const SIGN_CONVENTION_OPTIONS = [
  { value: 'positive-income', label: 'Positive = Income (deposits are positive)' },
  { value: 'positive-expense', label: 'Positive = Expense (charges are positive)' },
]

const AMOUNT_MODE_OPTIONS = [
  { value: 'single', label: 'Single amount column' },
  { value: 'split', label: 'Separate debit/credit columns' },
]

export function Step2ColumnMapping({ wizardState, onUpdate }: Step2Props): React.JSX.Element {
  const { data: profilesResp } = useImportProfiles()
  const createProfile = useCreateProfile()
  const updateProfile = useUpdateProfile()

  const profiles = profilesResp?.data ?? []
  const [saveProfileName, setSaveProfileName] = useState('')

  const columnOptions = useMemo(() => {
    return [
      { value: -1, label: '— Not mapped —' },
      ...wizardState.headers.map((h, idx) => ({ value: idx, label: h || `Column ${idx + 1}` })),
    ]
  }, [wizardState.headers])

  // Auto-detect profile by fingerprint
  useEffect(() => {
    if (profiles.length === 0 || wizardState.profileId !== null) return
    const fingerprint = buildFingerprint(wizardState.headers)
    const match = profiles.find((p) => p.header_fingerprint === fingerprint)
    if (match) {
      try {
        const mapping = JSON.parse(match.mapping_json) as ImportMappingConfig
        onUpdate({ mapping: { ...mapping, headerRowIndex: wizardState.mapping.headerRowIndex }, profileId: match.id, profileModified: false })
      } catch { /* ignore parse error */ }
    }
  }, [profiles, wizardState.headers, wizardState.profileId, wizardState.mapping.headerRowIndex, onUpdate])

  const updateMapping = (updates: Partial<ImportMappingConfig>): void => {
    onUpdate({ mapping: { ...wizardState.mapping, ...updates }, profileModified: true })
  }

  const handleSaveProfile = async (): Promise<void> => {
    if (!saveProfileName.trim()) return
    const fingerprint = buildFingerprint(wizardState.headers)
    const mappingJson = JSON.stringify(wizardState.mapping)
    try {
      if (wizardState.profileId) {
        await updateProfile.mutateAsync({ id: wizardState.profileId, mapping_json: mappingJson })
      } else {
        const result = await createProfile.mutateAsync({ name: saveProfileName, header_fingerprint: fingerprint, mapping_json: mappingJson })
      }
    } catch { /* handled by TanStack Query */ }
  }

  const { mapping } = wizardState

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ background: COLORS.creamDark, borderRadius: 8, padding: 20 }}>
        <Text strong style={{ color: COLORS.walnut }}>Column Mapping</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <Text style={{ fontSize: 13, color: COLORS.walnut }}>Date Column *</Text>
            <Select value={mapping.dateColumn ?? -1} onChange={(v) => updateMapping({ dateColumn: v === -1 ? null : v })} options={columnOptions} style={{ width: '100%' }} size="small" />
          </div>
          <div>
            <Text style={{ fontSize: 13, color: COLORS.walnut }}>Description Column *</Text>
            <Select value={mapping.descriptionColumn ?? -1} onChange={(v) => updateMapping({ descriptionColumn: v === -1 ? null : v })} options={columnOptions} style={{ width: '100%' }} size="small" />
          </div>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text style={{ fontSize: 13, color: COLORS.walnut }}>Amount Mode</Text>
          <Select value={mapping.amountMode} onChange={(v) => updateMapping({ amountMode: v as 'single' | 'split' })} options={AMOUNT_MODE_OPTIONS} style={{ width: 300 }} size="small" />
        </Space>

        {mapping.amountMode === 'single' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <Text style={{ fontSize: 13, color: COLORS.walnut }}>Amount Column *</Text>
              <Select value={mapping.amountColumn ?? -1} onChange={(v) => updateMapping({ amountColumn: v === -1 ? null : v })} options={columnOptions} style={{ width: '100%' }} size="small" />
            </div>
            <div>
              <Text style={{ fontSize: 13, color: COLORS.walnut }}>Sign Convention</Text>
              <Select value={mapping.signConvention} onChange={(v) => updateMapping({ signConvention: v as 'positive-income' | 'positive-expense' })} options={SIGN_CONVENTION_OPTIONS} style={{ width: '100%' }} size="small" />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <Text style={{ fontSize: 13, color: COLORS.walnut }}>Debit Column *</Text>
              <Select value={mapping.debitColumn ?? -1} onChange={(v) => updateMapping({ debitColumn: v === -1 ? null : v })} options={columnOptions} style={{ width: '100%' }} size="small" />
            </div>
            <div>
              <Text style={{ fontSize: 13, color: COLORS.walnut }}>Credit Column *</Text>
              <Select value={mapping.creditColumn ?? -1} onChange={(v) => updateMapping({ creditColumn: v === -1 ? null : v })} options={columnOptions} style={{ width: '100%' }} size="small" />
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 13, color: COLORS.walnut }}>Date Format (optional)</Text>
          <Select value={mapping.dateFormat || undefined} onChange={(v) => updateMapping({ dateFormat: v })} placeholder="Auto-detect"
            options={[
              { value: '', label: 'Auto-detect' },
              { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
              { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
              { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
              { value: 'M/D/YYYY', label: 'M/D/YYYY' },
            ]}
            style={{ width: 200 }} size="small" allowClear
          />
        </div>
      </div>

      <div style={{ background: COLORS.creamDark, borderRadius: 8, padding: 20 }}>
        <ProfileManager profiles={profiles} wizardState={wizardState} onUpdate={onUpdate} />
      </div>
    </Space>
  )
}
