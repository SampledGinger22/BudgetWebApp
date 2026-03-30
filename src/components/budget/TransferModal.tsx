'use client'

import { useEffect } from 'react'
import { Button, Form, Input, InputNumber, Modal, Select, message } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import type { BudgetVarianceRow, CategoryGroup } from '@/lib/api/types'
import { useCreateTransfer } from '@/lib/api/budget'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency, dollarsToCents, centsToDollars } from '@/lib/utils/money'

interface TransferModalProps {
  open: boolean
  onClose: () => void
  onTransferComplete: () => void
  subPeriodId: number
  varianceRows: BudgetVarianceRow[]
  groups: CategoryGroup[]
  prefillFromCategoryId?: number | null
}

interface TransferFormValues {
  from_category_id: number | undefined
  to_category_id: number | undefined
  amount: number | null
  note: string | undefined
}

// Build grouped category options for a Select — only non-archived leaf categories
// S06 types: uses sub_categories (snake_case) not subCategories
function buildGroupedOptions(
  groups: CategoryGroup[],
  excludeCategoryId?: number,
  allowGroupId?: number,
): { label: string; options: { value: number; label: string }[] }[] {
  return groups
    .filter((g) => g.categories.length > 0 && (allowGroupId == null || g.id === allowGroupId))
    .map((group) => {
      const cats: { value: number; label: string }[] = []

      const addCat = (cat: { id: number; name: string; archived_at: string | null; sub_categories?: { id: number; name: string; archived_at: string | null }[] }, prefix: string): void => {
        if (!cat.archived_at) {
          if (!cat.sub_categories || cat.sub_categories.length === 0) {
            // Leaf category — add directly
            if (cat.id !== excludeCategoryId) {
              cats.push({ value: cat.id, label: `${prefix}${cat.name}` })
            }
          } else {
            // Parent category — include it as an option AND its children
            if (cat.id !== excludeCategoryId) {
              cats.push({ value: cat.id, label: `${prefix}${cat.name}` })
            }
            for (const sub of cat.sub_categories) {
              addCat(sub, `${prefix}  `)
            }
          }
        }
      }

      for (const cat of group.categories) {
        addCat(cat, '')
      }

      return { label: group.name, options: cats }
    })
    .filter((g) => g.options.length > 0)
}

// Find which group a category belongs to (S06: sub_categories)
function findGroupIdForCategory(categoryId: number, groups: CategoryGroup[]): number | null {
  for (const group of groups) {
    const checkCat = (cat: { id: number; sub_categories?: { id: number }[] }): boolean => {
      if (cat.id === categoryId) return true
      if (cat.sub_categories) {
        for (const sub of cat.sub_categories) {
          if (checkCat(sub)) return true
        }
      }
      return false
    }
    for (const cat of group.categories) {
      if (checkCat(cat)) return group.id
    }
  }
  return null
}

// Find category name from variance rows or groups tree (S06: sub_categories)
function findCategoryName(catId: number, varianceRows: BudgetVarianceRow[], groups: CategoryGroup[]): string {
  const row = varianceRows.find((r) => r.category_id === catId)
  if (row) return row.category_name
  for (const g of groups) {
    for (const c of g.categories) {
      if (c.id === catId) return c.name
      if (c.sub_categories) {
        for (const sc of c.sub_categories) {
          if (sc.id === catId) return sc.name
        }
      }
    }
  }
  return `Category ${catId}`
}

