'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updatePermission(role: string, pageKey: string, accessLevel: string) {
  const admin = createAdminClient()
  await admin.from('role_permissions')
    .upsert({ role, page_key: pageKey, access_level: accessLevel }, { onConflict: 'role,page_key' })
  revalidatePath('/admin')
}

export async function createEntity(formData: FormData) {
  const supabase = await createClient()
  await supabase.from('business_entities').insert({
    name: formData.get('name') as string,
    business_number: (formData.get('business_number') as string) || null,
  })
  revalidatePath('/admin')
}

export async function updateEntity(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  await supabase.from('business_entities').update({
    name: formData.get('name') as string,
    business_number: (formData.get('business_number') as string) || null,
  }).eq('id', id)
  revalidatePath('/admin')
}

export async function deleteEntity(id: string) {
  const supabase = await createClient()
  await supabase.from('business_entities').delete().eq('id', id)
  revalidatePath('/admin')
}

export async function updateJoinDate(userId: string, joinDate: string) {
  const admin = createAdminClient()
  await admin.from('profiles').update({ join_date: joinDate || null }).eq('id', userId)
  revalidatePath('/admin')
  revalidatePath('/hr')
}

export async function updateEmployeeEntity(userId: string, entityId: string) {
  const admin = createAdminClient()
  await admin.from('profiles').update({ entity_id: entityId || null }).eq('id', userId)
  revalidatePath('/admin')
}

export async function createOneOnOne(memberId: string, date: string, content: string, actionItems: string) {
  const admin = createAdminClient()
  await admin.from('one_on_ones').insert({ member_id: memberId, date, content, action_items: actionItems })
  revalidatePath('/admin')
}

export async function deleteOneOnOne(id: string) {
  const admin = createAdminClient()
  await admin.from('one_on_ones').delete().eq('id', id)
  revalidatePath('/admin')
}

export async function updateDocumentStatus(id: string, status: string) {
  const admin = createAdminClient()
  await admin.from('document_requests').update({
    status,
    processed_at: status === '발급완료' ? new Date().toISOString() : null,
  }).eq('id', id)
  revalidatePath('/admin')
}

export async function setInitialLeave(userId: string, days: number) {
  const admin = createAdminClient()
  const year = new Date().getFullYear()
  if (days > 0) {
    await admin.from('leave_balances').upsert(
      { member_id: userId, year, initial_days: days },
      { onConflict: 'member_id,year' }
    )
  } else {
    await admin.from('leave_balances').delete().eq('member_id', userId).eq('year', year)
  }
  revalidatePath('/admin')
  revalidatePath('/hr')
}
