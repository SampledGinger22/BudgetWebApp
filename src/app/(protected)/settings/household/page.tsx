'use client'

import { useState } from 'react'
import { Avatar, Button, Card, Input, Space, Spin, Tag, Typography, message } from 'antd'
import { MailOutlined, UserOutlined, CrownOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import {
  useHouseholdMembers,
  useHouseholdInvites,
  useSendInvite,
  useAcceptInvite,
  useDeclineInvite,
} from '@/lib/api/household'
import { COLORS } from '@/theme'

const { Title, Text } = Typography

export default function HouseholdPage(): React.JSX.Element {
  const { data: members = [], isLoading: membersLoading } = useHouseholdMembers()
  const { data: invites = [], isLoading: invitesLoading } = useHouseholdInvites()
  const sendInvite = useSendInvite()
  const acceptInvite = useAcceptInvite()
  const declineInvite = useDeclineInvite()

  const [inviteEmail, setInviteEmail] = useState('')

  const handleSendInvite = async (): Promise<void> => {
    if (!inviteEmail.trim()) {
      void message.warning('Please enter an email address')
      return
    }
    try {
      await sendInvite.mutateAsync({ email: inviteEmail.trim() })
      message.success('Invite sent')
      setInviteEmail('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send invite'
      message.error(msg)
    }
  }

  const handleAcceptInvite = async (inviteId: number): Promise<void> => {
    try {
      await acceptInvite.mutateAsync({ invite_id: inviteId })
      message.success('Invite accepted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invite'
      message.error(msg)
    }
  }

  const handleDeclineInvite = async (inviteId: number): Promise<void> => {
    try {
      await declineInvite.mutateAsync({ invite_id: inviteId })
      message.success('Invite declined')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to decline invite'
      message.error(msg)
    }
  }

  if (membersLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%', maxWidth: 600 }}>
      <div>
        <Title level={4} style={{ margin: 0, color: COLORS.walnut }}>Household</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Manage who has access to this household&apos;s budget data.
        </Text>
      </div>

      {/* Members list */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 12, color: COLORS.walnut }}>Members</Text>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {members.map((member) => (
            <Card key={member.id} size="small" styles={{ body: { padding: '10px 16px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar size={36} icon={<UserOutlined />} style={{ backgroundColor: COLORS.terracotta, flexShrink: 0 }}>
                  {member.name?.[0]?.toUpperCase() ?? '?'}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <Text strong style={{ color: COLORS.walnut, display: 'block' }}>
                    {member.name ?? member.email}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{member.email}</Text>
                </div>
                {member.is_owner && (
                  <Tag icon={<CrownOutlined />} color="gold">Owner</Tag>
                )}
                {!member.is_owner && (
                  <Tag color="default">Member</Tag>
                )}
              </div>
            </Card>
          ))}
          {members.length === 0 && (
            <Text type="secondary">No members found.</Text>
          )}
        </Space>
      </div>

      {/* Pending invites */}
      {(invites.length > 0 || invitesLoading) && (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 12, color: COLORS.walnut }}>Pending Invites</Text>
          {invitesLoading ? (
            <Spin size="small" />
          ) : (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {invites.map((invite) => (
                <Card key={invite.id} size="small" styles={{ body: { padding: '10px 16px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar size={36} icon={<MailOutlined />} style={{ backgroundColor: COLORS.copper, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ color: COLORS.walnut, display: 'block' }}>
                        {invite.household_name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Invited by {invite.invited_by_name ?? 'unknown'}
                      </Text>
                    </div>
                    <Space>
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={() => void handleAcceptInvite(invite.id)}
                        loading={acceptInvite.isPending}
                        style={{ backgroundColor: COLORS.sage, borderColor: COLORS.sage }}
                      >
                        Accept
                      </Button>
                      <Button
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => void handleDeclineInvite(invite.id)}
                        loading={declineInvite.isPending}
                      >
                        Decline
                      </Button>
                    </Space>
                  </div>
                </Card>
              ))}
            </Space>
          )}
        </div>
      )}

      {/* Invite form */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 12, color: COLORS.walnut }}>Invite a Member</Text>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            prefix={<MailOutlined style={{ color: '#bbb' }} />}
            placeholder="Enter email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onPressEnter={handleSendInvite}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            onClick={handleSendInvite}
            loading={sendInvite.isPending}
            style={{ backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta }}
          >
            Send Invite
          </Button>
        </Space.Compact>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          The invited person will need to create an account or sign in to accept the invitation.
        </Text>
      </div>
    </Space>
  )
}
