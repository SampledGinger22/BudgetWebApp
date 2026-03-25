'use client'

import { Avatar, Button, InputNumber, Select, Space, Input } from 'antd'
import { TeamOutlined } from '@ant-design/icons'
import { useCategories } from '@/lib/api/categories'
import { useMembers } from '@/lib/api/members'
import { useVendors } from '@/lib/api/vendors'

/**
 * Transaction filter parameters — mirrors the query params accepted
 * by the transactions API. Values are set by filter controls and
 * passed to the parent page which feeds them to useTransactions().
 */
export interface TransactionFilters {
  category_id?: number
  vendor_id?: number
  member_id?: number
  search?: string
  amount_min?: number
  amount_max?: number
  source?: string
  recurring_status?: string
  reconciled_status?: string
  date_from?: string
  date_to?: string
  import_batch_id?: number
  [key: string]: string | number | boolean | undefined
}

interface LedgerFilterBarProps {
  filters: TransactionFilters
  onFilterChange: (filters: TransactionFilters) => void
}

export function LedgerFilterBar({ filters, onFilterChange }: LedgerFilterBarProps): React.JSX.Element {
  const { data: groups = [] } = useCategories()
  const { data: vendors = [] } = useVendors()
  const { data: members = [] } = useMembers()

  const hasMembers = members.filter((m) => m.archived_at == null).length > 0

  const hasActiveFilters =
    filters.category_id != null ||
    filters.vendor_id != null ||
    filters.member_id != null ||
    filters.search != null ||
    filters.amount_min != null ||
    filters.amount_max != null ||
    (filters.source != null && filters.source !== 'all') ||
    (filters.recurring_status != null && filters.recurring_status !== 'all') ||
    (filters.reconciled_status != null && filters.reconciled_status !== 'all')

  // Flatten category groups into options
  const categoryOptions = groups.flatMap((g) =>
    g.categories
      .filter((c) => c.archived_at == null)
      .map((c) => ({ value: c.id, label: `${g.name} / ${c.name}` })),
  )

  const vendorOptions = vendors
    .filter((v) => v.archived_at == null)
    .map((v) => ({ value: v.id, label: v.name }))

  const memberFilterOptions = members
    .filter((m) => m.archived_at == null)
    .map((m) => ({
      value: m.id,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar
            size={16}
            style={{ backgroundColor: m.color ?? '#aaa', color: '#fff', fontSize: 8, fontWeight: 700 }}
          >
            {m.initials}
          </Avatar>
          {m.name}
        </span>
      ),
    }))

  const sourceOptions = [
    { value: 'all', label: 'All Sources' },
    { value: 'manual', label: 'Manual' },
    { value: 'recurring', label: 'Recurring' },
  ]

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'expected', label: 'Expected' },
    { value: 'confirmed', label: 'Confirmed' },
  ]

  const reconciledOptions = [
    { value: 'all', label: 'All Reconciled' },
    { value: 'reconciled', label: 'Reconciled' },
    { value: 'unreconciled', label: 'Unreconciled' },
  ]

  const showStatusFilter = filters.source == null || filters.source === 'all' || filters.source === 'recurring'

  return (
    <Space wrap align="center">
      <Select
        style={{ minWidth: 180 }}
        placeholder="All Categories"
        allowClear
        showSearch
        value={filters.category_id ?? undefined}
        onChange={(val) => onFilterChange({ ...filters, category_id: val })}
        onClear={() => onFilterChange({ ...filters, category_id: undefined })}
        options={categoryOptions}
        filterOption={(input, option) =>
          (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase())
        }
      />
      <Select
        style={{ minWidth: 160 }}
        placeholder="All Payees"
        allowClear
        showSearch
        value={filters.vendor_id ?? undefined}
        onChange={(val) => onFilterChange({ ...filters, vendor_id: val })}
        onClear={() => onFilterChange({ ...filters, vendor_id: undefined })}
        options={vendorOptions}
        filterOption={(input, option) =>
          (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase())
        }
      />
      {hasMembers && (
        <Select
          style={{ minWidth: 150 }}
          placeholder={
            <span>
              <TeamOutlined style={{ marginRight: 6 }} />
              All Members
            </span>
          }
          allowClear
          value={filters.member_id ?? undefined}
          onChange={(val) => onFilterChange({ ...filters, member_id: val })}
          onClear={() => onFilterChange({ ...filters, member_id: undefined })}
          options={memberFilterOptions}
        />
      )}
      <Input.Search
        style={{ width: 200 }}
        placeholder="Search descriptions..."
        allowClear
        value={filters.search ?? ''}
        onChange={(e) =>
          onFilterChange({ ...filters, search: e.target.value || undefined })
        }
        onSearch={(val) => onFilterChange({ ...filters, search: val || undefined })}
      />
      <InputNumber
        style={{ width: 110 }}
        prefix="$"
        precision={2}
        min={0}
        placeholder="Min amount"
        value={filters.amount_min != null ? filters.amount_min / 100 : null}
        onChange={(val) =>
          onFilterChange({
            ...filters,
            amount_min: val != null ? Math.round(val * 100) : undefined,
          })
        }
      />
      <InputNumber
        style={{ width: 110 }}
        prefix="$"
        precision={2}
        min={0}
        placeholder="Max amount"
        value={filters.amount_max != null ? filters.amount_max / 100 : null}
        onChange={(val) =>
          onFilterChange({
            ...filters,
            amount_max: val != null ? Math.round(val * 100) : undefined,
          })
        }
      />
      <Select
        style={{ minWidth: 140 }}
        value={filters.source ?? 'all'}
        onChange={(val) =>
          onFilterChange({
            ...filters,
            source: val === 'all' ? undefined : val,
            recurring_status: val === 'manual' ? undefined : filters.recurring_status,
          })
        }
        options={sourceOptions}
      />
      {showStatusFilter && (
        <Select
          style={{ minWidth: 150 }}
          value={filters.recurring_status ?? 'all'}
          onChange={(val) =>
            onFilterChange({
              ...filters,
              recurring_status: val === 'all' ? undefined : val,
            })
          }
          options={statusOptions}
        />
      )}
      <Select
        style={{ minWidth: 150 }}
        value={filters.reconciled_status ?? 'all'}
        onChange={(val) =>
          onFilterChange({
            ...filters,
            reconciled_status: val === 'all' ? undefined : val,
          })
        }
        options={reconciledOptions}
      />
      {hasActiveFilters && (
        <Button size="small" onClick={() => onFilterChange({})}>
          Clear Filters
        </Button>
      )}
    </Space>
  )
}
