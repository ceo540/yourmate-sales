'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function generateShareToken(saleId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: sale } = await admin.from('sales').select('share_token').eq('id', saleId).single()
  if (!sale) return null

  if ((sale as any).share_token) return (sale as any).share_token as string

  const { data: updated } = await admin
    .from('sales')
    .update({ share_token: crypto.randomUUID() })
    .eq('id', saleId)
    .select('share_token')
    .single()

  return (updated as any)?.share_token ?? null
}

export async function revokeShareToken(saleId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  await admin.from('sales').update({ share_token: null }).eq('id', saleId)
}
