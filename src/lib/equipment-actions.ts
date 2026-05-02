'use server'

// 장비 통합 (yourmate-spec.md §5.7)
// equipment_master + equipment_rentals server actions

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

const PATH = '/equipment'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' as const }
  return { user }
}

export async function addEquipmentAction(input: {
  name: string
  category?: string | null
  owning_dept: string
  total_qty?: number
  unit_price?: number | null
  serial_no?: string | null
  storage_location?: string | null
  notes?: string | null
}) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  if (!input.name?.trim()) return { error: '이름 필수' as const }
  if (!input.owning_dept?.trim()) return { error: '소유 사업부 필수' as const }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('equipment_master')
    .insert({
      name: input.name.trim(),
      category: input.category ?? null,
      owning_dept: input.owning_dept,
      total_qty: input.total_qty ?? 1,
      unit_price: input.unit_price ?? null,
      serial_no: input.serial_no ?? null,
      storage_location: input.storage_location ?? null,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  logActivity({
    actor_id: u.user.id,
    action: 'other',
    ref_type: 'equipment_master',
    ref_id: data.id,
    summary: `장비 등록: ${input.name} (${input.owning_dept})`,
  })

  revalidatePath(PATH)
  return { id: data.id }
}

export async function updateEquipmentAction(input: {
  id: string
  patch: Partial<{
    name: string
    category: string | null
    owning_dept: string
    total_qty: number
    unit_price: number | null
    serial_no: string | null
    storage_location: string | null
    notes: string | null
    archive_status: string
  }>
}) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  const admin = createAdminClient()
  const { error } = await admin.from('equipment_master').update(input.patch).eq('id', input.id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

export async function addRentalAction(input: {
  equipment_id: string
  qty?: number
  project_id?: string | null
  customer_id?: string | null
  date_start: string
  date_end: string
  rate?: number | null
  responsible_user_id?: string | null
  notes?: string | null
}) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  if (!input.equipment_id) return { error: '장비 필수' as const }
  if (!input.date_start || !input.date_end) return { error: '대여 기간 필수' as const }

  const admin = createAdminClient()
  // 충돌 감지 — 같은 장비 + 기간 overlap 예약 있으면 경고만
  const { data: overlaps } = await admin
    .from('equipment_rentals')
    .select('id, date_start, date_end, status, qty')
    .eq('equipment_id', input.equipment_id)
    .eq('archive_status', 'active')
    .neq('status', 'returned')
    .neq('status', 'cancelled')
    .lte('date_start', input.date_end)
    .gte('date_end', input.date_start)

  const { data, error } = await admin
    .from('equipment_rentals')
    .insert({
      equipment_id: input.equipment_id,
      qty: input.qty ?? 1,
      project_id: input.project_id ?? null,
      customer_id: input.customer_id ?? null,
      date_start: input.date_start,
      date_end: input.date_end,
      rate: input.rate ?? null,
      responsible_user_id: input.responsible_user_id ?? u.user.id,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  logActivity({
    actor_id: u.user.id,
    action: 'other',
    ref_type: 'equipment_rentals',
    ref_id: data.id,
    summary: `장비 대여: ${input.date_start} ~ ${input.date_end} (수량 ${input.qty ?? 1})`,
  })

  revalidatePath(PATH)
  if (input.project_id) revalidatePath(`/projects/${input.project_id}/v2`)
  return { id: data.id, overlap_count: overlaps?.length ?? 0 }
}

export async function updateRentalStatusAction(input: {
  rental_id: string
  status: 'reserved' | 'in_use' | 'returned' | 'lost' | 'cancelled'
}) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  const admin = createAdminClient()
  const { error } = await admin
    .from('equipment_rentals')
    .update({ status: input.status })
    .eq('id', input.rental_id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

export async function archiveRentalAction(input: { rental_id: string }) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  const admin = createAdminClient()
  const { error } = await admin
    .from('equipment_rentals')
    .update({ archive_status: 'cancelled' })
    .eq('id', input.rental_id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}
