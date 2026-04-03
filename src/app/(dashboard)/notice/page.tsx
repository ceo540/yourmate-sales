import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NoticeClient from './NoticeClient'

export default async function NoticePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const [{ data: noticesRaw }, { data: profilesRaw }] = await Promise.all([
    supabase.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name'),
  ])

  const profileMap = Object.fromEntries((profilesRaw ?? []).map(p => [p.id, p.name]))

  const notices = (noticesRaw ?? []).map((n: any) => ({
    ...n,
    author_name: profileMap[n.author_id] ?? '알 수 없음',
  }))

  return (
    <NoticeClient
      notices={notices}
      isAdmin={isAdmin}
      currentUserId={user.id}
    />
  )
}
