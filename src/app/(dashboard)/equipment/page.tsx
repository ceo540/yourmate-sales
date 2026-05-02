// 장비 통합 페이지 (yourmate-spec.md §5.7)
// admin only — 검증 단계.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import EquipmentClient from './EquipmentClient'
import type { EquipmentMaster, EquipmentRental } from '@/types'

export default async function EquipmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  const isAdmin = isAdminOrManager(profile?.role)
  if (!isAdmin) {
    return <div className="p-8 text-gray-500">관리자만 접근 가능 (장비 통합은 검증 단계)</div>
  }

  const [{ data: equipmentRaw }, { data: rentalsRaw }, { data: projectsRaw }] = await Promise.all([
    admin.from('equipment_master').select('*').order('created_at', { ascending: false }),
    admin.from('equipment_rentals').select('*').eq('archive_status', 'active').order('date_start', { ascending: false }),
    admin.from('projects').select('id, name, project_number'),
  ])

  const projectMap = Object.fromEntries(
    (projectsRaw ?? []).map(p => [p.id, { name: p.name, number: p.project_number }]),
  )

  return (
    <EquipmentClient
      equipment={(equipmentRaw ?? []) as EquipmentMaster[]}
      rentals={(rentalsRaw ?? []) as EquipmentRental[]}
      projectMap={projectMap}
    />
  )
}
