'use client'

import { useState } from 'react'
import { Button, InputNumber, Select, Space, Typography } from 'antd'
import type { BudgetSummaryResponse, CategoryGroup } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency, dollarsToCents, centsToDollars } from '@/lib/utils/money'

const { Text } = Typography

interface QuickAssignWidgetProps {
  groups: CategoryGroup[]
  summary: BudgetSummaryResponse | null
  onAssign: (categoryId: number, allocatedCents: number) => Promise<void>
  disabled?: boolean
}

export function QuickAssignWidget({
  groups,
  summary,
  onAssign,
  disabled,
}: QuickAssignWidgetProps): React.JSX.Element {
  const [amount, setAmount] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [assigning, setAssigning] = useState(false)

  // Unallocated = total_income + carry_forward - total_allocated
  const unallocatedCents = summary
    ? summary.total_income_cents +
      summary.carry_forward_cents -
      summary.total_allocated_cents
    : 0
  const unallocatedDollars = centsToDollars(unallocatedCents)
  const maxAmount = Math.max(0, unallocatedDollars)

  // Build category options grouped by category group (S06 uses sub_categories)
  const categoryOptions = groups
    .filter((g) => g.categories.length > 0)
    .map((group) => {
      const cats: { value: number; label: string }[] = []

      const addCat = (cat: { id: number; name: string; archived_at: string | null; sub_categories?: { id: number; name: string; archived_at: string | null }[] }, prefix: string): void => {
        if (!cat.archived_at) {
          cats.push({ value: cat.id, label: `${prefix}${cat.name}` })
          if (cat.sub_categories) {
            for (const sub of cat.sub_categories) {
              addCat(sub, `${prefix}  `)
            }
          }
        }
      }

      for (const cat of group.categories) {
        addCat(cat, '')
      }

      return {
        label: group.name,
        options: cats,
      }
    })
    .filter((g) => g.options.length > 0)

  const handleAssign = async (): Promise<void> => {
    if (amount == null || amount <= 0 || categoryId == null) return
    setAssigning(true)
    try {
      await onAssign(categoryId, dollarsToCents(amount))
      setAmount(null)
    } finally {
      setAssigning(false)
    }
  }

  const canAssign = amount != null && amount > 0 && categoryId != null && !disabled

  return (
    <Space align="center" wrap style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, color: COLORS.walnut }}>Quick Assign:</Text>

      <InputNumber
        prefix="$"
        precision={2}
        min={0.01}
        max={maxAmount > 0 ? maxAmount : undefined}
        value={amount}
        onChange={setAmount}
        placeholder="0.00"
        style={{ width: 120 }}
        disabled={disabled}
      />

      <Select
        showSearch
        placeholder="Select category"
        value={categoryId}
        onChange={setCategoryId}
        style={{ minWidth: 200 }}
        options={categoryOptions}
        filterOption={(input, option) =>
          (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
        }
        disabled={disabled}
      />

      <Button
        type="primary"
        onClick={handleAssign}
        loading={assigning}
        disabled={!canAssign}
      >
        Assign
      </Button>

      {/* PLAT-04: Use formatCurrency() instead of .toFixed(2) */}
      <Text
        style={{
          fontSize: 12,
          fontFamily: MONEY_FONT,
          color: unallocatedCents > 0 ? COLORS.sage : COLORS.terracotta,
        }}
      >
        Unallocated:{' '}
        <strong>{formatCurrency(unallocatedCents)}</strong>
      </Text>
    </Space>
  )
}

export default QuickAssignWidget
