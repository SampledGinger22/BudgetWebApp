'use client'

import { useState } from 'react'
import { Button, Card, Checkbox, Modal, Space, Tag, Typography } from 'antd'
import { CheckOutlined, CloseOutlined, InfoCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { RecurringSuggestion } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

const { Text, Title } = Typography

type RecurringType = 'bill' | 'income' | 'subscription' | 'credit_payment' | 'transfer' | 'investment'

function suggestedType(suggestion: RecurringSuggestion): RecurringType {
  if (suggestion.is_debit === 0) return 'income'
  if (suggestion.avg_amount_cents < 2000) return 'subscription'
  return 'bill'
}

function typeLabel(type: RecurringType): string {
  const labels: Record<RecurringType, string> = {
    bill: 'Bill', income: 'Income', subscription: 'Subscription',
    credit_payment: 'Credit Payment', transfer: 'Transfer', investment: 'Investment',
  }
  return labels[type]
}

function typeColor(type: RecurringType): string {
  switch (type) {
    case 'income': return 'success'
    case 'subscription': return 'processing'
    case 'bill': return 'warning'
    default: return 'default'
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PatternSuggestionsProps {
  suggestions: RecurringSuggestion[]
  onAccept: (suggestion: RecurringSuggestion) => void
  onDismiss: (fingerprint: string) => void
  onCreateAll: (suggestions: RecurringSuggestion[]) => Promise<void>
}

// ─── Single suggestion card ───────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: RecurringSuggestion
  onAccept: () => void
  onDismiss: () => void
}

function SuggestionCard({ suggestion, onAccept, onDismiss }: SuggestionCardProps): React.JSX.Element {
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(true)
  const type = suggestedType(suggestion)

  const handleDismiss = (): void => {
    setDismissed(true)
    setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, 300)
  }

  if (!visible) return <></>

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
        backgroundColor: dismissed ? 'transparent' : COLORS.cream,
        border: `1px solid rgba(92, 61, 30, 0.12)`, borderRadius: 6, marginBottom: 6,
        opacity: dismissed ? 0 : 1, maxHeight: dismissed ? 0 : 80, overflow: 'hidden',
        transition: 'opacity 0.25s ease, max-height 0.3s ease, margin-bottom 0.3s ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong style={{ color: COLORS.walnut, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {suggestion.description}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Found in {suggestion.count} transaction{suggestion.count !== 1 ? 's' : ''}
        </Text>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: MONEY_FONT, fontWeight: 600, color: suggestion.is_debit === 1 ? COLORS.terracotta : COLORS.sage }}>
          {suggestion.is_debit === 1 ? '-' : '+'}{formatCurrency(suggestion.avg_amount_cents)}
        </div>
        <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase' }}>avg</div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Monthly</Text>
      </div>
      <div style={{ flexShrink: 0 }}>
        <Tag color={typeColor(type)}>{typeLabel(type)}</Tag>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', gap: 6 }}>
        <Button size="small" type="primary" icon={<CheckOutlined />}
          style={{ backgroundColor: COLORS.sage, borderColor: COLORS.sage }}
          onClick={onAccept} title="Accept — open template modal pre-filled">Accept</Button>
        <Button size="small" icon={<CloseOutlined />} onClick={handleDismiss} title="Dismiss — won't appear again" />
      </div>
    </div>
  )
}

// ─── Create All modal ─────────────────────────────────────────────────────────

interface CreateAllModalProps {
  suggestions: RecurringSuggestion[]
  open: boolean
  onConfirm: (selected: RecurringSuggestion[]) => Promise<void>
  onCancel: () => void
}

