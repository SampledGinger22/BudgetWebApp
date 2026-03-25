'use client'

import { useState } from 'react'
import { Alert, Button } from 'antd'
import { useRouter } from 'next/navigation'
import { useUnconfirmedCount } from '@/lib/api/recurring'
import { useSetting } from '@/lib/api/settings'

const SETTING_ENABLED = 'recurring_reminders_enabled'
const SETTING_PERSISTENCE = 'recurring_banner_persistence'

/**
 * Banner shown in AppShell when there are past-due unconfirmed recurring entries.
 * Controlled by notification settings:
 *   - recurring_reminders_enabled: 'true' (default) or 'false'
 *   - recurring_banner_persistence: 'persist' (default) or 'session'
 */
export function RecurringConfirmBanner(): React.JSX.Element | null {
  const router = useRouter()
  const { data: countResp } = useUnconfirmedCount()
  const { data: enabledSetting } = useSetting(SETTING_ENABLED)
  const { data: persistSetting } = useSetting(SETTING_PERSISTENCE)
  const [sessionDismissed, setSessionDismissed] = useState(false)

  const unconfirmedCount = countResp?.count ?? 0
  const remindersEnabled = enabledSetting?.value == null ? true : enabledSetting.value === 'true'
  const persistence = persistSetting?.value === 'session' ? 'session' : 'persist'

  // Don't show if reminders are disabled
  if (!remindersEnabled) return null

  // Don't show if no unconfirmed entries
  if (unconfirmedCount === 0) return null

  // Don't show if session-dismissed
  if (persistence === 'session' && sessionDismissed) return null

  return (
    <Alert
      type="warning"
      showIcon
      closable={persistence === 'session'}
      onClose={() => setSessionDismissed(true)}
      message={`You have ${unconfirmedCount} unconfirmed recurring entr${unconfirmedCount === 1 ? 'y' : 'ies'} past their scheduled date`}
      action={
        <Button
          size="small"
          type="link"
          onClick={() => router.push('/transactions?source=recurring&status=expected')}
        >
          Review now
        </Button>
      }
      style={{ marginBottom: 0 }}
    />
  )
}

export default RecurringConfirmBanner
