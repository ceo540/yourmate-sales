'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertFixedCost(data: {
  id?: string
  name: string
  category?: string | null
  business_entity?: string | null
  amount: number
  payment_day?: number | null
  payment_method?: string | null
  memo?: string | null
  is_active: boolean
}) {
  const supabase = await createClient()
  if (data.id) {
    const { id, ...rest } = data
    await supabase.from('fixed_costs').update(rest).eq('id', id)
  } else {
    await supabase.from('fixed_costs').insert(data)
  }
  revalidatePath('/fixed-costs')
}

export async function deleteFixedCost(id: string) {
  const supabase = await createClient()
  await supabase.from('fixed_costs').delete().eq('id', id)
  revalidatePath('/fixed-costs')
}
