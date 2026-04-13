'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

interface EventInfo {
  event_date?: string
  class_period?: string
  start_time?: string
  end_time?: string
  venue?: string
  student_count?: string
  setup_time?: string
  calltime?: string
  venue_clear?: string
  banner_size?: string
  teacher_name?: string
  teacher_phone?: string
  extra?: string
}

export interface ConcertInput {
  year: number
  month: number
  concert_date: string
  school: string
  concept: string
  mc: string
  artists: string[]
  staff: string[]
  stage: string
  tasks_done: number
  tasks_total: number
  event_info: EventInfo
  sale_id?: string
}

export async function createConcert(data: ConcertInput) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sos_concerts').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/sos')
}

export async function updateConcert(id: string, data: ConcertInput) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sos_concerts').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sos')
}

export async function updateConcertStage(id: string, stage: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sos_concerts').update({ stage }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sos')
}

export async function updateConcertTasks(id: string, tasks_done: number) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sos_concerts').update({ tasks_done }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sos')
}

export async function deleteConcert(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sos_concerts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sos')
}
