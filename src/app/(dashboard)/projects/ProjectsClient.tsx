'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { assignProjectNumbers } from './project-list-actions'

const SVC_COLOR: Record<string, string> = {
  'SOS': '#7C3AED', '교육프로그램': '#2563EB', '납품설치': '#2563EB',
  '교구대여': '#D97706', '제작인쇄': '#EC4899', '콘텐츠제작': '#EC4899',
  '행사운영': '#F97316', '행사대여': '#F59E0B', '유지보수': '#0891B2',
  '002ENT': '#EF4444', '프로젝트': '#6B7280',
}
const STAGE_CLR: Record<string, string> = {
  '계약': 'bg-blue-50 text-blue-600', '착수': 'bg-purple-50 text-purple-600',
  '선금': 'bg-yellow-50 text-yellow-700', '중도금': 'bg-orange-50 text-orange-600',
  '완수': 'bg-teal-50 text-teal-600', '계산서발행': 'bg-indigo-50 text-indigo-600',
  '잔금': 'bg-green-50 text-green-600',
}
const STATUS_CLR: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-red-100 text-red-600',
  '취소':   'bg-gray-100 text-gray-500',
}
function fmtMoney(n: number | null) {
  if (!n) return '—'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}

interface Project {
  id: string
  name: string
  project_number: string | null
  service_type: string | null
  status: string
  customer_name: string | null
  pm_name: string | null
  revenue: number | null
  contract_stage: string | null
  inflow_date: string | null
}

export default function ProjectsClient({ projects, isAdmin }: { projects: Project[]; isAdmin: boolean }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [svcFilter, setSvcFilter] = useState('전체')
  const [assignPending, startAssign] = useTransition()
  const [assignMsg, setAssignMsg] = useState('')

  const svcTypes = ['전체', ...Array.from(new Set(projects.map(p => p.service_type).filter(Boolean) as string[]))]

  const filtered = projects.filter(p => {
    if (statusFilter !== '전체' && p.status !== statusFilter) return false
    if (svcFilter !== '전체' && p.service_type !== svcFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        (p.project_number ?? '').toLowerCase().includes(q) ||
        (p.customer_name ?? '').toLowerCase().includes(q) ||
        (p.service_type ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div>
      {/* 검색 + 필터 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="프로젝트명, 고객, 번호, 서비스 검색..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-yellow-300"
        />
        <div className="flex gap-1.5">
          {(['전체', '진행중', '완료', '보류', '취소']).map(s => {
            const cnt = s === '전체' ? projects.length : projects.filter(p => p.status === s).length
            const active = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={active
                  ? { backgroundColor: '#121212', color: '#FFCE00', borderColor: '#121212' }
                  : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }
                }>
                {s} <span className="opacity-60">({cnt})</span>
              </button>
            )
          })}
        </div>
        {isAdmin && (
          <button onClick={() => startAssign(async () => {
            const res = await assignProjectNumbers()
            setAssignMsg(res.assigned > 0 ? `${res.assigned}건 번호 부여 완료` : '이미 모두 번호 있음')
            setTimeout(() => setAssignMsg(''), 4000)
          })} disabled={assignPending}
            className="ml-auto text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-50">
            {assignPending ? '처리 중...' : '번호 일괄 부여'}
          </button>
        )}
        {assignMsg && <span className="text-xs text-green-600 font-medium">{assignMsg}</span>}
        {!isAdmin && <span className="ml-auto text-xs text-gray-400">{filtered.length}건</span>}
      </div>
      {/* 서비스 필터 */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {svcTypes.map(s => {
          const active = svcFilter === s
          return (
            <button key={s} onClick={() => setSvcFilter(s)}
              className="px-2.5 py-1 rounded-full text-xs border transition-all"
              style={active
                ? { backgroundColor: '#FFCE00', color: '#121212', borderColor: '#FFCE00' }
                : { backgroundColor: '#fff', color: '#9CA3AF', borderColor: '#E5E7EB' }
              }>
              {s}
            </button>
          )
        })}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['번호', '프로젝트명', '고객', '서비스', '상태', '단계', '담당자', '매출'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                {search ? '검색 결과가 없습니다.' : '프로젝트가 없습니다.'}
              </td></tr>
            ) : filtered.map(p => {
              const svcColor = SVC_COLOR[p.service_type ?? ''] ?? '#9CA3AF'
              return (
                <tr key={p.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="block">
                      <span className="text-xs font-bold text-gray-400 font-mono">
                        {p.project_number ?? '—'}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <Link href={`/projects/${p.id}`} className="flex items-center gap-2">
                      <div className="w-0.5 h-6 rounded flex-shrink-0" style={{ background: svcColor }} />
                      <span className="text-sm font-semibold text-gray-900 truncate">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="block text-sm text-gray-500 truncate max-w-[120px]">
                      {p.customer_name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="block">
                      {p.service_type ? (
                        <span className="text-xs px-1.5 py-0.5 rounded border font-medium"
                          style={{ color: svcColor, borderColor: svcColor + '40', background: svcColor + '12' }}>
                          {p.service_type}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="block">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLR[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {p.status}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="block">
                      {p.contract_stage ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STAGE_CLR[p.contract_stage] ?? 'bg-gray-100 text-gray-500'}`}>
                          {p.contract_stage}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <Link href={`/projects/${p.id}`} className="block">{p.pm_name ?? '—'}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="block text-sm font-semibold"
                      style={{ color: p.revenue ? '#374151' : '#D1D5DB' }}>
                      {fmtMoney(p.revenue)}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
