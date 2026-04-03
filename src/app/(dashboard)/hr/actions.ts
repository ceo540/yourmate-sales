'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createLeaveRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const memberId = (formData.get('member_id') as string) || user.id
  const type = formData.get('type') as string
  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string
  const reason = formData.get('reason') as string

  // 연차 일수 계산
  const DAYS_MAP: Record<string, number> = {
    '연차': 1, '반차(오전)': 0.5, '반차(오후)': 0.5,
    '병가': 1, '공가': 0, '경조사': 0,
  }
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const perDay = DAYS_MAP[type] ?? 1
  const days = type === '연차' ? diffDays : perDay

  const admin = createAdminClient()
  await admin.from('leave_requests').insert({
    member_id: memberId,
    type,
    start_date: startDate,
    end_date: endDate,
    days,
    reason,
    director_approval: '대기',
    ceo_approval: '대기',
  })

  revalidatePath('/hr')
}

export async function approveLeave(id: string, level: 'director' | 'ceo', status: '승인' | '반려') {
  const admin = createAdminClient()
  const field = level === 'director' ? 'director_approval' : 'ceo_approval'
  await admin.from('leave_requests').update({ [field]: status }).eq('id', id)
  revalidatePath('/hr')
}

export async function requestDocument(memberId: string, docType: string, purpose: string) {
  const admin = createAdminClient()
  await admin.from('document_requests').insert({ member_id: memberId, doc_type: docType, purpose: purpose || null, status: '요청' })
  revalidatePath('/hr')
}