function CreateAllModal({ suggestions, open, onConfirm, onCancel }: CreateAllModalProps): React.JSX.Element {
  const [selectedFingerprints, setSelectedFingerprints] = useState<Set<string>>(
    new Set(suggestions.map((s) => s.fingerprint))
  )
  const [creating, setCreating] = useState(false)

  const toggleItem = (fingerprint: string): void => {
    setSelectedFingerprints((prev) => {
      const next = new Set(prev)
      if (next.has(fingerprint)) next.delete(fingerprint)
      else next.add(fingerprint)
      return next
    })
  }

  const handleConfirm = async (): Promise<void> => {
    const selected = suggestions.filter((s) => selectedFingerprints.has(s.fingerprint))
    if (selected.length === 0) return
    setCreating(true)
    try { await onConfirm(selected) } finally { setCreating(false) }
  }

  const selectedCount = selectedFingerprints.size

  return (
    <Modal
      title="Create recurring templates from suggestions"
      open={open} onCancel={onCancel}
      onOk={() => void handleConfirm()}
      okText={`Create ${selectedCount} template${selectedCount !== 1 ? 's' : ''}`}
      okButtonProps={{ disabled: selectedCount === 0, loading: creating }}
      width={540}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Review and select which patterns to create as recurring templates. You can edit each after creation.
        </Text>
        <div style={{ marginTop: 8 }}>
          {suggestions.map((s) => {
            const type = suggestedType(s)
            return (
              <div key={s.fingerprint} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: `1px solid rgba(92, 61, 30, 0.08)` }}>
                <Checkbox checked={selectedFingerprints.has(s.fingerprint)} onChange={() => toggleItem(s.fingerprint)} />
                <div style={{ flex: 1 }}>
                  <Text strong style={{ color: COLORS.walnut }}>{s.description}</Text>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    Monthly — {s.count} transactions
                  </Text>
                </div>
                <span style={{ fontFamily: MONEY_FONT, color: s.is_debit === 1 ? COLORS.terracotta : COLORS.sage, fontWeight: 600 }}>
                  {s.is_debit === 1 ? '-' : '+'}{formatCurrency(s.avg_amount_cents)}
                </span>
                <Tag color={typeColor(type)}>{typeLabel(type)}</Tag>
              </div>
            )
          })}
        </div>
      </Space>
    </Modal>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PatternSuggestions({ suggestions, onAccept, onDismiss, onCreateAll }: PatternSuggestionsProps): React.JSX.Element {
  const [createAllOpen, setCreateAllOpen] = useState(false)
  const [dismissedFingerprints, setDismissedFingerprints] = useState<Set<string>>(new Set())

  if (suggestions.length === 0) return <></>

  const visibleSuggestions = suggestions.filter((s) => !dismissedFingerprints.has(s.fingerprint))

  const handleDismiss = (fingerprint: string): void => {
    setDismissedFingerprints((prev) => new Set([...prev, fingerprint]))
    onDismiss(fingerprint)
  }

  const handleCreateAll = async (selected: RecurringSuggestion[]): Promise<void> => {
    await onCreateAll(selected)
    setCreateAllOpen(false)
  }

  if (visibleSuggestions.length === 0) return <></>

  return (
    <>
      <Card style={{ borderColor: `rgba(169, 85, 55, 0.2)` }} styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <InfoCircleOutlined style={{ color: COLORS.terracotta }} />
            <Title level={5} style={{ margin: 0, color: COLORS.walnut }}>
              We found recurring patterns in your transactions
            </Title>
          </div>
          <Button size="small" type="primary" icon={<ThunderboltOutlined />} onClick={() => setCreateAllOpen(true)}>
            Create All ({visibleSuggestions.length})
          </Button>
        </div>
        <div>
          {visibleSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.fingerprint}
              suggestion={suggestion}
              onAccept={() => onAccept(suggestion)}
              onDismiss={() => handleDismiss(suggestion.fingerprint)}
            />
          ))}
        </div>
      </Card>
      <CreateAllModal
        suggestions={visibleSuggestions}
        open={createAllOpen}
        onConfirm={handleCreateAll}
        onCancel={() => setCreateAllOpen(false)}
      />
    </>
  )
}

export default PatternSuggestions
