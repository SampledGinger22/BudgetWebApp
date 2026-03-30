'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Collapse, Empty, Input, Space, Table, Typography, message } from 'antd'
import { PlusOutlined, SyncOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import type { RecurringTemplate, RecurringSuggestion } from '@/lib/api/types'
import {
  useRecurringTemplates, useRecurringSuggestions, useSyncRecurring,
  useCreateTemplate, useUpdateTemplate, useDeleteTemplate, useToggleTemplate,
  useRecurringHistory, useDismissSuggestion,
} from '@/lib/api/recurring'
import { usePeriods } from '@/lib/api/periods'
import { SummaryCards } from '@/components/recurring/SummaryCards'
import { TemplateTable } from '@/components/recurring/TemplateTable'
import { TemplateModal } from '@/components/recurring/TemplateModal'
import { PatternSuggestions } from '@/components/recurring/PatternSuggestions'
import { UpcomingTimeline } from '@/components/recurring/UpcomingTimeline'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

const { Title, Text } = Typography

type RecurringType = 'bill' | 'income' | 'subscription' | 'credit_payment' | 'transfer' | 'investment'

const RECURRING_TYPE_LABELS: Record<RecurringType, string> = {
  bill: 'Bills', income: 'Income', subscription: 'Subscriptions',
  credit_payment: 'Credit Payments', transfer: 'Transfers', investment: 'Investments / Savings',
}

const RECURRING_TYPES: RecurringType[] = ['bill', 'income', 'subscription', 'credit_payment', 'transfer', 'investment']
const COLLAPSED_GROUPS_KEY = 'recurring-collapsed-groups'

function loadCollapsedGroups(): Set<RecurringType> {
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY)
    if (raw) return new Set(JSON.parse(raw) as RecurringType[])
  } catch { /* ignore */ }
  return new Set()
}

function saveCollapsedGroups(groups: Set<RecurringType>): void {
  localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...groups]))
}

function getCurrentSubPeriod(
  periods: { start_date: string; end_date: string; sub_periods: { id: number; start_date: string; end_date: string }[] }[],
): { label: string; id: number | null; endDate: string | null } {
  const today = dayjs().format('YYYY-MM-DD')
  for (const bp of periods) {
    for (const sp of bp.sub_periods) {
      if (sp.start_date <= today && today <= sp.end_date) {
        return {
          label: `${dayjs(sp.start_date).format('MMM D')} – ${dayjs(sp.end_date).format('MMM D, YYYY')}`,
          id: sp.id, endDate: sp.end_date,
        }
      }
    }
  }
  return { label: '', id: null, endDate: null }
}

function isExpiringSoon(template: RecurringTemplate): boolean {
  if (!template.end_date) return false
  const daysUntilEnd = dayjs(template.end_date).diff(dayjs(), 'day')
  return daysUntilEnd >= 0 && daysUntilEnd <= 30
}

// ─── Generation history table ─────────────────────────────────────────────────

