import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SosClient from './SosClient'

export default async function SosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const [{ data: concertsRaw }, { data: profile }] = await Promise.all([
    adminSupabase.from('sos_concerts').select('*').order('year', { ascending: false }).order('created_at', { ascending: true }),
    adminSupabase.from('profiles').select('id, role').eq('id', user.id).single(),
  ])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'

  return (
    <SosClient
      concerts={concertsRaw ?? []}
      isAdmin={isAdmin}
    />
  )
}
