import { createAdminClient } from './supabase/admin'

export type AccessLevel = 'off' | 'read' | 'own' | 'full'

// UI 버튼 제어용 역할 체크. 데이터 범위 제한은 getAccessLevel 사용.
export function isAdmin(role: string | null | undefined): boolean {
  return role === 'admin'
}

export function isAdminOrManager(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}

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
