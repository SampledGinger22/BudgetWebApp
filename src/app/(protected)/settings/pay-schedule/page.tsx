'use client'

import { useState, useMemo } from 'react'
import { Alert, Button, Checkbox, Collapse, Divider, Modal, Skeleton, Space, Typography, message } from 'antd'
import { PlusOutlined, SyncOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSchedules, usePeriods, useCreateSchedule, useUpdateSchedule, useDeleteSchedule, useSetPrimarySchedule, useRegeneratePeriods, useDeletePeriod } from '@/lib/api/periods'
import { PayScheduleCard, scheduleCollapseHeader } from '@/components/periods/PayScheduleCard'
import { AddScheduleForm } from '@/components/periods/PayScheduleForm'
import { PeriodTimeline } from '@/components/periods/PeriodTimeline'
import { PeriodTimelinePreview } from '@/components/periods/PeriodTimelinePreview'
import { COLORS } from '@/theme'

const { Title, Text } = Typography

export default function PaySchedulePage(): React.JSX.Element {
  const { data: schedulesResp, isLoading: loadingSchedules } = useSchedules()
  const { data: periodsResp, isLoading: loadingPeriods } = usePeriods()
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const setPrimarySchedule = useSetPrimarySchedule()
  const regeneratePeriods = useRegeneratePeriods()
  const deletePeriod = useDeletePeriod()

  const schedules = schedulesResp?.data ?? []
  const periods = periodsResp?.data ?? []

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [periodsModalOpen, setPeriodsModalOpen] = useState(false)
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<Set<number>>(new Set())

  const loading = loadingSchedules || loadingPeriods

  const futurePeriods = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD')
    return periods.filter((p) => p.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date))
  }, [periods])

  const handleGenerate = async (): Promise<void> => {
    try {
      await regeneratePeriods.mutateAsync()
      void message.success('Periods regenerated successfully')
    } catch {
      void message.error('Failed to generate periods')
    }
  }

  const handleAddSchedule = async (data: Record<string, unknown>): Promise<void> => {
    try {
      await createSchedule.mutateAsync(data as Parameters<typeof createSchedule.mutateAsync>[0])
      setAddModalOpen(false)
      void message.success('Schedule created')
    } catch {
      void message.error('Failed to create schedule')
    }
  }

  const handleSaveSchedule = async (id: number, data: Record<string, unknown>): Promise<void> => {
    await updateSchedule.mutateAsync({ id, ...data } as Parameters<typeof updateSchedule.mutateAsync>[0])
    if (futurePeriods.length > 0) {
      setSelectedPeriodIds(new Set(futurePeriods.map((p) => p.id)))
      setPeriodsModalOpen(true)
    }
  }

  const handlePeriodsUpdate = async (): Promise<void> => {
    setPeriodsModalOpen(false)
    if (selectedPeriodIds.size === 0) return
    for (const periodId of selectedPeriodIds) {
      try { await deletePeriod.mutateAsync({ id: periodId }) } catch { /* skip */ }
    }
    await handleGenerate()
  }

  const handleDeleteSchedule = async (id: number): Promise<void> => {
    await deleteSchedule.mutateAsync({ id })
  }

  const handleSetPrimary = async (id: number): Promise<void> => {
    await setPrimarySchedule.mutateAsync({ id })
    void message.success('Primary schedule updated')
  }

  const hasPrimarySchedule = schedules.some((s) => s.is_primary === 1)
  const primarySchedule = schedules.find((s) => s.is_primary === 1) ?? null

  const handleGenerateWithWarning = (): void => {
    Modal.confirm({
      title: 'Generate Budget Periods',
      content: 'This will regenerate budget periods based on your primary schedule. Existing periods with budget data will not be affected.',
      okText: 'Generate',
      onOk: handleGenerate,
    })
  }

  if (loading) {
    return <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 6 }} /></div>
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0, color: COLORS.walnut }}>Pay Schedule Configuration</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}
          style={{ backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta }}>
          Add Schedule
        </Button>
      </div>

      {schedules.length === 0 && <Alert type="info" message="Configure your pay schedule to start creating budget periods." showIcon style={{ marginBottom: 8 }} />}

      {schedules.length > 0 && (
        <Collapse accordion={false}>
          {schedules.map((schedule) => (
            <Collapse.Panel key={schedule.id} header={scheduleCollapseHeader(schedule, schedule.is_primary === 1)}>
              <PayScheduleCard schedule={schedule} isPrimary={schedule.is_primary === 1}
                onSave={handleSaveSchedule} onDelete={handleDeleteSchedule} onSetPrimary={handleSetPrimary} />
            </Collapse.Panel>
          ))}
        </Collapse>
      )}

      <Divider />

      {primarySchedule && (
        <div>
          <Text strong style={{ color: COLORS.walnut, fontSize: 14 }}>Period Structure Preview</Text>
          <PeriodTimelinePreview schedule={primarySchedule} monthsAhead={3} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Button icon={<SyncOutlined />} onClick={handleGenerateWithWarning} disabled={!hasPrimarySchedule}
          loading={regeneratePeriods.isPending}
          style={hasPrimarySchedule ? { borderColor: COLORS.sage, color: COLORS.sage } : {}}>
          Generate Periods
        </Button>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {hasPrimarySchedule ? 'Regenerates budget periods based on the primary schedule.' : 'Set a primary pay schedule first to generate periods.'}
        </Text>
      </div>

      <PeriodTimeline periods={periods} />

      <Modal title="Update Future Periods?" open={periodsModalOpen} onCancel={() => setPeriodsModalOpen(false)}
        okText={`Update ${selectedPeriodIds.size} Period${selectedPeriodIds.size !== 1 ? 's' : ''}`}
        onOk={() => void handlePeriodsUpdate()} okButtonProps={{ disabled: selectedPeriodIds.size === 0 }}>
        <p style={{ marginBottom: 12 }}>Your schedule was saved. Select which future periods to regenerate.</p>
        <div style={{ marginBottom: 8 }}>
          <Space>
            <Button size="small" onClick={() => setSelectedPeriodIds(new Set(futurePeriods.map((p) => p.id)))}>Select All</Button>
            <Button size="small" onClick={() => setSelectedPeriodIds(new Set())}>Deselect All</Button>
          </Space>
        </div>
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {futurePeriods.map((period) => (
            <div key={period.id} style={{ padding: '4px 0' }}>
              <Checkbox checked={selectedPeriodIds.has(period.id)} onChange={(e) => {
                const next = new Set(selectedPeriodIds)
                if (e.target.checked) next.add(period.id); else next.delete(period.id)
                setSelectedPeriodIds(next)
              }}>
                {dayjs(period.start_date).format('MMM D')} — {dayjs(period.end_date).format('MMM D, YYYY')}
              </Checkbox>
            </div>
          ))}
          {futurePeriods.length === 0 && <Text type="secondary">No future periods to update.</Text>}
        </div>
      </Modal>

      <Modal title="Add Income Schedule" open={addModalOpen} onCancel={() => setAddModalOpen(false)} footer={null} destroyOnClose>
        <AddScheduleForm onSubmit={handleAddSchedule} onCancel={() => setAddModalOpen(false)} />
      </Modal>
    </Space>
  )
}
