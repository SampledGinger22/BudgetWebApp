'use client'

import { useEffect } from 'react'
import { Modal, Form, Input, Select, Typography, message } from 'antd'
import type { Category, CategoryGroup } from '@/lib/api/types'
import { COLORS } from '@/theme'

const { Text } = Typography

interface CategoryModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editCategory?: Category | null
  groups: CategoryGroup[]
  parentCategory?: Category | null
  onCreateCategory: (data: {
    category_group_id: number
    parent_id: number | null
    name: string
    ref_number: string | null
  }) => Promise<void>
  onUpdateCategory: (id: number, data: { name: string; ref_number: string | null }) => Promise<void>
}

interface FormValues {
  name: string
  category_group_id: number
  parent_id: number | null
  ref_number: string
}

const REF_NUMBER_PATTERN = /^[0-9_-]+$/

export function CategoryModal({
  open,
  onClose,
  onSuccess,
  editCategory,
  groups,
  parentCategory,
  onCreateCategory,
  onUpdateCategory,
}: CategoryModalProps): React.JSX.Element {
  const [form] = Form.useForm<FormValues>()
  const isEditing = !!editCategory

  useEffect(() => {
    if (!open) return

    if (editCategory) {
      form.setFieldsValue({
        name: editCategory.name,
        category_group_id: editCategory.category_group_id,
        parent_id: editCategory.parent_id,
        ref_number: editCategory.ref_number ?? '',
      })
    } else if (parentCategory) {
      form.setFieldsValue({
        name: '',
        category_group_id: parentCategory.category_group_id,
        parent_id: parentCategory.id,
        ref_number: '',
      })
    } else {
      form.resetFields()
    }
  }, [open, editCategory, parentCategory, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()

      if (isEditing && editCategory) {
        try {
          await onUpdateCategory(editCategory.id, {
            name: values.name,
            ref_number: values.ref_number || null,
          })
          onSuccess()
          onClose()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Update failed'
          if (msg.includes('already in use')) {
            form.setFields([{ name: 'ref_number', errors: ['Reference number already in use'] }])
          } else {
            void message.error(msg)
          }
        }
      } else {
        try {
          await onCreateCategory({
            category_group_id: parentCategory?.category_group_id ?? values.category_group_id,
            parent_id: parentCategory?.id ?? values.parent_id ?? null,
            name: values.name,
            ref_number: values.ref_number || null,
          })
          onSuccess()
          onClose()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Create failed'
          if (msg.includes('already in use')) {
            form.setFields([{ name: 'ref_number', errors: ['Reference number already in use'] }])
          } else {
            void message.error(msg)
          }
        }
      }
    } catch {
      // Validation failed
    }
  }

  const isSubCategory = !!parentCategory || (editCategory?.parent_id != null)

  const groupOptions = groups.map((g) => ({ label: g.name, value: g.id }))

  const selectedGroupId = Form.useWatch('category_group_id', form) as number | undefined
  const topLevelCategoryOptions = groups
    .find((g) => g.id === selectedGroupId)
    ?.categories.filter((c) => c.parent_id === null && c.id !== editCategory?.id)
    .map((c) => ({ label: c.name, value: c.id })) ?? []

  const title = isEditing
    ? `Edit Category: ${editCategory?.name}`
    : parentCategory
    ? `Add Sub-category to "${parentCategory.name}"`
    : 'Add Category'

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText={isEditing ? 'Save Changes' : 'Add Category'}
      okButtonProps={{ style: { backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta } }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Category name is required' }]}>
          <Input placeholder="e.g. Groceries" autoFocus />
        </Form.Item>

        <Form.Item label="Group" name="category_group_id" rules={[{ required: true, message: 'Please select a group' }]}>
          <Select options={groupOptions} placeholder="Select group" disabled={isSubCategory} />
        </Form.Item>

        {!isSubCategory && (
          <Form.Item label="Parent Category" name="parent_id">
            <Select options={topLevelCategoryOptions} placeholder="None (top-level category)" allowClear />
          </Form.Item>
        )}

        <Form.Item
          label="Reference Number"
          name="ref_number"
          rules={[{ pattern: REF_NUMBER_PATTERN, message: 'Only numbers, underscores, and hyphens are allowed' }]}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Auto-generated if left blank. Only 0-9, _, and - are allowed.
            </Text>
          }
        >
          <Input placeholder="e.g. 100" maxLength={20} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CategoryModal
