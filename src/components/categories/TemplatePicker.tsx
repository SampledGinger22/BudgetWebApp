'use client'

import { useState } from 'react'
import { Card, Button, Row, Col, Typography, Space, Spin, message } from 'antd'
import { UserOutlined, TeamOutlined, HeartOutlined, AppstoreOutlined } from '@ant-design/icons'
import type { CategoryGroup } from '@/lib/api/types'
import { useCreateCategory } from '@/lib/api/categories'
import { COLORS } from '@/theme'

const { Title, Text } = Typography

interface TemplatePickerProps {
  groups: CategoryGroup[]
  onApply: () => Promise<void>
  onSkip: () => void
}

interface TemplateOption {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  categories: Array<{ groupName: string; name: string; parent?: string }>
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'single',
    label: 'Single',
    description: 'Basic categories for a single person.',
    icon: <UserOutlined style={{ fontSize: 28 }} />,
    categories: [
      { groupName: 'Income', name: 'Salary' },
      { groupName: 'Income', name: 'Side Income' },
      { groupName: 'Expense', name: 'Housing' },
      { groupName: 'Expense', name: 'Utilities', parent: 'Housing' },
      { groupName: 'Expense', name: 'Groceries' },
      { groupName: 'Expense', name: 'Transportation' },
      { groupName: 'Expense', name: 'Insurance' },
      { groupName: 'Expense', name: 'Entertainment' },
      { groupName: 'Expense', name: 'Personal' },
      { groupName: 'Expense', name: 'Healthcare' },
      { groupName: 'Savings/Goals', name: 'Emergency Fund' },
      { groupName: 'Savings/Goals', name: 'Retirement' },
    ],
  },
  {
    id: 'couple',
    label: 'Couple',
    description: 'Shared and individual categories for a two-person household.',
    icon: <TeamOutlined style={{ fontSize: 28 }} />,
    categories: [
      { groupName: 'Income', name: 'Primary Income' },
      { groupName: 'Income', name: 'Secondary Income' },
      { groupName: 'Income', name: 'Side Income' },
      { groupName: 'Expense', name: 'Housing' },
      { groupName: 'Expense', name: 'Utilities', parent: 'Housing' },
      { groupName: 'Expense', name: 'Groceries' },
      { groupName: 'Expense', name: 'Dining Out' },
      { groupName: 'Expense', name: 'Transportation' },
      { groupName: 'Expense', name: 'Insurance' },
      { groupName: 'Expense', name: 'Entertainment' },
      { groupName: 'Expense', name: 'Personal (Mason)' },
      { groupName: 'Expense', name: 'Personal (Ashlie)' },
      { groupName: 'Expense', name: 'Healthcare' },
      { groupName: 'Savings/Goals', name: 'Emergency Fund' },
      { groupName: 'Savings/Goals', name: 'Vacation' },
      { groupName: 'Savings/Goals', name: 'Retirement' },
    ],
  },
  {
    id: 'family',
    label: 'Family',
    description: 'Couple categories plus child-related expenses.',
    icon: <HeartOutlined style={{ fontSize: 28 }} />,
    categories: [
      { groupName: 'Income', name: 'Primary Income' },
      { groupName: 'Income', name: 'Secondary Income' },
      { groupName: 'Income', name: 'Side Income' },
      { groupName: 'Expense', name: 'Housing' },
      { groupName: 'Expense', name: 'Utilities', parent: 'Housing' },
      { groupName: 'Expense', name: 'Groceries' },
      { groupName: 'Expense', name: 'Dining Out' },
      { groupName: 'Expense', name: 'Transportation' },
      { groupName: 'Expense', name: 'Insurance' },
      { groupName: 'Expense', name: 'Entertainment' },
      { groupName: 'Expense', name: 'Personal (Mason)' },
      { groupName: 'Expense', name: 'Personal (Ashlie)' },
      { groupName: 'Expense', name: 'Healthcare' },
      { groupName: 'Expense', name: 'Childcare' },
      { groupName: 'Expense', name: 'Education' },
      { groupName: 'Expense', name: 'Kids Activities' },
      { groupName: 'Savings/Goals', name: 'Emergency Fund' },
      { groupName: 'Savings/Goals', name: 'Vacation' },
      { groupName: 'Savings/Goals', name: 'College Fund' },
      { groupName: 'Savings/Goals', name: 'Retirement' },
    ],
  },
  {
    id: 'blank',
    label: 'Blank',
    description: 'Start with just the 3 system groups. Build your own categories.',
    icon: <AppstoreOutlined style={{ fontSize: 28 }} />,
    categories: [],
  },
]

