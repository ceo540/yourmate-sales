'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createEntity(formData: FormData) {
  const supabase = await createClient()
  await supabase.from('business_entities').insert({
    name: formData.get('name') as string,
    business_number: (formData.get('business_number') as string) || null,
  })
  revalidatePath('/admin')
}

export async function updateEntity(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  await supabase.from('business_entities').update({
    name: formData.get('name') as string,
    business_number: (formData.get('business_number') as string) || null,
  }).eq('id', id)
  revalidatePath('/admin')
}

export async function deleteEntity(id: string) {
  const supabase = await createClient()
  await supabase.from('business_entities').delete().eq('id', id)
  revalidatePath('/admin')
}
