'use client'

/**
 * Shared types for the Import wizard.
 * Extracted from ImportPage to be consumed by step components.
 */

export interface ImportMappingConfig {
  dateColumn: number | null
  descriptionColumn: number | null
  amountColumn: number | null
  debitColumn: number | null
  creditColumn: number | null
  typeColumn: number | null
  typeValueMappings: Record<string, 'debit' | 'credit'>
  signConvention: 'positive-income' | 'positive-expense'
  amountMode: 'single' | 'split'
  dateFormat: string
  headerRowIndex: number
}

export interface WizardState {
  fileBytes: Uint8Array | null
  fileName: string | null
  accountId: number | null
  rawText: string | null
  headers: string[]
  rows: string[][]
  detectedDelimiter: string
  detectedEncoding: string
  mapping: ImportMappingConfig
  profileId: number | null
  profileModified: boolean
  importFormat: 'csv' | 'qbo'
}

export const DEFAULT_MAPPING: ImportMappingConfig = {
  dateColumn: null,
  descriptionColumn: null,
  amountColumn: null,
  debitColumn: null,
  creditColumn: null,
  typeColumn: null,
  typeValueMappings: {},
  signConvention: 'positive-income',
  amountMode: 'single',
  dateFormat: '',
  headerRowIndex: 0,
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  fileBytes: null,
  fileName: null,
  accountId: null,
  rawText: null,
  headers: [],
  rows: [],
  detectedDelimiter: ',',
  detectedEncoding: 'UTF-8',
  mapping: DEFAULT_MAPPING,
  profileId: null,
  profileModified: false,
  importFormat: 'csv',
}

export interface StagedTransaction {
  idx: number
  date: string
  description: string
  original_description: string
  amount_cents: number
  is_debit: number
  category_id: number | null
  vendor_id: number | null
  member_id: number | null
  excluded: boolean
  parseError: string | null
  isDuplicate: boolean
  fitid: string | null
}

export interface ImportCommitResult {
  batchId: number
  imported: number
}

export type WizardPhase = 'wizard' | 'summary'
