'use client'

import { useState } from 'react'
import { Button, Space, Steps } from 'antd'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Step1FileAccount } from '@/components/imports/Step1FileAccount'
import { Step2ColumnMapping } from '@/components/imports/Step2ColumnMapping'
import { Step3Preview } from '@/components/imports/Step3Preview'
import { Step4Confirm } from '@/components/imports/Step4Confirm'
import { QboStep2Preview } from '@/components/imports/QboStep2Preview'
import { QboStep3Confirm } from '@/components/imports/QboStep3Confirm'
import { ImportSummary } from '@/components/imports/ImportSummary'
import type { QboParseResult } from '@/lib/utils/qboParser'
import type { WizardState, StagedTransaction, ImportCommitResult, WizardPhase } from '@/components/imports/types'
import { DEFAULT_WIZARD_STATE } from '@/components/imports/types'

const CSV_STEPS = [
  { title: 'Select File & Account' },
  { title: 'Map Columns' },
  { title: 'Preview & Edit' },
  { title: 'Confirm' },
]

const QBO_STEPS = [
  { title: 'Select File & Account' },
  { title: 'Preview & Edit' },
  { title: 'Confirm' },
]

function isStep1Complete(state: WizardState): boolean {
  return state.fileName !== null && state.accountId !== null
}

function isStep2Complete(state: WizardState): boolean {
  const { mapping } = state
  const hasDate = mapping.dateColumn !== null
  const hasDesc = mapping.descriptionColumn !== null
  const hasAmount = mapping.amountMode === 'single'
    ? mapping.amountColumn !== null
    : mapping.debitColumn !== null && mapping.creditColumn !== null
  return hasDate && hasDesc && hasAmount
}

export default function ImportPage(): React.JSX.Element {
  const [current, setCurrent] = useState(0)
  const [wizardState, setWizardState] = useState<WizardState>(DEFAULT_WIZARD_STATE)
  const [stagedTransactions, setStagedTransactions] = useState<StagedTransaction[]>([])
  const [qboStagedTransactions, setQboStagedTransactions] = useState<StagedTransaction[]>([])
  const [qboParseResult, setQboParseResult] = useState<QboParseResult | null>(null)
  const [wizardPhase, setWizardPhase] = useState<WizardPhase>('wizard')
  const [importResult, setImportResult] = useState<{ result: ImportCommitResult; savedProfileName: string | null } | null>(null)

  const isQbo = wizardState.importFormat === 'qbo'
  const steps = isQbo ? QBO_STEPS : CSV_STEPS

  const updateWizard = (updates: Partial<WizardState>): void => {
    setWizardState((prev) => ({ ...prev, ...updates }))
  }

  const resetWizard = (): void => {
    setWizardState(DEFAULT_WIZARD_STATE)
    setStagedTransactions([])
    setQboStagedTransactions([])
    setQboParseResult(null)
    setWizardPhase('wizard')
    setCurrent(0)
    setImportResult(null)
  }

  const handleImportSuccess = (result: ImportCommitResult, savedProfileName: string | null): void => {
    setImportResult({ result, savedProfileName })
    setWizardPhase('summary')
  }

  const isNextDisabled = (): boolean => {
    if (current === 0) return !isStep1Complete(wizardState)
    if (isQbo) {
      if (current === 1) return !qboStagedTransactions.some((t) => !t.excluded)
      return false
    }
    if (current === 1) return !isStep2Complete(wizardState)
    if (current === 2) return !stagedTransactions.some((t) => !t.excluded && t.parseError === null)
    return false
  }

  const handleBack = (): void => {
    if (isQbo && current === 1) { setQboStagedTransactions([]); setQboParseResult(null) }
    else if (!isQbo && current === 2) { setStagedTransactions([]) }
    setCurrent((c) => c - 1)
  }

  const renderStepContent = (): React.ReactNode => {
    if (wizardPhase === 'summary' && importResult !== null) {
      return (
        <ImportSummary batchId={importResult.result.batchId} imported={importResult.result.imported}
          accountId={wizardState.accountId!} fileName={wizardState.fileName ?? ''} profileName={importResult.savedProfileName}
          onImportAnother={resetWizard} />
      )
    }
    if (isQbo) {
      switch (current) {
        case 0: return <Step1FileAccount wizardState={wizardState} onUpdate={updateWizard} />
        case 1: return <QboStep2Preview wizardState={wizardState} qboParseResult={qboParseResult} stagedTransactions={qboStagedTransactions} onStagedChange={setQboStagedTransactions} onParseResult={setQboParseResult} />
        case 2: return <QboStep3Confirm wizardState={wizardState} qboParseResult={qboParseResult!} stagedTransactions={qboStagedTransactions} onImportSuccess={handleImportSuccess} />
        default: return null
      }
    }
    switch (current) {
      case 0: return <Step1FileAccount wizardState={wizardState} onUpdate={updateWizard} />
      case 1: return <Step2ColumnMapping wizardState={wizardState} onUpdate={updateWizard} />
      case 2: return <Step3Preview wizardState={wizardState} stagedTransactions={stagedTransactions} onStagedChange={setStagedTransactions} />
      case 3: return <Step4Confirm wizardState={wizardState} stagedTransactions={stagedTransactions} onImportSuccess={handleImportSuccess} />
      default: return null
    }
  }

  const showNavButtons = wizardPhase === 'wizard' && current < steps.length - 1

  return (
    <ErrorBoundary label="Import">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        {wizardPhase === 'wizard' && <Steps current={current} items={steps} style={{ marginBottom: 8 }} />}
        <div>{renderStepContent()}</div>
        {showNavButtons && (
          <Space style={{ justifyContent: 'flex-end', width: '100%', display: 'flex' }}>
            {current > 0 && <Button onClick={handleBack}>Back</Button>}
            <Button type="primary" disabled={isNextDisabled()} onClick={() => setCurrent((c) => c + 1)}>Next</Button>
          </Space>
        )}
        {wizardPhase === 'wizard' && current === steps.length - 1 && (
          <Space style={{ justifyContent: 'flex-start', width: '100%', display: 'flex' }}>
            <Button onClick={handleBack}>Back</Button>
          </Space>
        )}
      </Space>
    </ErrorBoundary>
  )
}
