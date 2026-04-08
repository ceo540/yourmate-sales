'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createConcert(formData: FormData) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sos_concerts').insert({
    year: Number(formData.get('year')),
    concert_date: formData.get('concert_date') as string,
    school: formData.get('school') as string,
    concept: formData.get('concept') as string,
    artists: formData.get('artists') as string,
    notes: formData.get('notes') as string,
    status: formData.get('status') as string || '예정',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/sos')
}

export async function updateConcert(id: string, formData: FormData) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sos_concerts').update({
    year: Number(formData.get('year')),
    concert_date: formData.get('concert_date') as string,
    school: formData.get('school') as string,
    concept: formData.get('concept') as string,
    artists: formData.get('artists') as string,
    notes: formData.get('notes') as string,
    status: formData.get('status') as string,
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sos')
}

export async function updateConcertStatus(id: string, status: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sos_concerts').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sos')
}

export async function deleteConcert(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sos_concerts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sos')
}
