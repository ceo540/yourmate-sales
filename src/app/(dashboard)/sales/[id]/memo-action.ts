'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateMemo(saleId: string, memo: string) {
  const admin = createAdminClient()
  await admin.from('sales').update({ memo }).eq('id', saleId)
  revalidatePath(`/sales/${saleId}`)
}