export function TemplatePicker({ groups, onApply, onSkip }: TemplatePickerProps): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const createCategory = useCreateCategory()

  const handleApply = async () => {
    if (!selected) return
    const template = TEMPLATES.find((t) => t.id === selected)
    if (!template) return

    setApplying(true)
    try {
      if (template.categories.length === 0) {
        onSkip()
        return
      }

      const groupMap = new Map<string, number>()
      for (const g of groups) {
        groupMap.set(g.name, g.id)
      }

      const parentIdMap = new Map<string, number>()
      const topLevel = template.categories.filter((c) => !c.parent)
      const subLevel = template.categories.filter((c) => c.parent)

      let failures = 0
      for (const cat of topLevel) {
        const groupId = groupMap.get(cat.groupName)
        if (!groupId) continue
        try {
          const result = await createCategory.mutateAsync({
            category_group_id: groupId,
            name: cat.name,
          })
          parentIdMap.set(`${cat.groupName}:${cat.name}`, result.id)
        } catch {
          failures++
        }
      }

      for (const cat of subLevel) {
        const groupId = groupMap.get(cat.groupName)
        if (!groupId) continue
        const parentId = cat.parent ? parentIdMap.get(`${cat.groupName}:${cat.parent}`) : null
        if (cat.parent && !parentId) continue
        try {
          await createCategory.mutateAsync({
            category_group_id: groupId,
            parent_id: parentId ?? undefined,
            name: cat.name,
          })
        } catch {
          failures++
        }
      }

      if (failures > 0) {
        void message.warning(`${failures} categories could not be created (may already exist).`)
      }

      await onApply()
    } finally {
      setApplying(false)
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <Title level={4} style={{ color: COLORS.walnut, marginBottom: 8 }}>
        Choose a starter template
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Select a template to pre-populate your categories, or start with a blank slate.
      </Text>

      <Row gutter={[16, 16]}>
        {TEMPLATES.map((template) => (
          <Col key={template.id} xs={24} sm={12}>
            <Card
              hoverable
              onClick={() => setSelected(template.id)}
              style={{
                borderColor: selected === template.id ? COLORS.terracotta : '#d9d9d9',
                borderWidth: selected === template.id ? 2 : 1,
                backgroundColor: selected === template.id ? 'rgba(169, 85, 55, 0.05)' : COLORS.cream,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              styles={{ body: { padding: 20 } }}
            >
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ color: selected === template.id ? COLORS.terracotta : COLORS.walnut }}>
                  {template.icon}
                </div>
                <Text strong style={{ fontSize: 15, color: COLORS.walnut }}>{template.label}</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>{template.description}</Text>
                {template.categories.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>{template.categories.length} categories</Text>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button
          type="primary"
          size="large"
          disabled={!selected || applying}
          onClick={handleApply}
          style={{ backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta }}
        >
          {applying ? <Spin size="small" /> : 'Apply Template'}
        </Button>
        <Button type="text" onClick={onSkip} style={{ color: COLORS.walnut }}>
          Skip &mdash; I&apos;ll set up categories manually
        </Button>
      </div>
    </div>
  )
}

export default TemplatePicker
