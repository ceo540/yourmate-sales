'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  NotificationConfig,
  NotificationSettingId,
  updateSetting,
} from '@/lib/notification-settings'

export async function saveNotificationSettingAction(
  id: NotificationSettingId,
  patch: { enabled?: boolean; config?: Partial<NotificationConfig> }
) {
  await updateSetting(id, patch)
  revalidatePath('/admin')
}

export async function saveChanneltalkUserIdAction(
  userId: string,
  channeltalkUserId: string | null
) {
  const admin = createAdminClient()
  const value = channeltalkUserId?.trim() ? channeltalkUserId.trim() : null
  await admin.from('profiles').update({ channeltalk_user_id: value }).eq('id', userId)
  revalidatePath('/admin')
}

export async function previewPaymentRemindersAction(): Promise<{
  ok: boolean
  result?: unknown
  error?: string
}> {
  try {
    const { runPaymentReminders } = await import('@/lib/payment-reminders')
    const result = await runPaymentReminders({ dryRun: true })
    return { ok: true, result }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
