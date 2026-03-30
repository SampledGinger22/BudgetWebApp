'use client'

import { useEffect, useState, useMemo } from 'react'
import { Form, Input, Modal, Select } from 'antd'
import type { Vendor, CategoryGroup } from '@/lib/api/types'
import { useCategories } from '@/lib/api/categories'
import { useCreateVendor, useUpdateVendor } from '@/lib/api/vendors'
import { COLORS } from '@/theme'

interface VendorModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editVendor?: Vendor | null
}

interface FlatCategory {
  id: number
  label: string
}

function buildFlatCategories(groups: CategoryGroup[]): FlatCategory[] {
  const flat: FlatCategory[] = []
  for (const group of groups) {
    for (const cat of group.categories) {
      if (cat.archived_at) continue
      if (cat.sub_categories && cat.sub_categories.length > 0) {
        for (const sub of cat.sub_categories) {
          if (sub.archived_at) continue
          flat.push({ id: sub.id, label: `${group.name} > ${cat.name} > ${sub.name}` })
        }
      } else {
        flat.push({ id: cat.id, label: `${group.name} > ${cat.name}` })
      }
    }
  }
  return flat
}

export function VendorModal({ open, onClose, onSuccess, editVendor }: VendorModalProps): React.JSX.Element {
  const [form] = Form.useForm()
  const { data: groups = [], isLoading: categoriesLoading } = useCategories()
  const createVendor = useCreateVendor()
  const updateVendor = useUpdateVendor()

  const categories = useMemo(() => buildFlatCategories(groups), [groups])

  useEffect(() => {
    if (open) {
      if (editVendor) {
        form.setFieldsValue({
          name: editVendor.name,
          default_category_id: editVendor.default_category_id ?? undefined,
        })
      } else {
        form.resetFields()
      }
    }
  }, [open, editVendor, form])

  const handleOk = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      const payload = {
        name: values.name as string,
        default_category_id: (values.default_category_id as number | undefined) ?? null,
      }

      if (editVendor) {
        await updateVendor.mutateAsync({ id: editVendor.id, ...payload })
      } else {
        await createVendor.mutateAsync(payload)
      }

      form.resetFields()
      onSuccess()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      throw err
    }
  }

  const handleCancel = (): void => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title={editVendor ? 'Edit Payee' : 'Add Payee'}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={editVendor ? 'Save Changes' : 'Add'}
      okButtonProps={{
        loading: createVendor.isPending || updateVendor.isPending,
        style: { backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta },
      }}
      afterClose={() => form.resetFields()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter a name' }]}>
          <Input placeholder="e.g., Walmart, Netflix, City Water" />
        </Form.Item>

        <Form.Item name="default_category_id" label="Default Category">
          <Select
            allowClear
            showSearch
            loading={categoriesLoading}
            placeholder="None — select a category to auto-suggest during transaction entry"
            optionFilterProp="label"
            options={categories.map((c) => ({ value: c.id, label: c.label }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default VendorModal
