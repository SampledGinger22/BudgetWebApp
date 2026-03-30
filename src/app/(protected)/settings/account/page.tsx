'use client'

import { Button, Card, Form, Input, Space, Typography } from 'antd'
import { UserOutlined, LockOutlined, LinkOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth-store'
import { COLORS } from '@/theme'

const { Title, Text } = Typography

export default function AccountSettingsPage(): React.JSX.Element {
  const user = useAuthStore((s) => s.user)

  return (
    <Space orientation="vertical" size={24} style={{ width: '100%', maxWidth: 500 }}>
      <div>
        <Title level={4} style={{ margin: 0, color: COLORS.walnut }}>Account</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Manage your personal account settings.
        </Text>
      </div>

      {/* Current user info */}
      <Card size="small">
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <UserOutlined style={{ fontSize: 20, color: COLORS.terracotta }} />
            <div>
              <Text strong style={{ display: 'block', color: COLORS.walnut }}>
                {user?.name ?? 'Unknown User'}
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {user?.email ?? 'No email'}
              </Text>
            </div>
          </div>
        </Space>
      </Card>

      {/* Change Password — form stub */}
      <div>
        <Space style={{ marginBottom: 12 }}>
          <LockOutlined style={{ color: COLORS.walnut }} />
          <Text strong style={{ color: COLORS.walnut }}>Change Password</Text>
        </Space>
        <Card size="small">
          <Form layout="vertical">
            <Form.Item label="Current Password" name="current_password">
              <Input.Password placeholder="Enter current password" disabled />
            </Form.Item>
            <Form.Item label="New Password" name="new_password">
              <Input.Password placeholder="Enter new password" disabled />
            </Form.Item>
            <Form.Item label="Confirm New Password" name="confirm_password">
              <Input.Password placeholder="Confirm new password" disabled />
            </Form.Item>
            <Button type="primary" disabled style={{ backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta }}>
              Update Password
            </Button>
          </Form>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            Password change functionality will be available in a future update.
          </Text>
        </Card>
      </div>

      {/* Linked OAuth Accounts — display only */}
      <div>
        <Space style={{ marginBottom: 12 }}>
          <LinkOutlined style={{ color: COLORS.walnut }} />
          <Text strong style={{ color: COLORS.walnut }}>Linked Accounts</Text>
        </Space>
        <Card size="small">
          <Text type="secondary">
            OAuth account linking will be available in a future update. Currently, your account is
            managed through the primary authentication provider.
          </Text>
        </Card>
      </div>
    </Space>
  )
}
