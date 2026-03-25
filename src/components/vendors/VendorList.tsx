'use client'

import { useState } from 'react'
import { Button, Dropdown, Empty, Input, Switch, Table, Tag, Typography } from 'antd'
import type { MenuProps, TableColumnsType } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { Vendor } from '@/lib/api/types'
import { COLORS } from '@/theme'

const { Text } = Typography
const { Search } = Input

interface VendorListProps {
  vendors: Vendor[]
  loading: boolean
  showArchived: boolean
  onShowArchivedChange: (show: boolean) => void
  onEdit: (vendor: Vendor) => void
  onArchive: (id: number) => void
  onDelete: (id: number) => void
  onAddVendor: () => void
}

export function VendorList({
  vendors,
  loading,
  showArchived,
  onShowArchivedChange,
  onEdit,
  onArchive,
  onDelete,
  onAddVendor,
}: VendorListProps): React.JSX.Element {
  const [searchText, setSearchText] = useState('')

  const hasArchived = vendors.some((v) => v.archived_at != null)

  const filtered = vendors.filter((v) => {
    if (!showArchived && v.archived_at != null) return false
    if (searchText.trim()) {
      return v.name.toLowerCase().includes(searchText.toLowerCase())
    }
    return true
  })

  const columns: TableColumnsType<Vendor> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      defaultSortOrder: 'ascend',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, record: Vendor) => (
        <Text
          strong
          style={{
            opacity: record.archived_at ? 0.5 : 1,
            fontStyle: record.archived_at ? 'italic' : 'normal',
          }}
        >
          {name}
          {record.archived_at && (
            <Tag color="default" style={{ marginLeft: 8, fontSize: 11 }}>Archived</Tag>
          )}
        </Text>
      ),
    },
    {
      title: 'Default Category',
      dataIndex: 'default_category_name',
      key: 'default_category_name',
      render: (name: string | null, record: Vendor) => (
        <Text style={{ color: name ? undefined : '#aaa', opacity: record.archived_at ? 0.5 : 1 }}>
          {name ?? 'None'}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 60,
      align: 'right' as const,
      render: (_: unknown, record: Vendor) => {
        const menuItems: MenuProps['items'] = [
          { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => onEdit(record) },
          ...(!record.archived_at
            ? [{ key: 'archive', icon: <InboxOutlined />, label: 'Archive', onClick: () => onArchive(record.id) }]
            : []),
          ...(record.archived_at
            ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true as const, onClick: () => onDelete(record.id) }]
            : []),
        ]
        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreOutlined />} size="small" />
          </Dropdown>
        )
      },
    },
  ]

  if (vendors.length === 0 && !loading) {
    return (
      <Empty
        description={
          <span>
            Add your first payee to get started.
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>
              Payees help auto-suggest categories during transaction entry.
            </Text>
          </span>
        }
        style={{ padding: '40px 0' }}
      >
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={onAddVendor}>
          Add Payee
        </Button>
      </Empty>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Search
          placeholder="Search payees..."
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        {hasArchived && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={showArchived} onChange={onShowArchivedChange} size="small" />
            <Text style={{ fontSize: 13, color: COLORS.walnut }}>Show archived</Text>
          </div>
        )}
      </div>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
        rowClassName={(record) => (record.archived_at ? 'vendor-row-archived' : '')}
      />
    </div>
  )
}

export default VendorList
