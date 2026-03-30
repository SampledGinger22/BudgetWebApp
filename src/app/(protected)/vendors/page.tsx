'use client'

import { useState } from 'react'
import { Button, Space, Spin, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useVendors, useArchiveVendor, useDeleteVendor } from '@/lib/api/vendors'
import type { Vendor } from '@/lib/api/types'
import { VendorList } from '@/components/vendors/VendorList'
import { VendorModal } from '@/components/vendors/VendorModal'
import { COLORS } from '@/theme'

const { Title } = Typography

export default function VendorsPage(): React.JSX.Element {
  const { data: vendors = [], isLoading } = useVendors()
  const archiveVendor = useArchiveVendor()
  const deleteVendor = useDeleteVendor()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const handleAddVendor = (): void => {
    setEditingVendor(null)
    setModalOpen(true)
  }

  const handleEdit = (vendor: Vendor): void => {
    setEditingVendor(vendor)
    setModalOpen(true)
  }

  const handleModalClose = (): void => {
    setModalOpen(false)
    setEditingVendor(null)
  }

  const handleModalSuccess = (): void => {
    setModalOpen(false)
    setEditingVendor(null)
  }

  const handleArchive = async (id: number): Promise<void> => {
    try {
      await archiveVendor.mutateAsync({ id })
      message.success('Payee archived')
    } catch {
      message.error('Failed to archive payee')
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    try {
      await deleteVendor.mutateAsync({ id })
      message.success('Payee deleted')
    } catch {
      message.error('Failed to delete payee')
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0, color: COLORS.walnut }}>Payees</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVendor}>
          Add Payee
        </Button>
      </div>

      <VendorList
        vendors={vendors}
        loading={isLoading}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
        onEdit={handleEdit}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onAddVendor={handleAddVendor}
      />

      <VendorModal
        open={modalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        editVendor={editingVendor}
      />
    </Space>
  )
}
