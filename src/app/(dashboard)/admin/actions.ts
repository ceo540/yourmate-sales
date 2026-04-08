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
    representative_name: (formData.get('representative_name') as string) || null,
    business_type: (formData.get('business_type') as string) || null,
    business_item: (formData.get('business_item') as string) || null,
    address: (formData.get('address') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    corporate_number: (formData.get('corporate_number') as string) || null,
    bank_name: (formData.get('bank_name') as string) || null,
    account_number: (formData.get('account_number') as string) || null,
    account_holder: (formData.get('account_holder') as string) || null,
  })
  revalidatePath('/admin')
}

export async function updateEntity(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  await supabase.from('business_entities').update({
    name: formData.get('name') as string,
    business_number: (formData.get('business_number') as string) || null,
    representative_name: (formData.get('representative_name') as string) || null,
    business_type: (formData.get('business_type') as string) || null,
    business_item: (formData.get('business_item') as string) || null,
    address: (formData.get('address') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    corporate_number: (formData.get('corporate_number') as string) || null,
    bank_name: (formData.get('bank_name') as string) || null,
    account_number: (formData.get('account_number') as string) || null,
    account_holder: (formData.get('account_holder') as string) || null,
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

export async function adminAddLeave(
  memberId: string,
  type: string,
  startDate: string,
  endDate: string,
  days: number,
  reason: string
) {
  const admin = createAdminClient()
  await admin.from('leave_requests').insert({
    member_id: memberId,
    type,
    start_date: startDate,
    end_date: endDate,
    days,
    reason: reason || null,
    director_approval: '승인',
    ceo_approval: '승인',
  })
  revalidatePath('/admin')
  revalidatePath('/hr')
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

export async function updateProfileDetail(userId: string, fields: {
  phone?: string; emergency_name?: string; emergency_phone?: string
  bank_name?: string; account_number?: string; birth_date?: string
}) {
  const admin = createAdminClient()
  const update: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(fields)) {
    update[k] = v || null
  }
  await admin.from('profiles').update(update).eq('id', userId)
  revalidatePath('/admin')
}

export async function upsertSalary(
  memberId: string, year: number, month: number,
  baseSalary: number, deductions: number, netSalary: number, memo: string
) {
  const admin = createAdminClient()
  await admin.from('salary_records').upsert(
    { member_id: memberId, year, month, base_salary: baseSalary, deductions, net_salary: netSalary, memo: memo || null },
    { onConflict: 'member_id,year,month' }
  )
  revalidatePath('/admin')
}

export async function deleteSalary(id: string) {
  const admin = createAdminClient()
  await admin.from('salary_records').delete().eq('id', id)
  revalidatePath('/admin')
}

export async function addOnboardingItem(memberId: string, title: string, sortOrder: number) {
  const admin = createAdminClient()
  await admin.from('onboarding_items').insert({ member_id: memberId, title, sort_order: sortOrder })
  revalidatePath('/admin')
}

export async function toggleOnboardingItem(id: string, completed: boolean) {
  const admin = createAdminClient()
  await admin.from('onboarding_items').update({
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  }).eq('id', id)
  revalidatePath('/admin')
}

export async function deleteOnboardingItem(id: string) {
  const admin = createAdminClient()
  await admin.from('onboarding_items').delete().eq('id', id)
  revalidatePath('/admin')
}

export async function updateNotionTemplateUrl(url: string) {
  const admin = createAdminClient()
  await admin.from('system_settings').upsert({ key: 'onboarding_notion_url', value: url })
  revalidatePath('/admin')
}

export async function importOnboardingFromNotion(memberId: string, notionPageUrl: string) {
  const token = process.env.NOTION_TOKEN
  if (!token) throw new Error('NOTION_TOKEN not set')

  // Extract page ID from Notion URL
  const match = notionPageUrl.match(/([a-f0-9]{32})(?:[?#]|$)/) ??
                notionPageUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/)
  const rawId = match?.[1]?.replace(/-/g, '')
  if (!rawId) throw new Error('유효한 Notion URL이 아닙니다')
  const pageId = `${rawId.slice(0,8)}-${rawId.slice(8,12)}-${rawId.slice(12,16)}-${rawId.slice(16,20)}-${rawId.slice(20)}`

  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
    },
  })
  if (!res.ok) throw new Error(`Notion API 오류: ${res.status}`)
  const data = await res.json()

  const items = (data.results ?? [])
    .filter((b: any) => ['to_do', 'bulleted_list_item', 'numbered_list_item'].includes(b.type))
    .map((b: any, i: number) => {
      const richText = b[b.type]?.rich_text ?? []
      const title = richText.map((t: any) => t.plain_text).join('') || '(빈 항목)'
      const checked = b.type === 'to_do' ? (b.to_do?.checked ?? false) : false
      return {
        member_id: memberId,
        title,
        completed: checked,
        completed_at: checked ? new Date().toISOString() : null,
        source: 'notion',
        notion_block_id: b.id,
        sort_order: i,
      }
    })

  const admin = createAdminClient()
  await admin.from('onboarding_items').delete().eq('member_id', memberId).eq('source', 'notion')
  if (items.length > 0) {
    await admin.from('onboarding_items').insert(items)
  }
  revalidatePath('/admin')
  return items.length
}

export async function createDepartment(label: string, description: string, color: string, parentId?: string) {
  const admin = createAdminClient()
  const { data: last } = await admin.from('departments').select('sort_order').order('sort_order', { ascending: false }).limit(1).single()
  const sort_order = (last?.sort_order ?? -1) + 1
  const key = 'dept_' + Date.now()
  const { data } = await admin.from('departments').insert({ key, label, description: description || null, color: color || '#9CA3AF', sort_order, parent_id: parentId || null }).select().single()
  revalidatePath('/admin')
  return data
}

export async function updateDepartment(id: string, label: string, description: string, color: string, parentId?: string) {
  const admin = createAdminClient()
  await admin.from('departments').update({ label, description: description || null, color: color || '#9CA3AF', parent_id: parentId || null }).eq('id', id)
  revalidatePath('/admin')
}

export async function deleteDepartment(id: string) {
  const admin = createAdminClient()
  await admin.from('departments').delete().eq('id', id)
  revalidatePath('/admin')
}

export async function reorderDepartments(ids: string[]) {
  const admin = createAdminClient()
  await Promise.all(ids.map((id, i) => admin.from('departments').update({ sort_order: i }).eq('id', id)))
  revalidatePath('/admin')
}

export async function linkEmployeeCard(cardId: string, profileId: string) {
  const admin = createAdminClient()
  await admin.from('employee_cards').update({ profile_id: profileId }).eq('id', cardId)
  revalidatePath('/admin')
  revalidatePath('/payroll')
}
