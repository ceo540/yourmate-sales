import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, name, role, phone, emergency_name, emergency_phone, bank_name, account_number, birth_date, join_date')
    .eq('id', user.id)
    .single()

  return <ProfileClient profile={{
    id: profile?.id ?? user.id,
    name: profile?.name ?? '',
    email: user.email ?? '',
    role: profile?.role ?? 'member',
    phone: profile?.phone ?? null,
    emergency_name: profile?.emergency_name ?? null,
    emergency_phone: profile?.emergency_phone ?? null,
    bank_name: profile?.bank_name ?? null,
    account_number: profile?.account_number ?? null,
    birth_date: profile?.birth_date ?? null,
    join_date: profile?.join_date ?? null,
  }} />
}
