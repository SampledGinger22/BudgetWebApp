'use client'

import React from 'react'
import { Button, Result } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { COLORS } from '@/theme'

interface Props {
  children: React.ReactNode
  label?: string
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const { label } = this.props
    console.error(`[ErrorBoundary:${label ?? 'unknown'}]`, error, info.componentStack)
  }

  reset(): void {
    this.setState({ hasError: false })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      const { label } = this.props
      return (
        <div
          style={{
            padding: 16,
            background: COLORS.creamDark,
            borderRadius: 6,
            border: `1px solid ${COLORS.terracotta}`,
          }}
        >
          <Result
            icon={<ExclamationCircleOutlined style={{ color: COLORS.terracotta }} />}
            title="Something went wrong"
            subTitle={`The ${label ?? 'section'} failed to load.`}
            extra={<Button onClick={() => this.reset()}>Try Again</Button>}
            style={{ padding: '16px 0' }}
          />
        </div>
      )
    }

    return this.props.children
  }
}
