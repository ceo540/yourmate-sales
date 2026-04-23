'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createProfileNameMap } from '@/lib/utils'

export async function getCustomerLogs(entityType: 'customer' | 'person', entityId: string) {
  const admin = createAdminClient()
  const col = entityType === 'customer' ? 'customer_id' : 'person_id'
  const { data } = await admin
    .from('project_logs')
    .select('id, content, log_type, contacted_at, created_at, author_id')
    .eq(col, entityId)
    .order('contacted_at', { ascending: false })
    .limit(50)
  if (!data || data.length === 0) return []

  const authorIds = [...new Set(data.map((l: any) => l.author_id).filter(Boolean))]
  let profileMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, name').in('id', authorIds)
    profileMap = createProfileNameMap(profiles)
  }

  return data.map((l: any) => ({
    ...l,
    author: l.author_id ? { name: profileMap[l.author_id] ?? null } : null,
  }))
}

export async function createCustomerLog(payload: {
  customer_id?: string | null
  person_id?: string | null
  log_type: string
  content: string
  contacted_at: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin.from('project_logs').insert({
    ...payload,
    author_id: user.id,
    sale_id: null,
    lead_id: null,
  })
  if (error) return { error: error.message }
  return {}
}

export async function deleteCustomerLog(id: string): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('project_logs').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}