export function TransferModal({
  open,
  onClose,
  onTransferComplete,
  subPeriodId,
  varianceRows,
  groups,
  prefillFromCategoryId,
}: TransferModalProps): React.JSX.Element {
  const [form] = Form.useForm<TransferFormValues>()
  const createTransfer = useCreateTransfer()
  const fromCategoryId = Form.useWatch('from_category_id', form)
  const toCategoryId = Form.useWatch('to_category_id', form)
  const amountDollars = Form.useWatch('amount', form)

  // When modal opens with a prefill, set it
  useEffect(() => {
    if (open) {
      if (prefillFromCategoryId != null) {
        form.setFieldsValue({ from_category_id: prefillFromCategoryId })
      } else {
        form.resetFields()
      }
    }
  }, [open, prefillFromCategoryId, form])

  // Determine source group id for filtering destination options
  const sourceGroupId =
    fromCategoryId != null ? findGroupIdForCategory(fromCategoryId, groups) : null

  // Build source options — all groups, all non-archived leaf categories
  const fromOptions = buildGroupedOptions(groups)

  // Build destination options — same group as source, exclude selected source
  const toOptions = buildGroupedOptions(groups, fromCategoryId, sourceGroupId ?? undefined)

  // Live preview calculations
  const amountCents = amountDollars != null ? dollarsToCents(amountDollars) : 0

  const sourceRow =
    fromCategoryId != null ? varianceRows.find((r) => r.category_id === fromCategoryId) : null
  const destRow =
    toCategoryId != null ? varianceRows.find((r) => r.category_id === toCategoryId) : null

  const sourceAfter = sourceRow != null ? sourceRow.remaining_cents - amountCents : null
  const destAfter = destRow != null ? destRow.remaining_cents + amountCents : null

  const showPreview =
    fromCategoryId != null && toCategoryId != null && amountCents > 0 && sourceRow != null

  const handleSwap = (): void => {
    const from = form.getFieldValue('from_category_id') as number | undefined
    const to = form.getFieldValue('to_category_id') as number | undefined
    form.setFieldsValue({ from_category_id: to, to_category_id: from })
  }

  const handleSubmit = async (values: TransferFormValues): Promise<void> => {
    if (
      values.from_category_id == null ||
      values.to_category_id == null ||
      values.amount == null
    ) {
      return
    }
    const cents = dollarsToCents(values.amount)

    try {
      // Use S06 createTransfer mutation hook
      const result = await createTransfer.mutateAsync({
        budget_sub_period_id: subPeriodId,
        from_category_id: values.from_category_id,
        to_category_id: values.to_category_id,
        amount_cents: cents,
        note: values.note ?? null,
      })

      const fromName = findCategoryName(values.from_category_id, varianceRows, groups)
      const toName = findCategoryName(values.to_category_id, varianceRows, groups)

      // Check was_capped: API may silently cap to source category's available balance
      if (result.was_capped && result.amount_cents !== cents) {
        void message.warning(
          `Transfer was capped to ${formatCurrency(result.amount_cents)} (source category's available balance) — from ${fromName} → ${toName}`,
        )
      } else {
        void message.success(
          `Transferred ${formatCurrency(result.amount_cents)} from ${fromName} \u2192 ${toName}`,
        )
      }

      form.resetFields()
      onTransferComplete()
    } catch (err) {
      void message.error(
        err instanceof Error ? err.message : 'Transfer failed. Please try again.',
      )
    }
  }

  const handleCancel = (): void => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="Transfer Budget"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={480}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ paddingTop: 8 }}
      >
        <Form.Item
          label="From Category"
          name="from_category_id"
          rules={[{ required: true, message: 'Select a source category' }]}
        >
          <Select
            showSearch
            placeholder="Select source category"
            options={fromOptions}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            onChange={() => {
              // Clear destination when source changes to avoid cross-group selection
              form.setFieldValue('to_category_id', undefined)
            }}
          />
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <Button
            icon={<SwapOutlined />}
            size="small"
            type="text"
            onClick={handleSwap}
            title="Swap from/to categories"
          />
        </div>

        <Form.Item
          label="To Category"
          name="to_category_id"
          rules={[{ required: true, message: 'Select a destination category' }]}
        >
          <Select
            showSearch
            placeholder={
              fromCategoryId == null
                ? 'Select a source category first'
                : 'Select destination category'
            }
            options={toOptions}
            disabled={fromCategoryId == null}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item
          label="Amount"
          name="amount"
          rules={[
            { required: true, message: 'Enter an amount' },
            {
              validator: (_, value: number | null) =>
                value != null && value > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error('Amount must be greater than $0.00')),
            },
          ]}
        >
          <InputNumber
            prefix="$"
            precision={2}
            min={0.01}
            max={sourceRow ? centsToDollars(sourceRow.remaining_cents) : undefined}
            placeholder="0.00"
            style={{ width: '100%' }}
          />
        </Form.Item>

        {/* Live balance preview */}
        {showPreview && (
          <div
            style={{
              background: COLORS.creamDark,
              borderRadius: 6,
              padding: '8px 12px',
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <div style={{ color: COLORS.walnut, fontWeight: 500, marginBottom: 4 }}>
              After Transfer:
            </div>
            {sourceRow != null && (
              <div style={{ fontFamily: MONEY_FONT, color: COLORS.walnut }}>
                {sourceRow.category_name}:{' '}
                <span style={{ color: COLORS.sage }}>
                  {formatCurrency(sourceRow.remaining_cents)} &rarr;{' '}
                  {formatCurrency(sourceAfter ?? 0)}
                </span>
              </div>
            )}
            {destRow != null && destAfter != null && (
              <div style={{ fontFamily: MONEY_FONT, color: COLORS.walnut }}>
                {destRow.category_name}:{' '}
                <span style={{ color: COLORS.sage }}>
                  {formatCurrency(destRow.remaining_cents)} &rarr; {formatCurrency(destAfter)}
                </span>
              </div>
            )}
          </div>
        )}

        <Form.Item label="Note (optional)" name="note">
          <Input.TextArea
            placeholder="Optional note"
            maxLength={200}
            autoSize={{ minRows: 2, maxRows: 4 }}
            showCount
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Button onClick={handleCancel} style={{ marginRight: 8 }}>
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={createTransfer.isPending}
          >
            Transfer
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default TransferModal
