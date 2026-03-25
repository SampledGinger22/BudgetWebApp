'use client'

import { useState } from 'react'
import { Divider, Select, Space, Switch, Typography } from 'antd'
import { useSetting, useUpdateSetting } from '@/lib/api/settings'
import { COLORS } from '@/theme'

const { Title, Text } = Typography

const SETTING_RECURRING_ENABLED = 'recurring_reminders_enabled'
const SETTING_RECURRING_PERSISTENCE = 'recurring_banner_persistence'
const SETTING_PERIOD_CLOSE = 'period_close_reminders'
const SETTING_PERIOD_LOCK = 'period_lock_reminders'

export default function NotificationsPage(): React.JSX.Element {
  const { data: periodCloseData } = useSetting(SETTING_PERIOD_CLOSE)
  const { data: periodLockData } = useSetting(SETTING_PERIOD_LOCK)
  const { data: recurringEnabledData, isLoading: loadingRecurring } = useSetting(SETTING_RECURRING_ENABLED)
  const { data: recurringPersistenceData } = useSetting(SETTING_RECURRING_PERSISTENCE)
  const updateSetting = useUpdateSetting()

  const periodCloseReminders = periodCloseData?.value !== 'false'
  const periodLockReminders = periodLockData?.value !== 'false'
  const recurringRemindersEnabled = recurringEnabledData?.value !== 'false'
  const recurringPersistence: 'persist' | 'session' = recurringPersistenceData?.value === 'session' ? 'session' : 'persist'

  // Local optimistic state for immediate UI feedback
  const [localPeriodClose, setLocalPeriodClose] = useState<boolean | null>(null)
  const [localPeriodLock, setLocalPeriodLock] = useState<boolean | null>(null)
  const [localRecurringEnabled, setLocalRecurringEnabled] = useState<boolean | null>(null)
  const [localPersistence, setLocalPersistence] = useState<'persist' | 'session' | null>(null)

  const effectivePeriodClose = localPeriodClose ?? periodCloseReminders
  const effectivePeriodLock = localPeriodLock ?? periodLockReminders
  const effectiveRecurringEnabled = localRecurringEnabled ?? recurringRemindersEnabled
  const effectivePersistence = localPersistence ?? recurringPersistence

  const handleTogglePeriodClose = async (checked: boolean): Promise<void> => {
    setLocalPeriodClose(checked)
    await updateSetting.mutateAsync({ key: SETTING_PERIOD_CLOSE, value: String(checked) })
    setLocalPeriodClose(null)
  }

  const handleTogglePeriodLock = async (checked: boolean): Promise<void> => {
    setLocalPeriodLock(checked)
    await updateSetting.mutateAsync({ key: SETTING_PERIOD_LOCK, value: String(checked) })
    setLocalPeriodLock(null)
  }

  const handleToggleRecurringReminders = async (checked: boolean): Promise<void> => {
    setLocalRecurringEnabled(checked)
    await updateSetting.mutateAsync({ key: SETTING_RECURRING_ENABLED, value: String(checked) })
    setLocalRecurringEnabled(null)
  }

  const handleChangePersistence = async (value: 'persist' | 'session'): Promise<void> => {
    setLocalPersistence(value)
    await updateSetting.mutateAsync({ key: SETTING_RECURRING_PERSISTENCE, value })
    setLocalPersistence(null)
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%', maxWidth: 480 }}>
      <Title level={4} style={{ margin: 0, color: COLORS.walnut }}>Notifications</Title>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <Text strong style={{ color: COLORS.walnut, display: 'block' }}>Period close reminders</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Show a banner when a budget period&apos;s end date has passed and it hasn&apos;t been closed.
            </Text>
          </div>
          <Switch checked={effectivePeriodClose} onChange={(checked) => void handleTogglePeriodClose(checked)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <Text strong style={{ color: COLORS.walnut, display: 'block' }}>Period lock reminders</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Show a banner when a closed period hasn&apos;t been locked for 3 or more days.
            </Text>
          </div>
          <Switch checked={effectivePeriodLock} onChange={(checked) => void handleTogglePeriodLock(checked)} />
        </div>
      </Space>

      <Divider style={{ margin: '4px 0' }} />

      <div>
        <Title level={5} style={{ margin: '0 0 12px', color: COLORS.walnut }}>
          Recurring Transaction Reminders
        </Title>

        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <Text strong style={{ color: COLORS.walnut, display: 'block' }}>Show confirmation reminders</Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Show a banner when there are past-due unconfirmed recurring entries awaiting review.
              </Text>
            </div>
            <Switch
              checked={effectiveRecurringEnabled}
              onChange={(checked) => void handleToggleRecurringReminders(checked)}
              loading={loadingRecurring}
            />
          </div>

          {effectiveRecurringEnabled && (
            <div>
              <Text strong style={{ color: COLORS.walnut, display: 'block', marginBottom: 6 }}>Reminder persistence</Text>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                Controls whether the reminder banner can be dismissed until the next app launch.
              </Text>
              <Select<'persist' | 'session'>
                value={effectivePersistence}
                onChange={(val) => void handleChangePersistence(val)}
                style={{ width: '100%' }}
                options={[
                  { value: 'persist' as const, label: 'Persist until resolved — banner reappears on every page load' },
                  { value: 'session' as const, label: 'Dismiss per session — can be dismissed, reappears next app open' },
                ]}
              />
            </div>
          )}
        </Space>
      </div>
    </Space>
  )
}
