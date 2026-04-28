import { createAdminClient } from './supabase/admin'

export type NotificationSettingId = 'payment_due' | 'payable_due'

export type SendTo = 'service_group' | 'fixed_group' | 'default_group'

export interface NotificationConfig {
  d_minus: number[]
  d_plus: number[]
  send_to: SendTo
  target_group_id?: string | null
  include_assignee_mention: boolean
}

export interface NotificationSetting {
  id: NotificationSettingId
  label: string
  enabled: boolean
  config: NotificationConfig
  description: string | null
  updated_at: string
}

const DEFAULT_CONFIG: Record<NotificationSettingId, NotificationConfig> = {
  payment_due: {
    d_minus: [3, 0],
    d_plus: [1, 7],
    send_to: 'service_group',
    include_assignee_mention: true,
  },
  payable_due: {
    d_minus: [3, 0],
    d_plus: [1, 7],
    send_to: 'fixed_group',
    target_group_id: null,
    include_assignee_mention: true,
  },
}

export async function getSetting(id: NotificationSettingId): Promise<NotificationSetting | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('notification_settings')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return {
    ...data,
    config: { ...DEFAULT_CONFIG[id], ...(data.config ?? {}) },
  } as NotificationSetting
}

export async function listSettings(): Promise<NotificationSetting[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('notification_settings')
    .select('*')
    .order('id')
  return (data ?? []).map(s => ({
    ...s,
    config: { ...DEFAULT_CONFIG[s.id as NotificationSettingId], ...(s.config ?? {}) },
  })) as NotificationSetting[]
}

export async function updateSetting(
  id: NotificationSettingId,
  patch: { enabled?: boolean; config?: Partial<NotificationConfig> }
) {
  const admin = createAdminClient()
  const current = await getSetting(id)
  if (!current) throw new Error(`notification_setting ${id} not found`)
  const next = {
    enabled: patch.enabled ?? current.enabled,
    config: { ...current.config, ...(patch.config ?? {}) },
    updated_at: new Date().toISOString(),
  }
  const { error } = await admin.from('notification_settings').update(next).eq('id', id)
  if (error) throw error
}

export function labelForDOffset(offset: number): string {
  if (offset === 0) return 'D-day'
  if (offset > 0) return `D-${offset}`
  return `D+${Math.abs(offset)}`
}

export function expandSchedulePoints(config: NotificationConfig): { offset: number; label: string }[] {
  const minus = config.d_minus.map(n => ({ offset: n, label: labelForDOffset(n) }))
  const plus = config.d_plus.map(n => ({ offset: -n, label: labelForDOffset(-n) }))
  return [...minus, ...plus]
}
