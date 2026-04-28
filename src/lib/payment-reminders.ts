import { createAdminClient } from './supabase/admin'
import { SERVICE_TO_GROUP } from './services'
import { DEFAULT_GROUP, MentionTarget, sendGroupMessageWithMention } from './channeltalk'
import {
  expandSchedulePoints,
  getSetting,
  labelForDOffset,
  NotificationConfig,
  NotificationSettingId,
} from './notification-settings'

export interface ReminderItem {
  notificationType: NotificationSettingId
  referenceTable: 'payment_schedules' | 'sale_costs'
  referenceId: string
  scheduledLabel: string
  groupId: string | null
  message: string
  mentions: MentionTarget[]
  skipped?: { reason: string }
}

export interface ReminderRunResult {
  ranAt: string
  dryRun: boolean
  items: ReminderItem[]
  sent: number
  duplicates: number
  skipped: number
}

function todayKstDateStr(): string {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000
  const kst = new Date(utc + 9 * 60 * 60_000)
  return kst.toISOString().slice(0, 10)
}

function offsetDate(baseIso: string, offsetDays: number): string {
  const d = new Date(`${baseIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function fmt(amount: number | null | undefined): string {
  if (!amount && amount !== 0) return '-'
  return amount.toLocaleString('ko-KR') + '원'
}

interface BuiltContext {
  todayKst: string
  /** label → due_date map. e.g., 'D-3' → '2026-05-02' */
  pointMap: Map<string, { offset: number; date: string }>
  dueDates: string[]
}

function buildContext(config: NotificationConfig, todayKst: string): BuiltContext {
  const points = expandSchedulePoints(config)
  const pointMap = new Map<string, { offset: number; date: string }>()
  for (const p of points) {
    const date = offsetDate(todayKst, p.offset)
    pointMap.set(date, { offset: p.offset, date })
  }
  return { todayKst, pointMap, dueDates: Array.from(pointMap.keys()) }
}

function labelForDate(ctx: BuiltContext, due: string): string {
  const point = ctx.pointMap.get(due)
  if (!point) return 'D?'
  return labelForDOffset(point.offset)
}

async function loadAlreadySent(
  notificationType: NotificationSettingId,
  refIds: string[]
): Promise<Set<string>> {
  if (refIds.length === 0) return new Set()
  const admin = createAdminClient()
  const { data } = await admin
    .from('notification_log')
    .select('reference_id, scheduled_label, dry_run')
    .eq('notification_type', notificationType)
    .in('reference_id', refIds)
    .eq('dry_run', false)
  return new Set((data ?? []).map((r: any) => `${r.reference_id}__${r.scheduled_label}`))
}

async function processPaymentDue(
  todayKst: string,
  dryRun: boolean
): Promise<ReminderItem[]> {
  const setting = await getSetting('payment_due')
  if (!setting || !setting.enabled) return []
  const ctx = buildContext(setting.config, todayKst)
  if (ctx.dueDates.length === 0) return []

  const admin = createAdminClient()
  const { data: schedules } = await admin
    .from('payment_schedules')
    .select('id, sale_id, label, amount, due_date, is_received')
    .eq('is_received', false)
    .in('due_date', ctx.dueDates)

  const rows = (schedules ?? []) as any[]
  if (rows.length === 0) return []

  const saleIds = Array.from(new Set(rows.map(r => r.sale_id).filter(Boolean)))
  const { data: sales } = saleIds.length > 0
    ? await admin
        .from('sales')
        .select('id, name, project_id, assignee_id, client_org, department')
        .in('id', saleIds)
    : { data: [] }
  const saleMap = new Map<string, any>((sales ?? []).map((s: any) => [s.id, s]))

  const projectIds = Array.from(new Set((sales ?? []).map((s: any) => s.project_id).filter(Boolean)))
  const { data: projects } = projectIds.length > 0
    ? await admin.from('projects').select('id, service_type, name').in('id', projectIds)
    : { data: [] }
  const projectMap = new Map<string, any>((projects ?? []).map((p: any) => [p.id, p]))

  const assigneeIds = Array.from(new Set((sales ?? []).map((s: any) => s.assignee_id).filter(Boolean)))
  const { data: profiles } = assigneeIds.length > 0
    ? await admin.from('profiles').select('id, name, channeltalk_user_id').in('id', assigneeIds)
    : { data: [] }
  const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]))

  const alreadySent = await loadAlreadySent('payment_due', rows.map(r => r.id))

  const items: ReminderItem[] = []
  for (const r of rows) {
    const label = labelForDate(ctx, r.due_date)
    const dedupKey = `${r.id}__${label}`
    const sale = saleMap.get(r.sale_id)
    const project = sale?.project_id ? projectMap.get(sale.project_id) : null
    const assignee = sale?.assignee_id ? profileMap.get(sale.assignee_id) : null

    let groupId: string | null = null
    if (setting.config.send_to === 'service_group') {
      const svc = project?.service_type
      groupId = (svc && SERVICE_TO_GROUP[svc]) || DEFAULT_GROUP
    } else if (setting.config.send_to === 'fixed_group') {
      groupId = setting.config.target_group_id ?? null
    } else {
      groupId = DEFAULT_GROUP
    }

    const mentions: MentionTarget[] = setting.config.include_assignee_mention && assignee
      ? [{ name: assignee.name ?? '담당자', channeltalkUserId: assignee.channeltalk_user_id ?? null }]
      : []

    const lines = [
      `[💰 결제 입금 알림 — ${label}]`,
      `건명: ${sale?.name ?? '(이름 없음)'}`,
      `항목: ${r.label}`,
      `금액: ${fmt(r.amount)}`,
      `예정일: ${r.due_date}`,
      sale?.client_org ? `고객: ${sale.client_org}` : null,
    ].filter(Boolean).join('\n')

    const item: ReminderItem = {
      notificationType: 'payment_due',
      referenceTable: 'payment_schedules',
      referenceId: r.id,
      scheduledLabel: label,
      groupId,
      message: lines,
      mentions,
    }

    if (alreadySent.has(dedupKey)) {
      item.skipped = { reason: 'already_sent' }
    } else if (!groupId) {
      item.skipped = { reason: 'no_group_id' }
    }

    items.push(item)
  }

  return items
}

async function processPayableDue(
  todayKst: string,
  dryRun: boolean
): Promise<ReminderItem[]> {
  const setting = await getSetting('payable_due')
  if (!setting || !setting.enabled) return []
  const ctx = buildContext(setting.config, todayKst)
  if (ctx.dueDates.length === 0) return []

  const admin = createAdminClient()
  const { data: costs } = await admin
    .from('sale_costs')
    .select('id, sale_id, item, amount, due_date, vendor_id, is_paid, category')
    .eq('is_paid', false)
    .in('due_date', ctx.dueDates)

  const rows = ((costs ?? []) as any[]).filter(r => r.due_date)
  if (rows.length === 0) return []

  const saleIds = Array.from(new Set(rows.map(r => r.sale_id).filter(Boolean)))
  const vendorIds = Array.from(new Set(rows.map(r => r.vendor_id).filter(Boolean)))

  const { data: sales } = saleIds.length > 0
    ? await admin.from('sales').select('id, name, assignee_id, client_org').in('id', saleIds)
    : { data: [] }
  const saleMap = new Map<string, any>((sales ?? []).map((s: any) => [s.id, s]))

  const { data: vendors } = vendorIds.length > 0
    ? await admin.from('vendors').select('id, name').in('id', vendorIds)
    : { data: [] }
  const vendorMap = new Map<string, any>((vendors ?? []).map((v: any) => [v.id, v]))

  const assigneeIds = Array.from(new Set((sales ?? []).map((s: any) => s.assignee_id).filter(Boolean)))
  const { data: profiles } = assigneeIds.length > 0
    ? await admin.from('profiles').select('id, name, channeltalk_user_id').in('id', assigneeIds)
    : { data: [] }
  const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]))

  const alreadySent = await loadAlreadySent('payable_due', rows.map(r => r.id))

  const items: ReminderItem[] = []
  for (const r of rows) {
    const label = labelForDate(ctx, r.due_date)
    const dedupKey = `${r.id}__${label}`
    const sale = saleMap.get(r.sale_id)
    const vendor = r.vendor_id ? vendorMap.get(r.vendor_id) : null
    const assignee = sale?.assignee_id ? profileMap.get(sale.assignee_id) : null

    let groupId: string | null = null
    if (setting.config.send_to === 'fixed_group') {
      groupId = setting.config.target_group_id ?? null
    } else if (setting.config.send_to === 'service_group') {
      groupId = DEFAULT_GROUP
    } else {
      groupId = DEFAULT_GROUP
    }

    const mentions: MentionTarget[] = setting.config.include_assignee_mention && assignee
      ? [{ name: assignee.name ?? '담당자', channeltalkUserId: assignee.channeltalk_user_id ?? null }]
      : []

    const lines = [
      `[💸 외주비 지급 알림 — ${label}]`,
      `건명: ${sale?.name ?? '(이름 없음)'}`,
      `항목: ${r.item}`,
      `금액: ${fmt(r.amount)}`,
      `예정일: ${r.due_date}`,
      vendor?.name ? `업체: ${vendor.name}` : null,
    ].filter(Boolean).join('\n')

    const item: ReminderItem = {
      notificationType: 'payable_due',
      referenceTable: 'sale_costs',
      referenceId: r.id,
      scheduledLabel: label,
      groupId,
      message: lines,
      mentions,
    }

    if (alreadySent.has(dedupKey)) {
      item.skipped = { reason: 'already_sent' }
    } else if (!groupId) {
      item.skipped = { reason: 'no_group_id' }
    }

    items.push(item)
  }

  return items
}

export async function runPaymentReminders({
  todayKst = todayKstDateStr(),
  dryRun = false,
}: { todayKst?: string; dryRun?: boolean } = {}): Promise<ReminderRunResult> {
  const all = [
    ...(await processPaymentDue(todayKst, dryRun)),
    ...(await processPayableDue(todayKst, dryRun)),
  ]

  let sent = 0
  let duplicates = 0
  let skipped = 0

  const admin = createAdminClient()

  for (const item of all) {
    if (item.skipped?.reason === 'already_sent') {
      duplicates++
      continue
    }
    if (item.skipped) {
      skipped++
      continue
    }
    if (!item.groupId) {
      skipped++
      continue
    }

    if (!dryRun) {
      await sendGroupMessageWithMention(item.groupId, item.message, item.mentions)
    }

    await admin.from('notification_log').insert({
      notification_type: item.notificationType,
      reference_table: item.referenceTable,
      reference_id: item.referenceId,
      scheduled_label: item.scheduledLabel,
      channel_group_id: item.groupId,
      message: item.message,
      dry_run: dryRun,
    })
    sent++
  }

  return {
    ranAt: new Date().toISOString(),
    dryRun,
    items: all,
    sent,
    duplicates,
    skipped,
  }
}
