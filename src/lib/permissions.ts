import { createAdminClient } from './supabase/admin'

export type AccessLevel = 'off' | 'read' | 'own' | 'full'

export async function getAccessLevel(role: string | undefined, pageKey: string): Promise<AccessLevel> {
  if (!role) return 'off'
  if (role === 'admin') return 'full'
  const admin = createAdminClient()
  const { data } = await admin
    .from('role_permissions')
    .select('access_level')
    .eq('role', role)
    .eq('page_key', pageKey)
    .single()
  return (data?.access_level as AccessLevel) ?? 'off'
}

export async function canAccess(role: string | undefined, pageKey: string): Promise<boolean> {
  return (await getAccessLevel(role, pageKey)) !== 'off'
}
