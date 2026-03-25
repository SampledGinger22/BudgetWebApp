'use client'

import React from 'react'
import { Button, Result } from 'antd'
import { COLORS } from '@/theme'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export class RootErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[RootErrorBoundary]', error, info.componentStack)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.cream,
          }}
        >
          <Result
            status="error"
            title="Something went wrong"
            subTitle="The application encountered an unexpected error."
            extra={
              <Button type="primary" onClick={() => window.location.reload()}>
                Reload App
              </Button>
            }
          />
        </div>
      )
    }

    return this.props.children
  }
}
