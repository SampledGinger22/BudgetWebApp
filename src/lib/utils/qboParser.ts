/**
 * QBO/OFX file parser — handles both OFX v1 (SGML, no closing tags)
 * and OFX v2 (XML, with closing tags).
 *
 * Pure function — no Node.js or Electron dependencies. Safe for browser.
 * All monetary values converted to INTEGER cents. NEVER use floats for storage.
 */

export interface QboTransaction {
  fitid: string
  date: string          // YYYY-MM-DD
  description: string
  amount_cents: number  // absolute value, INTEGER cents
  is_debit: number      // 0 | 1
  trntype: string       // original OFX TRNTYPE value
}

export interface QboParseResult {
  transactions: QboTransaction[]
  accountInfo: { bankId: string; acctId: string; acctType: string } | null
  ledgerBalance: { balanceCents: number; asOfDate: string } | null
  format: 'ofx1' | 'ofx2'
  warnings: string[]
}

/**
 * Extract a tag's value from an OFX block.
 * Handles both SGML (no closing tag) and XML (with closing tag):
 *   <TRNAMT>-45.67          (SGML)
 *   <TRNAMT>-45.67</TRNAMT> (XML)
 */
function getTagValue(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i')
  const match = block.match(regex)
  return match ? match[1].trim() : ''
}

/**
 * Parse an OFX date string (YYYYMMDD or YYYYMMDDHHMMSS with optional timezone)
 * into YYYY-MM-DD format.
 */
function parseOfxDate(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 8)
  if (digits.length < 8) return ''
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

/**
 * Parse a QBO/OFX file content string into structured transaction data.
 * Handles both OFX v1 (SGML) and OFX v2 (XML) formats.
 */
export function parseQboFile(content: string): QboParseResult {
  const warnings: string[] = []

  // Detect format
  const trimmed = content.trimStart()
  const isXml = trimmed.startsWith('<?xml') || trimmed.startsWith('<?OFX')
  const format: 'ofx1' | 'ofx2' = isXml ? 'ofx2' : 'ofx1'

  // Extract STMTTRN blocks
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST))/gi
  const matches = [...content.matchAll(trnRegex)]

  const transactions: QboTransaction[] = []

  for (let i = 0; i < matches.length; i++) {
    const block = matches[i][1]

    const fitid = getTagValue(block, 'FITID')
    const trnamt = getTagValue(block, 'TRNAMT')

    if (!fitid) {
      warnings.push(`Transaction ${i + 1}: missing FITID, skipped`)
      continue
    }
    if (!trnamt) {
      warnings.push(`Transaction ${i + 1} (FITID=${fitid}): missing TRNAMT, skipped`)
      continue
    }

    const amt = parseFloat(trnamt)
    if (isNaN(amt)) {
      warnings.push(`Transaction ${i + 1} (FITID=${fitid}): invalid TRNAMT "${trnamt}", skipped`)
      continue
    }

    const rawDate = getTagValue(block, 'DTPOSTED')
    const date = parseOfxDate(rawDate)
    if (!date) {
      warnings.push(`Transaction ${i + 1} (FITID=${fitid}): invalid DTPOSTED "${rawDate}", skipped`)
      continue
    }

    const name = getTagValue(block, 'NAME')
    const memo = getTagValue(block, 'MEMO')
    let description: string
    if (name && memo && name !== memo) {
      description = `${name} - ${memo}`
    } else if (name) {
      description = name
    } else if (memo) {
      description = memo
    } else {
      description = 'Unknown'
    }

    const trntype = getTagValue(block, 'TRNTYPE')

    transactions.push({
      fitid,
      date,
      description,
      amount_cents: Math.round(Math.abs(amt) * 100),
      is_debit: amt < 0 ? 1 : 0,
      trntype,
    })
  }

  // Extract account info from BANKACCTFROM
  let accountInfo: QboParseResult['accountInfo'] = null
  const acctBlock = content.match(/<BANKACCTFROM>([\s\S]*?)(?:<\/BANKACCTFROM>|(?=<BANKMSGSRSV1|<BANKTRANLIST))/i)
  if (acctBlock) {
    const bankId = getTagValue(acctBlock[1], 'BANKID')
    const acctId = getTagValue(acctBlock[1], 'ACCTID')
    const acctType = getTagValue(acctBlock[1], 'ACCTTYPE')
    if (bankId || acctId || acctType) {
      accountInfo = { bankId, acctId, acctType }
    }
  }

  // Extract ledger balance from LEDGERBAL
  let ledgerBalance: QboParseResult['ledgerBalance'] = null
  const balBlock = content.match(/<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|(?=<\/STMTRS|<AVAILBAL))/i)
  if (balBlock) {
    const balAmt = getTagValue(balBlock[1], 'BALAMT')
    const balDate = getTagValue(balBlock[1], 'DTASOF')
    const parsedAmt = parseFloat(balAmt)
    const parsedDate = parseOfxDate(balDate)
    if (!isNaN(parsedAmt) && parsedDate) {
      ledgerBalance = {
        balanceCents: Math.round(parsedAmt * 100),
        asOfDate: parsedDate,
      }
    }
  }

  return { transactions, accountInfo, ledgerBalance, format, warnings }
}
