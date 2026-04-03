'use client'
import { useState } from 'react'

const MOCK_MY_TASKS = [
  { id: '1', title: '견적서 제출', project: '경기도특수교육원 진드페', status: '진행중', priority: '높음', due: '4/11', dDay: -1 },
  { id: '2', title: '현장 답사 일정 확인', project: '경기도특수교육원 진드페', status: '할 일', priority: '보통', due: '4/14', dDay: 2 },
  { id: '3', title: '음향 장비 점검표 작성', project: 'SOS 행사운영', status: '할 일', priority: '높음', due: '4/15', dDay: 3 },
  { id: '4', title: '계약서 검토', project: '아트키움 교육프로그램', status: '검토중', priority: '보통', due: '4/18', dDay: 6 },
]

const MOCK_PROJECTS = [
  { id: '1', name: '경기도특수교육원 진드페스티벌', service: 'SOS', assignee: '임지영', taskTotal: 5, taskDone: 2, dueDate: '6/11', revenue: 8500000, cost: 3200000, paymentStatus: '선금수령' },
  { id: '2', name: '아트키움 교육프로그램 3월', service: '교육프로그램', assignee: '유제민', taskTotal: 4, taskDone: 1, dueDate: '4/30', revenue: 2750000, cost: 800000, paymentStatus: '계약완료' },
  { id: '3', name: 'SOS 봄 행사운영', service: 'SOS', assignee: '조민현', taskTotal: 3, taskDone: 0, dueDate: '5/10', revenue: 4200000, cost: 1900000, paymentStatus: '계약전' },
  { id: '4', name: '학교상점 납품설치 - 용인중', service: '납품설치', assignee: '유제민', taskTotal: 6, taskDone: 6, dueDate: '4/5', revenue: 12000000, cost: 7800000, paymentStatus: '완납' },
]

const STATUS_STYLE: Record<string, string> = {
  '할 일': 'bg-gray-100 text-gray-600', '진행중': 'bg-blue-100 text-blue-700',
  '검토중': 'bg-yellow-100 text-yellow-700', '완료': 'bg-green-100 text-green-700', '보류': 'bg-red-100 text-red-600',
}
const PAY_STYLE: Record<string, string> = {
  '계약전': 'bg-gray-100 text-gray-500', '계약완료': 'bg-blue-50 text-blue-600',
  '선금수령': 'bg-yellow-50 text-yellow-700', '완납': 'bg-green-50 text-green-600',
}
const PRIORITY_STYLE: Record<string, string> = { '낮음': 'text-gray-400', '보통': 'text-yellow-500', '높음': 'text-red-500' }

function fmt(n: number) {
  if (n >= 100000000) return `${(n/100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n/10000)}만`
  return n.toLocaleString()
}

