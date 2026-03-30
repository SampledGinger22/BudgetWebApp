'use client'

import { useState, useMemo } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  message,
  Progress,
  Space,
} from 'antd'
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons'
import Link from 'next/link'
import { COLORS } from '@/theme'

const { Title, Text } = Typography

interface RegisterValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}

interface StrengthCheck {
  label: string
  test: (pw: string) => boolean
}

const PASSWORD_CHECKS: StrengthCheck[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One number', test: (pw) => /\d/.test(pw) },
  { label: 'One special character', test: (pw) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw) },
]

function PasswordStrengthIndicator({ password }: { password: string }) {
  const passedCount = useMemo(
    () => PASSWORD_CHECKS.filter((c) => c.test(password)).length,
    [password],
  )

  const percent = (passedCount / PASSWORD_CHECKS.length) * 100
  const strokeColor =
    passedCount <= 1
      ? COLORS.warmRed
      : passedCount <= 2
        ? COLORS.copper
        : passedCount <= 3
          ? COLORS.oak
          : COLORS.sage

  if (!password) return null

  return (
    <div style={{ marginTop: -4, marginBottom: 8 }}>
      <Progress
        percent={percent}
        showInfo={false}
        strokeColor={strokeColor}
        railColor="rgba(92, 61, 30, 0.08)"
        size="small"
        style={{ marginBottom: 8 }}
      />
      <Space orientation="vertical" size={2}>
        {PASSWORD_CHECKS.map((check) => {
          const passed = check.test(password)
          return (
            <Text
              key={check.label}
              style={{
                fontSize: 12,
                color: passed ? COLORS.sage : 'rgba(92, 61, 30, 0.45)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color 0.15s ease',
              }}
            >
              {passed ? (
                <CheckCircleFilled style={{ fontSize: 12 }} />
              ) : (
                <CloseCircleFilled style={{ fontSize: 12 }} />
              )}
              {check.label}
            </Text>
          )
        })}
      </Space>
    </div>
  )
}

export default function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')

  const handleRegister = async (values: RegisterValues) => {
    if (values.password !== values.confirmPassword) {
      message.error('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
        }),
      })

      if (res.status === 409) {
        message.error('An account with this email already exists.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        message.error(data?.error ?? 'Registration failed. Please try again.')
        setLoading(false)
        return
      }

      // Auto-sign in after successful registration
      const signInResult = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      })

      if (signInResult?.error) {
        // Registration succeeded but auto-login failed — send to login
        message.success('Account created! Please sign in.')
        router.push('/login')
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

  return (
    <Card
      style={{
        maxWidth: 420,
        width: '100%',
        borderRadius: 12,
        boxShadow:
          '0 2px 8px rgba(92, 61, 30, 0.08), 0 8px 24px rgba(92, 61, 30, 0.06)',
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
          Create your account
        </Title>
        <Text
          style={{
            color: COLORS.copper,
            fontSize: 14,
            marginTop: 6,
            display: 'block',
          }}
        >
          Get started with PersonalBudget
        </Text>
      </div>

      <Form<RegisterValues>
        layout="vertical"
        onFinish={handleRegister}
        requiredMark={false}
        size="large"
      >
        <Form.Item
          name="name"
          rules={[{ required: true, message: 'Please enter your name' }]}
        >
          <Input
            prefix={<UserOutlined style={{ color: COLORS.copper }} />}
            placeholder="Full name"
            autoComplete="name"
            style={{ borderRadius: 8, height: 44 }}
          />
        </Form.Item>

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
          rules={[
            { required: true, message: 'Please enter a password' },
            { min: 8, message: 'Password must be at least 8 characters' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: COLORS.copper }} />}
            placeholder="Password"
            autoComplete="new-password"
            style={{ borderRadius: 8, height: 44 }}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Form.Item>

        <PasswordStrengthIndicator password={password} />

        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('Passwords do not match'))
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: COLORS.copper }} />}
            placeholder="Confirm password"
            autoComplete="new-password"
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
              transition:
                'background-color 0.15s ease, transform 0.15s ease',
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
            Create account
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center' }}>
        <Text style={{ color: COLORS.copper, fontSize: 14 }}>
          Already have an account?{' '}
          <Link
            href="/login"
            style={{ color: COLORS.terracotta, fontWeight: 600 }}
          >
            Sign in
          </Link>
        </Text>
      </div>
    </Card>
  )
}
