'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createNotice(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const pinned = isAdmin && formData.get('pinned') === 'on'

  const { error } = await supabase.from('notices').insert({
    category: formData.get('category') as string,
    title: formData.get('title') as string,
    content: formData.get('content') as string,
    author_id: user.id,
    pinned,
  })
  if (error) return { error: error.message }
  revalidatePath('/notice')
  return { success: true }
}

export async function deleteNotice(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { data: notice } = await supabase.from('notices').select('author_id').eq('id', id).single()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdminOrManager = ['admin', 'manager'].includes(profile?.role)
  if (!isAdminOrManager && notice?.author_id !== user.id) return { error: '권한 없음' }

  const { error } = await supabase.from('notices').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/notice')
  return { success: true }
}

export async function togglePin(id: string, pinned: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: '권한 없음' }

  const { error } = await supabase.from('notices').update({ pinned }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/notice')
  return { success: true }
}

export async function incrementViews(id: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('notices').select('views').eq('id', id).single()
  await admin.from('notices').update({ views: (data?.views ?? 0) + 1 }).eq('id', id)
}