'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, Form, Input, Button, Divider, Typography, message, Space } from 'antd'
import { GoogleOutlined, WindowsOutlined, MailOutlined, LockOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { COLORS } from '@/theme'

const { Title, Text } = Typography

interface LoginValues {
  email: string
  password: string
}

export default function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)

  const handleCredentialsLogin = async (values: LoginValues) => {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      })

      if (result?.error) {
        message.error('Invalid email or password. Please try again.')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      message.error('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = (provider: string) => {
    setOauthLoading(provider)
    signIn(provider, { callbackUrl: '/' })
  }

  return (
    <Card
      style={{
        maxWidth: 420,
        width: '100%',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(92, 61, 30, 0.08), 0 8px 24px rgba(92, 61, 30, 0.06)',
        border: `1px solid rgba(92, 61, 30, 0.08)`,
      }}
      styles={{ body: { padding: '40px 32px 32px' } }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title
          level={3}
          style={{
            margin: 0,
            color: COLORS.walnut,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            textWrap: 'balance',
          }}
        >
          Welcome back
        </Title>
        <Text
          style={{
            color: COLORS.copper,
            fontSize: 14,
            marginTop: 6,
            display: 'block',
          }}
        >
          Sign in to PersonalBudget
        </Text>
      </div>

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Button
          block
          size="large"
          icon={<GoogleOutlined />}
          loading={oauthLoading === 'google'}
          onClick={() => handleOAuthLogin('google')}
          style={{
            height: 44,
            borderRadius: 8,
            borderColor: 'rgba(92, 61, 30, 0.15)',
            fontWeight: 500,
            transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
          }}
          onMouseDown={(e) => {
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(0.96)'
          }}
          onMouseUp={(e) => {
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
          }}
        >
          Sign in with Google
        </Button>

        <Button
          block
          size="large"
          icon={<WindowsOutlined />}
          loading={oauthLoading === 'microsoft-entra-id'}
          onClick={() => handleOAuthLogin('microsoft-entra-id')}
          style={{
            height: 44,
            borderRadius: 8,
            borderColor: 'rgba(92, 61, 30, 0.15)',
            fontWeight: 500,
            transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
          }}
          onMouseDown={(e) => {
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(0.96)'
          }}
          onMouseUp={(e) => {
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
          }}
        >
          Sign in with Microsoft
        </Button>
      </Space>

      <Divider
        style={{
          margin: '24px 0',
          borderColor: 'rgba(92, 61, 30, 0.1)',
          fontSize: 13,
          color: COLORS.copper,
        }}
      >
        or continue with email
      </Divider>

      <Form<LoginValues>
        layout="vertical"
        onFinish={handleCredentialsLogin}
        requiredMark={false}
        size="large"
      >
        <Form.Item
          name="email"
          rules={[
            { required: true, message: 'Please enter your email' },
            { type: 'email', message: 'Please enter a valid email' },
          ]}
        >
          <Input
            prefix={<MailOutlined style={{ color: COLORS.copper }} />}
            placeholder="Email address"
            type="email"
            autoComplete="email"
            style={{ borderRadius: 8, height: 44 }}
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: 'Please enter your password' }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: COLORS.copper }} />}
            placeholder="Password"
            autoComplete="current-password"
            style={{ borderRadius: 8, height: 44 }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            style={{
              height: 44,
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              transition: 'background-color 0.15s ease, transform 0.15s ease',
            }}
            onMouseDown={(e) => {
              ;(e.currentTarget as HTMLElement).style.transform = 'scale(0.96)'
            }}
            onMouseUp={(e) => {
              ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
            }}
          >
            Sign in
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center' }}>
        <Text style={{ color: COLORS.copper, fontSize: 14 }}>
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            style={{ color: COLORS.terracotta, fontWeight: 600 }}
          >
            Sign up
          </Link>
        </Text>
      </div>
    </Card>
  )
}
