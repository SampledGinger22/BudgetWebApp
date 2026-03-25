import type { Metadata } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import { PostHogProvider, PostHogPageView } from '@posthog/next'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@/theme/global.css'
import { earthyTheme } from '@/theme'
import { SessionProvider } from 'next-auth/react'
import { QueryProvider } from '@/providers/query-provider'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'PersonalBudget',
  description:
    'A web-based budgeting application with envelope-style budgeting tied to paycheck periods',
}

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

/**
 * Root layout — provider hierarchy:
 *   SessionProvider → PostHogProvider (conditional) → QueryProvider → AntdRegistry → ConfigProvider
 *
 * PostHogProvider only initializes when NEXT_PUBLIC_POSTHOG_KEY is set.
 * PostHogPageView is mounted inside the provider for automatic route tracking.
 *
 * Observability:
 *   - PostHog toolbar available in dev when key is configured
 *   - usePostHog() returns undefined when PostHog is not initialized (no key)
 *   - Page view events auto-tracked via PostHogPageView on route changes
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const appContent = (
    <QueryProvider>
      <AntdRegistry>
        <ConfigProvider theme={earthyTheme}>{children}</ConfigProvider>
      </AntdRegistry>
    </QueryProvider>
  )

  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {posthogKey ? (
            <PostHogProvider
              clientOptions={{ api_host: '/ingest' }}
              bootstrapFlags
            >
              <Suspense fallback={null}>
                <PostHogPageView />
              </Suspense>
              {appContent}
            </PostHogProvider>
          ) : (
            appContent
          )}
        </SessionProvider>
      </body>
    </html>
  )
}
