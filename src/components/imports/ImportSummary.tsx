'use client'

import { Button, Result, Space, Typography } from 'antd'
import { CheckCircleOutlined, FileTextOutlined, SwapOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { COLORS } from '@/theme'

const { Text } = Typography

interface ImportSummaryProps {
  batchId: number
  imported: number
  accountId: number
  fileName: string
  profileName: string | null
  onImportAnother: () => void
}

export function ImportSummary({ batchId, imported, accountId, fileName, profileName, onImportAnother }: ImportSummaryProps): React.JSX.Element {
  return (
    <Result
      icon={<CheckCircleOutlined style={{ color: COLORS.sage }} />}
      title={`Successfully imported ${imported} transaction${imported !== 1 ? 's' : ''}`}
      subTitle={
        <Space direction="vertical" size={4}>
          <Text>From: {fileName}</Text>
          {profileName && <Text type="secondary">Mapping saved as &ldquo;{profileName}&rdquo;</Text>}
        </Space>
      }
      extra={[
        <Link key="view" href={`/transactions?importBatchId=${batchId}`}>
          <Button type="primary" icon={<FileTextOutlined />}>View Imported Transactions</Button>
        </Link>,
        <Button key="another" icon={<SwapOutlined />} onClick={onImportAnother}>Import Another File</Button>,
      ]}
    />
  )
}
