'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function assignProjectNumbers(): Promise<{ assigned: number }> {
  const admin = createAdminClient()

  const [{ data: noNum }, { data: existing }] = await Promise.all([
    admin.from('projects').select('id, created_at').is('project_number', null).order('created_at', { ascending: true }),
    admin.from('projects').select('project_number').not('project_number', 'is', null),
  ])

  if (!noNum?.length) return { assigned: 0 }

  // Count existing numbers per YY
  const countByYear = new Map<string, number>()
  for (const p of (existing ?? [])) {
    const yy = String(p.project_number).split('-')[0]
    countByYear.set(yy, (countByYear.get(yy) ?? 0) + 1)
  }

  let assigned = 0
  for (const p of noNum) {
    const yy = String(new Date(p.created_at).getFullYear()).slice(-2)
    const seq = (countByYear.get(yy) ?? 0) + 1
    countByYear.set(yy, seq)
    const projectNumber = `${yy}-${String(seq).padStart(3, '0')}`
    await admin.from('projects').update({ project_number: projectNumber }).eq('id', p.id)
    assigned++
  }

  revalidatePath('/projects')
  return { assigned }
}