function GenerationHistoryPanel({ templateId }: { templateId: number }): React.JSX.Element {
  const { data, isLoading } = useRecurringHistory(templateId)
  if (isLoading) return <Text type="secondary">Loading history...</Text>
  // The history endpoint may return template data; for the history panel we show template info
  if (!data) return <Text type="secondary">No generation history yet.</Text>
  return <Text type="secondary">Template details loaded.</Text>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecurringPage(): React.JSX.Element {
  const { data: templatesResp, isLoading: loading } = useRecurringTemplates()
  const { data: suggestionsResp, refetch: refetchSuggestions } = useRecurringSuggestions()
  const { data: periodsResp } = usePeriods()
  const syncRecurring = useSyncRecurring()
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const deleteTemplateMutation = useDeleteTemplate()
  const toggleTemplate = useToggleTemplate()
  const dismissSuggestion = useDismissSuggestion()

  const templates = templatesResp?.data ?? []
  const suggestions = suggestionsResp?.data ?? []
  const periods = periodsResp?.data ?? []

  const [search, setSearch] = useState('')
  const [timeView, setTimeView] = useState<string>('monthly')
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null)
  const [prefillData, setPrefillData] = useState<Partial<RecurringTemplate> | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<RecurringType>>(loadCollapsedGroups)
  const [showAllTypes, setShowAllTypes] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(new Set())
  const deleteTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const currentSubPeriod = getCurrentSubPeriod(periods)

  useEffect(() => {
    return () => {
      deleteTimeouts.current.forEach((timeout) => clearTimeout(timeout))
    }
  }, [])

  const handleDismissSuggestion = useCallback(async (fingerprint: string): Promise<void> => {
    try { await dismissSuggestion.mutateAsync({ fingerprint }) } catch { /* non-critical */ }
  }, [dismissSuggestion])

  const handleAcceptSuggestion = useCallback((suggestion: RecurringSuggestion): void => {
    const suggestedRecurringType: RecurringType =
      suggestion.is_debit === 0 ? 'income' : suggestion.avg_amount_cents < 2000 ? 'subscription' : 'bill'
    setPrefillData({
      name: suggestion.description,
      amount_cents: suggestion.avg_amount_cents,
      is_debit: suggestion.is_debit,
      type: suggestedRecurringType,
      frequency: 'monthly',
      interval_n: 1,
      template_dates: [],
    } as Partial<RecurringTemplate>)
    setEditingTemplate(null)
    setModalOpen(true)
  }, [])

  const handleCreateAllSuggestions = useCallback(async (selected: RecurringSuggestion[]): Promise<void> => {
    let created = 0
    for (const s of selected) {
      const suggestedType: RecurringType = s.is_debit === 0 ? 'income' : s.avg_amount_cents < 2000 ? 'subscription' : 'bill'
      try {
        await createTemplate.mutateAsync({
          name: s.description, amount_cents: s.avg_amount_cents, is_debit: s.is_debit,
          type: suggestedType, frequency: 'monthly', interval_n: 1, day_values: [1],
          account_id: s.account_id,
        })
        created++
      } catch { /* skip failed */ }
    }
    if (created > 0) {
      void message.success(`Created ${created} recurring template${created !== 1 ? 's' : ''}`)
      for (const s of selected) { void handleDismissSuggestion(s.fingerprint) }
    }
  }, [createTemplate, handleDismissSuggestion])

  const handleSync = useCallback(async (): Promise<void> => {
    try {
      await syncRecurring.mutateAsync()
      void message.success('Recurring entries synced')
    } catch {
      void message.error('Failed to sync recurring entries')
    }
  }, [syncRecurring])

  const searchLower = search.toLowerCase()
  const filteredTemplates = templates.filter((t) => {
    if (pendingDeletes.has(t.id)) return false
    if (!search) return true
    return (
      t.name.toLowerCase().includes(searchLower) ||
      (t.vendor_name?.toLowerCase().includes(searchLower) ?? false) ||
      (t.category_name?.toLowerCase().includes(searchLower) ?? false)
    )
  })

  const templatesByType = new Map<RecurringType, RecurringTemplate[]>()
  for (const type of RECURRING_TYPES) templatesByType.set(type, [])
  for (const t of filteredTemplates) {
    const arr = templatesByType.get(t.type as RecurringType)
    if (arr) arr.push(t)
  }

  const typesWithTemplates = RECURRING_TYPES.filter((type) => (templatesByType.get(type)?.length ?? 0) > 0)
  const typesToShow = showAllTypes ? RECURRING_TYPES : typesWithTemplates
  const hasEmptyTypes = typesWithTemplates.length < RECURRING_TYPES.length

  const toggleCollapse = (type: RecurringType): void => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      saveCollapsedGroups(next)
      return next
    })
  }

  const handleSelectChange = (id: number, checked: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleBulkPause = async (): Promise<void> => {
    const activeSelected = [...selectedIds].filter((id) => templates.find((t) => t.id === id)?.status === 'active')
    await Promise.all(activeSelected.map((id) => toggleTemplate.mutateAsync({ id })))
    setSelectedIds(new Set())
  }

  const handleBulkActivate = async (): Promise<void> => {
    const pausedSelected = [...selectedIds].filter((id) => templates.find((t) => t.id === id)?.status === 'paused')
    await Promise.all(pausedSelected.map((id) => toggleTemplate.mutateAsync({ id })))
    setSelectedIds(new Set())
  }

  const handleDelete = (templateId: number): void => {
    setPendingDeletes((prev) => new Set([...prev, templateId]))
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(templateId); return next })
    const templateName = templates.find((t) => t.id === templateId)?.name ?? 'Template'
    void message.info({
      content: (
        <span>
          &ldquo;{templateName}&rdquo; deleted.{' '}
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => {
            setPendingDeletes((prev) => { const next = new Set(prev); next.delete(templateId); return next })
            const timeout = deleteTimeouts.current.get(templateId)
            if (timeout) { clearTimeout(timeout); deleteTimeouts.current.delete(templateId) }
          }}>Undo</Button>
        </span>
      ),
      duration: 10, key: `delete-${templateId}`,
    })
    const timeout = setTimeout(() => {
      deleteTimeouts.current.delete(templateId)
      setPendingDeletes((prev) => { const next = new Set(prev); next.delete(templateId); return next })
      void deleteTemplateMutation.mutateAsync({ id: templateId }).catch(() => void message.error('Failed to delete template'))
    }, 10000)
    deleteTimeouts.current.set(templateId, timeout)
  }

  const handleOpenCreate = (): void => { setEditingTemplate(null); setPrefillData(null); setModalOpen(true) }
  const handleOpenEdit = (template: RecurringTemplate): void => { setEditingTemplate(template); setPrefillData(null); setModalOpen(true) }
  const handleModalClose = (): void => { setModalOpen(false); setEditingTemplate(null); setPrefillData(null) }

  const handleModalSave = async (data: Parameters<typeof createTemplate.mutateAsync>[0]): Promise<void> => {
    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, ...data })
    } else {
      await createTemplate.mutateAsync(data)
    }
    handleModalClose()
  }

  const showGuidedEmptyState = !loading && templates.length === 0

  return (
    <Space orientation="vertical" size={24} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: COLORS.walnut }}>Recurring Transactions</Title>
          {currentSubPeriod.label && <Text type="secondary" style={{ fontSize: 13 }}>Current period: {currentSubPeriod.label}</Text>}
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={() => void handleSync()} loading={syncRecurring.isPending}>
            Sync recurring
          </Button>
        </Space>
      </div>

      {showGuidedEmptyState && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', border: `2px dashed rgba(169, 85, 55, 0.2)`, borderRadius: 8, backgroundColor: COLORS.cream, textAlign: 'center' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={
            <Space orientation="vertical" size={4}>
              <Text strong style={{ color: COLORS.walnut, fontSize: 16 }}>Set up your recurring transactions</Text>
              <Text type="secondary" style={{ maxWidth: 380, display: 'block' }}>Track subscriptions, bills, and income that repeat on a schedule.</Text>
            </Space>
          } />
          <Space style={{ marginTop: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} size="large">Create your first template</Button>
          </Space>
        </div>
      )}

      <ErrorBoundary label="Recurring Templates">
        {templates.length > 0 && <SummaryCards templates={filteredTemplates} timeView={timeView} onTimeViewChange={setTimeView} />}
        {suggestions.length > 0 && (
          <PatternSuggestions suggestions={suggestions} onAccept={handleAcceptSuggestion} onDismiss={(fp) => void handleDismissSuggestion(fp)} onCreateAll={handleCreateAllSuggestions} />
        )}
        {templates.length > 0 && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Input.Search placeholder="Search by description, vendor, or category..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 480 }} allowClear />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>Add Recurring</Button>
          </div>
        )}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', backgroundColor: COLORS.creamDark, borderRadius: 6, border: `1px solid rgba(169, 85, 55, 0.2)` }}>
            <Text style={{ color: COLORS.walnut, fontWeight: 500 }}>{selectedIds.size} selected</Text>
            <Button size="small" onClick={() => void handleBulkPause()}>Pause Selected</Button>
            <Button size="small" onClick={() => void handleBulkActivate()}>Activate Selected</Button>
            <Button size="small" onClick={() => setSelectedIds(new Set())}>Clear Selection</Button>
          </div>
        )}
        {!loading && templates.length > 0 && typesToShow.length === 0 && (
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: 32 }}>No results match your search.</Text>
        )}
        {typesToShow.map((type) => {
          const typeTemplates = templatesByType.get(type) ?? []
          const templatesWithExpiring = typeTemplates.map((t) => ({ ...t, _expiringSoon: isExpiringSoon(t) }))
          return (
            <TemplateTable
              key={type} type={type} typeLabel={RECURRING_TYPE_LABELS[type]}
              templates={templatesWithExpiring} collapsed={collapsedGroups.has(type)}
              onToggleCollapse={() => toggleCollapse(type)} onEdit={handleOpenEdit}
              onDelete={handleDelete} onToggleStatus={(id) => void toggleTemplate.mutateAsync({ id })}
              selectedIds={selectedIds} onSelectChange={handleSelectChange}
            />
          )
        })}
        {templates.length > 0 && hasEmptyTypes && (
          <Button type="link" style={{ color: COLORS.terracotta }} onClick={() => setShowAllTypes((prev) => !prev)}>
            {showAllTypes ? 'Hide empty types' : 'Show all types'}
          </Button>
        )}
        {templates.length > 0 && (
          <div style={{ padding: 16, border: `1px solid rgba(92, 61, 30, 0.12)`, borderRadius: 6, backgroundColor: COLORS.creamDark }}>
            <UpcomingTimeline templates={templates.filter((t) => t.status === 'active')} periodEnd={currentSubPeriod.endDate ?? dayjs().add(30, 'day').format('YYYY-MM-DD')} />
          </div>
        )}
      </ErrorBoundary>

      <TemplateModal open={modalOpen} onClose={handleModalClose} onSave={handleModalSave}
        editTemplate={editingTemplate ?? undefined} prefillData={prefillData ?? undefined}
        historyPanel={editingTemplate ? (
          <Collapse size="small" style={{ marginTop: 8 }} items={[{ key: 'history', label: 'Generation History', children: <GenerationHistoryPanel templateId={editingTemplate.id} /> }]} />
        ) : undefined}
      />
    </Space>
  )
}
