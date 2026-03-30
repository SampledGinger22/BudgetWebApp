'use client'

import { useState } from 'react'
import { Alert, Button, InputNumber, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import Papa from 'papaparse'
import { decodeFileBytes, detectHeaderRow, parseCsvText } from '@/lib/utils/csvParser'
import { useAccounts } from '@/lib/api/accounts'
import { COLORS, MONEY_FONT } from '@/theme'
import type { ImportMappingConfig, WizardState } from './types'

const { Text } = Typography

const DELIMITER_OPTIONS = [
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe (|)' },
]

const ENCODING_OPTIONS = [
  { value: 'UTF-8', label: 'UTF-8' },
  { value: 'ISO-8859-1', label: 'Latin-1 (ISO-8859-1)' },
  { value: 'windows-1252', label: 'Windows-1252' },
]

interface Step1Props {
  wizardState: WizardState
  onUpdate: (updates: Partial<WizardState>) => void
}

export function Step1FileAccount({ wizardState, onUpdate }: Step1Props): React.JSX.Element {
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts()
  const [loadingFile, setLoadingFile] = useState(false)
  const [rawBytes, setRawBytes] = useState<Uint8Array | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoadingFile(true)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const bytes = new Uint8Array(reader.result as ArrayBuffer)
        setRawBytes(bytes)

        const fileName = file.name
        const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
        const isQbo = ext === 'qbo' || ext === 'ofx'

        if (isQbo) {
          const decoder = new TextDecoder('utf-8')
          const rawText = decoder.decode(bytes)
          onUpdate({
            fileBytes: bytes,
            fileName,
            rawText,
            importFormat: 'qbo',
            headers: [],
            rows: [],
            detectedDelimiter: ',',
            detectedEncoding: 'UTF-8',
          })
        } else {
          const { text, encoding } = decodeFileBytes(bytes)
          const rawResult = Papa.parse<string[]>(text, { header: false, skipEmptyLines: 'greedy', dynamicTyping: false })
          const allRows = rawResult.data as string[][]
          const headerRowIndex = detectHeaderRow(allRows)
          const parseResult = parseCsvText(text, headerRowIndex)

          onUpdate({
            fileBytes: bytes,
            fileName,
            rawText: text,
            importFormat: 'csv',
            headers: parseResult.headers,
            rows: parseResult.rows,
            detectedDelimiter: parseResult.detectedDelimiter,
            detectedEncoding: encoding,
            mapping: { ...wizardState.mapping, headerRowIndex },
          })
        }
      } catch (err) {
        console.error('[Step1] File load error:', err)
      } finally {
        setLoadingFile(false)
      }
    }
    reader.onerror = () => setLoadingFile(false)
    reader.readAsArrayBuffer(file)
  }

  const handleDelimiterChange = (delimiter: string): void => {
    if (!wizardState.rawText) return
    const rawResult = Papa.parse<string[]>(wizardState.rawText, { header: false, skipEmptyLines: 'greedy', dynamicTyping: false, delimiter })
    const allRows = rawResult.data as string[][]
    const headerRowIndex = wizardState.mapping.headerRowIndex
    const headers = allRows[headerRowIndex] ?? []
    const dataRows = allRows.slice(headerRowIndex + 1)
    onUpdate({ detectedDelimiter: delimiter, headers, rows: dataRows })
  }

  const handleEncodingChange = (encoding: string): void => {
    if (!rawBytes) return
    const decoder = new TextDecoder(encoding, { fatal: false })
    const text = decoder.decode(rawBytes)
    const clean = text.startsWith('\uFEFF') ? text.slice(1) : text
    const headerRowIndex = wizardState.mapping.headerRowIndex
    const parseResult = parseCsvText(clean, headerRowIndex)
    onUpdate({
      rawText: clean, detectedEncoding: encoding,
      headers: parseResult.headers, rows: parseResult.rows,
      detectedDelimiter: parseResult.detectedDelimiter,
    })
  }

  const handleHeaderRowChange = (value: number | null): void => {
    if (value === null || !wizardState.rawText) return
    const parseResult = parseCsvText(wizardState.rawText, value)
    onUpdate({
      headers: parseResult.headers, rows: parseResult.rows,
      mapping: { ...wizardState.mapping, headerRowIndex: value },
    })
  }

  const previewColumns = wizardState.headers.length > 0
    ? wizardState.headers.map((header, idx) => ({
        key: String(idx),
        title: <Text style={{ fontFamily: MONEY_FONT, fontSize: 12 }} ellipsis>{header || `Column ${idx + 1}`}</Text>,
        dataIndex: String(idx), ellipsis: true, width: 150,
        render: (val: string) => <Text style={{ fontSize: 12, fontFamily: MONEY_FONT }} ellipsis>{val ?? ''}</Text>,
      }))
    : []

  const previewData = wizardState.rows.slice(0, 5).map((row, rowIdx) => {
    const obj: Record<string, string> = { key: String(rowIdx) }
    row.forEach((cell, colIdx) => { obj[String(colIdx)] = cell })
    return obj
  })

  const fileSizeLabel = rawBytes !== null
    ? rawBytes.length > 1024 * 1024 ? `${(rawBytes.length / (1024 * 1024)).toFixed(1)} MB` : `${(rawBytes.length / 1024).toFixed(1)} KB`
    : null

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <div style={{ background: COLORS.creamDark, borderRadius: 8, padding: 20 }}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Text strong style={{ color: COLORS.walnut }}>Import File</Text>
          <Space wrap>
            <Button icon={<UploadOutlined />} loading={loadingFile} onClick={() => document.getElementById('import-file-input')?.click()}>
              {wizardState.fileName ? 'Change File' : 'Select File'}
            </Button>
            <input id="import-file-input" type="file" accept=".csv,.tsv,.txt,.qbo,.ofx" onChange={handleFileSelect} style={{ display: 'none' }} />
            {wizardState.fileName && (
              <Space size={8}>
                <Text style={{ fontFamily: MONEY_FONT, fontSize: 12, background: COLORS.cream, padding: '2px 8px', borderRadius: 4, border: `1px solid rgba(92,61,30,0.2)` }}>
                  {wizardState.fileName}
                </Text>
                {fileSizeLabel && <Text style={{ fontSize: 12, color: COLORS.walnut }}>{fileSizeLabel}</Text>}
              </Space>
            )}
          </Space>
          {wizardState.fileName && wizardState.importFormat === 'qbo' && (
            <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>QBO/OFX file detected — column mapping will be skipped</Tag>
          )}
          {wizardState.fileName && wizardState.importFormat !== 'qbo' && (
            <>
              <Space align="center" wrap>
                <Text style={{ fontSize: 13, color: COLORS.walnut }}>Detected encoding:</Text>
                <Select value={wizardState.detectedEncoding} options={ENCODING_OPTIONS} onChange={handleEncodingChange} size="small" style={{ width: 220 }} />
              </Space>
              <Space align="center" wrap>
                <Text style={{ fontSize: 13, color: COLORS.walnut }}>Detected delimiter:</Text>
                <Select value={wizardState.detectedDelimiter} options={DELIMITER_OPTIONS} onChange={handleDelimiterChange} size="small" style={{ width: 220 }} />
              </Space>
              <Space align="center" wrap>
                <Text style={{ fontSize: 13, color: COLORS.walnut }}>Headers at row:</Text>
                <InputNumber min={0} max={20} value={wizardState.mapping.headerRowIndex} onChange={handleHeaderRowChange} size="small" style={{ width: 80 }} />
                <Text style={{ fontSize: 12, color: '#888' }}>(0 = first row)</Text>
              </Space>
            </>
          )}
        </Space>
      </div>

      <div style={{ background: COLORS.creamDark, borderRadius: 8, padding: 20 }}>
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Text strong style={{ color: COLORS.walnut }}>Import Into Account</Text>
          {loadingAccounts ? <Spin size="small" /> : (
            <Select placeholder="Select account..." value={wizardState.accountId ?? undefined}
              onChange={(val: number) => onUpdate({ accountId: val })} style={{ width: 300 }}
              options={accounts.filter((a) => !a.archived_at).map((acc) => ({ value: acc.id, label: acc.name }))}
              showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
          )}
        </Space>
      </div>

      {wizardState.fileName && wizardState.importFormat !== 'qbo' && wizardState.headers.length > 0 && (
        <div style={{ background: COLORS.creamDark, borderRadius: 8, padding: 20 }}>
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Space>
              <Text strong style={{ color: COLORS.walnut }}>File Preview</Text>
              <Text style={{ fontSize: 12, color: '#888' }}>(first 5 rows — {wizardState.rows.length} total data rows)</Text>
            </Space>
            {loadingFile ? <Spin /> : (
              <Table dataSource={previewData} columns={previewColumns} pagination={false} size="small" scroll={{ x: 'max-content' }} style={{ fontSize: 12 }} bordered />
            )}
          </Space>
        </div>
      )}

      {!wizardState.fileName && <Alert type="info" title="Select a file to begin. Accepted formats: .csv, .tsv, .txt, .qbo, .ofx" showIcon />}
      {wizardState.fileName && !wizardState.accountId && <Alert type="warning" title="Please select an account to import transactions into." showIcon />}
    </Space>
  )
}
