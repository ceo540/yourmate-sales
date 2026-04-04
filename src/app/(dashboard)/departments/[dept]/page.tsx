import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { DEPARTMENT_LABELS, Department } from '@/types'
import DeptClient from './DeptClient'

const DEPT_ICONS: Record<Department, string> = {
  sound_of_school:    '🎵',
  artkiwoom:          '🎨',
  school_store:       '🏫',
  '002_creative':     '🎬',
  yourmate:           '🏢',
  '002_entertainment':'🎤',
}

export default async function DeptPage({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params

  if (!DEPARTMENT_LABELS[dept as Department]) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const currentYear = new Date().getFullYear()

  // 해당 사업부 프로젝트 목록
  const { data: salesRaw } = await supabase
    .from('sales')
    .select('id, name, service_type, payment_status, revenue, inflow_date, client_org, assignee_id')
    .eq('department', dept)
    .order('created_at', { ascending: false })

  // PM 이름 매핑
  const assigneeIds = [...new Set((salesRaw ?? []).map(s => s.assignee_id).filter(Boolean))]
  let profileMap: Record<string, string> = {}
  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', assigneeIds)
    profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))
  }

  const sales = (salesRaw ?? []).map(s => ({
    ...s,
    assignee: s.assignee_id ? { name: profileMap[s.assignee_id] ?? '' } : null,
  }))

  // 해당 사업부 목표
  const { data: goals } = await supabase
    .from('department_goals')
    .select('*')
    .eq('department', dept)
    .eq('year', currentYear)
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <Link href="/departments" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← 사업부 목록
        </Link>
      </div>
      <DeptClient
        dept={dept}
        deptLabel={DEPARTMENT_LABELS[dept as Department]}
        deptIcon={DEPT_ICONS[dept as Department]}
        sales={sales}
        goals={goals ?? []}
        isAdmin={isAdmin}
        year={currentYear}
      />
    </div>
  )
}