// ── 관리자 대시보드 ───────────────────────────────────────────────────────
function AdminDashboard() {
  const totalRev = MOCK_PROJECTS.reduce((s,p)=>s+p.revenue,0)
  const totalCost = MOCK_PROJECTS.reduce((s,p)=>s+p.cost,0)
  const profit = totalRev - totalCost

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '이번달 매출', value: fmt(totalRev), sub: `${MOCK_PROJECTS.length}건 계약`, color: 'text-gray-900' },
          { label: '이번달 원가', value: fmt(totalCost), sub: `원가율 ${Math.round(totalCost/totalRev*100)}%`, color: 'text-gray-700' },
          { label: '이익', value: fmt(profit), sub: `이익률 ${Math.round(profit/totalRev*100)}%`, color: 'text-green-600' },
          { label: '미수금', value: fmt(8500000), sub: '선금 수령 중 1건', color: 'text-orange-500' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 팀 업무 현황 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">팀 업무 현황</h3>
          {[
            { name: '임지영', active: 3, done: 1 },
            { name: '유제민', active: 4, done: 2 },
            { name: '조민현', active: 2, done: 0 },
          ].map(m => (
            <div key={m.name} className="flex items-center gap-3 mb-3 last:mb-0">
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-gray-600">{m.name[0]}</span>
              </div>
              <span className="text-sm text-gray-700 w-12 flex-shrink-0">{m.name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-yellow-400" style={{ width: `${Math.round(m.done/(m.active+m.done)*100)}%` }} />
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">진행 {m.active} · 완료 {m.done}</span>
            </div>
          ))}
        </div>

        {/* 진행중 계약 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">진행 중 계약</h3>
          <div className="space-y-2.5">
            {MOCK_PROJECTS.filter(p=>p.paymentStatus!=='완납').map(p=>(
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${PAY_STYLE[p.paymentStatus]}`}>{p.paymentStatus}</span>
                  <span className="text-sm text-gray-700 truncate">{p.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 ml-2 flex-shrink-0">{fmt(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 팀원 대시보드 ─────────────────────────────────────────────────────────
function MemberDashboard() {
  const myProjects = MOCK_PROJECTS.filter(p=>['유제민'].includes(p.assignee))

  return (
    <div className="space-y-5">
      {/* 내 업무 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">내 업무 <span className="text-gray-400 font-normal ml-1">{MOCK_MY_TASKS.length}개</span></h3>
          <button className="text-xs text-blue-500 hover:underline">전체 보기 →</button>
        </div>
        <div className="space-y-1.5">
          {MOCK_MY_TASKS.map(t=>(
            <div key={t.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[t.status]}`}>{t.status}</span>
              <span className="flex-1 text-sm text-gray-800 truncate">{t.title}</span>
              <span className={`text-xs flex-shrink-0 font-medium ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
              <span className={`text-xs flex-shrink-0 ${t.dDay<0?'text-red-500 font-semibold':t.dDay<=3?'text-yellow-600':'text-gray-400'}`}>
                {t.due} {t.dDay<0?`(${Math.abs(t.dDay)}일 초과)`:t.dDay===0?'(오늘)':`(D-${t.dDay})`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 내 프로젝트 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">내 프로젝트 <span className="text-gray-400 font-normal ml-1">{myProjects.length}건</span></h3>
        <div className="space-y-3">
          {myProjects.map(p=>{
            const pct = Math.round(p.taskDone/p.taskTotal*100)
            return (
              <div key={p.id} className="border border-gray-100 rounded-xl p-4 hover:border-yellow-300 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${PAY_STYLE[p.paymentStatus]}`}>{p.paymentStatus}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-yellow-400" style={{width:`${pct}%`}} />
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">업무 {p.taskDone}/{p.taskTotal} ({pct}%)</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── 관리자 계약 목록 ──────────────────────────────────────────────────────
function AdminProjectList() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {['건명','서비스','담당자','매출액','원가','이익률','업무 진행','수금'].map(h=>(
              <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {MOCK_PROJECTS.map(p=>{
            const profit = p.revenue - p.cost
            const rate = Math.round(profit/p.revenue*100)
            const pct = Math.round(p.taskDone/p.taskTotal*100)
            return (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">{p.name}</td>
                <td className="px-4 py-3"><span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{p.service}</span></td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.assignee}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{fmt(p.revenue)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{fmt(p.cost)}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-semibold ${rate>=50?'text-green-600':rate>=30?'text-yellow-600':'text-red-500'}`}>{rate}%</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 min-w-[80px]">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-yellow-400" style={{width:`${pct}%`}} />
                    </div>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${PAY_STYLE[p.paymentStatus]}`}>{p.paymentStatus}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── 팀원 프로젝트 목록 ────────────────────────────────────────────────────
function MemberProjectList() {
  return (
    <div className="space-y-3">
      {MOCK_PROJECTS.map(p=>{
        const pct = Math.round(p.taskDone/p.taskTotal*100)
        const tasks = MOCK_MY_TASKS.filter(t=>t.project.startsWith(p.name.slice(0,5)))
        return (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-yellow-300 transition-colors cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{p.service}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">마감 {p.dueDate}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${PAY_STYLE[p.paymentStatus]}`}>{p.paymentStatus}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full bg-yellow-400 transition-all" style={{width:`${pct}%`}} />
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0">업무 {p.taskDone}/{p.taskTotal} 완료</span>
            </div>
            {tasks.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-gray-50">
                {tasks.slice(0,2).map(t=>(
                  <div key={t.id} className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                    <span className="text-xs text-gray-600 flex-1">{t.title}</span>
                    <span className={`text-xs ${t.dDay<0?'text-red-500 font-semibold':t.dDay<=3?'text-yellow-600':'text-gray-400'}`}>
                      {t.due}{t.dDay<0?' ⚠':t.dDay<=3?' !':''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────────
export default function RoleDemoPage() {
  const [role, setRole] = useState<'admin'|'member'>('member')
  const [tab, setTab] = useState<'dashboard'|'projects'>('dashboard')

  return (
    <div className="max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">역할별 화면 미리보기</h1>
          <p className="text-sm text-gray-400 mt-0.5">실제 구현 전 데모 — 목업 데이터</p>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
          <button onClick={()=>setRole('admin')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${role==='admin'?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
            👑 관리자 / 팀장
          </button>
          <button onClick={()=>setRole('member')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${role==='member'?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
            👤 팀원 (유제민)
          </button>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className={`rounded-xl px-4 py-3 mb-5 text-sm flex items-start gap-2 ${role==='admin'?'bg-yellow-50 text-yellow-800 border border-yellow-200':'bg-blue-50 text-blue-800 border border-blue-200'}`}>
        {role==='admin' ? (
          <div>
            <span className="font-semibold">관리자/팀장 뷰</span>
            <span className="ml-2">재무 KPI, 팀 전체 업무 현황, 매출액·원가·이익률 전부 표시</span>
          </div>
        ) : (
          <div>
            <span className="font-semibold">팀원 뷰 (유제민)</span>
            <span className="ml-2">내 업무 목록 + 내 프로젝트 진행률만 표시. 재무 숫자 없음</span>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[
          {key:'dashboard', label:'대시보드'},
          {key:'projects', label: role==='admin'?'계약 목록':'프로젝트 목록'},
        ].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as 'dashboard'|'projects')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab===t.key?'border-yellow-400 text-gray-900':'border-transparent text-gray-400 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==='dashboard' && (role==='admin' ? <AdminDashboard /> : <MemberDashboard />)}
      {tab==='projects' && (role==='admin' ? <AdminProjectList /> : <MemberProjectList />)}
    </div>
  )
}
