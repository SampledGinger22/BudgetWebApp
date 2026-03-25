'use client'

import { Card, Col, Row, Space, Typography } from 'antd'
import { BarChartOutlined, DollarOutlined, LineChartOutlined, PieChartOutlined } from '@ant-design/icons'
import { COLORS } from '@/theme'

const { Title, Text } = Typography

const REPORT_CARDS = [
  { title: 'Spending by Category', icon: <PieChartOutlined />, desc: 'See where your money goes, grouped by category.' },
  { title: 'Budget vs Actual', icon: <BarChartOutlined />, desc: 'Compare planned allocations against actual spending.' },
  { title: 'Cash Flow', icon: <LineChartOutlined />, desc: 'Track income and expenses over time.' },
  { title: 'Net Worth', icon: <DollarOutlined />, desc: 'View your total assets minus liabilities over time.' },
]

export default function ReportsPage(): React.JSX.Element {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0, color: COLORS.walnut }}>Reports</Title>
      <Text type="secondary">Reports and analytics will be available in a future update.</Text>
      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        {REPORT_CARDS.map((card) => (
          <Col xs={24} sm={12} key={card.title}>
            <Card
              style={{ borderColor: 'rgba(92, 61, 30, 0.12)', opacity: 0.6 }}
              styles={{ body: { padding: 20 } }}
            >
              <Space direction="vertical" size={4}>
                <Space>
                  <span style={{ fontSize: 20, color: COLORS.copper }}>{card.icon}</span>
                  <Text strong style={{ color: COLORS.walnut }}>{card.title}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 13 }}>{card.desc}</Text>
                <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>Coming soon</Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  )
}
