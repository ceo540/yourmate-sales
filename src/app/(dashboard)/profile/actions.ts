'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateMyProfile(fields: {
  phone?: string
  emergency_name?: string
  emergency_phone?: string
  bank_name?: string
  account_number?: string
  birth_date?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const update: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(fields)) {
    update[k] = v || null
  }
  await supabase.from('profiles').update(update).eq('id', user.id)
  revalidatePath('/profile')
}
