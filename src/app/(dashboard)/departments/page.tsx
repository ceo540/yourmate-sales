import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DEPARTMENT_LABELS, Department } from '@/types'
import { DEPT_ICONS } from '@/lib/constants'

const DEPT_DESC: Record<Department, string> = {
  sound_of_school:    '공연 · SOS 프로그램',
  artkiwoom:          '교육프로그램 · 강사파견',
  school_store:       '납품설치 · 렌탈 · 유지보수',
  '002_creative':     '콘텐츠 · 영상 · 행사',
  yourmate:           '사업개발 · 내부운영',
  '002_entertainment':'음원유통 · 아티스트',
}

export default async function DepartmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  // 사업부별 활성 프로젝트 수 집계
  const { data: salesData } = await supabase
    .from('sales')
    .select('department, contract_stage')
    .not('department', 'is', null)

  const salesByDept: Record<string, { total: number; active: number }> = {}
  for (const s of salesData ?? []) {
    const d = s.department as string
    if (!salesByDept[d]) salesByDept[d] = { total: 0, active: 0 }
    salesByDept[d].total++
    if (s.contract_stage !== '잔금') {
      salesByDept[d].active++
    }
  }

  // 사업부별 목표 수 집계 (테이블 없으면 무시)
  const { data: goalsData } = await supabase
    .from('department_goals')
    .select('department, status')
    .eq('year', new Date().getFullYear())

  const goalsByDept: Record<string, { total: number; active: number }> = {}
  for (const g of goalsData ?? []) {
    const d = g.department as string
    if (!goalsByDept[d]) goalsByDept[d] = { total: 0, active: 0 }
    goalsByDept[d].total++
    if (g.status === '진행중') goalsByDept[d].active++
  }

  const depts = Object.keys(DEPARTMENT_LABELS) as Department[]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">사업부</h1>
        <p className="text-gray-500 text-sm mt-1">사업부별 목표 · 프로젝트 현황</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {depts.map(dept => {
          const sales = salesByDept[dept] ?? { total: 0, active: 0 }
          const goals = goalsByDept[dept] ?? { total: 0, active: 0 }
          return (
            <Link
              key={dept}
              href={`/departments/${dept}`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-yellow-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{DEPT_ICONS[dept]}</span>
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-gray-900">
                      {DEPARTMENT_LABELS[dept]}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{DEPT_DESC[dept]}</p>
                  </div>
                </div>
                <span className="text-gray-300 group-hover:text-yellow-500 text-lg transition-colors">›</span>
              </div>
              <div className="flex gap-4 pt-3 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{sales.active}</p>
                  <p className="text-[11px] text-gray-400">진행중 프로젝트</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{sales.total}</p>
                  <p className="text-[11px] text-gray-400">전체 프로젝트</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{goals.active}</p>
                  <p className="text-[11px] text-gray-400">진행중 목표</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
