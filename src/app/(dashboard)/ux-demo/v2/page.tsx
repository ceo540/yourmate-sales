'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── 샘플 데이터 ──────────────────────────────────────────────
const SERVICES = ['납품설치', '렌탈', '유지보수', '제작인쇄']

const PROJECTS = [
  { id: '1', name: '경기도특수교육원 진드페', client: '경기도교육청',   assignee: '임지영', status: '선금수령',  revenue: 8500000,  tasks: [
    { id: 't1', title: '현장 답사 및 측정', status: '완료',   priority: '높음',  assignee: '임지영', due: '2026-03-28' },
    { id: 't2', title: '견적서 제출',        status: '완료',   priority: '높음',  assignee: '임지영', due: '2026-04-01' },
    { id: 't3', title: '장비 발주',          status: '진행중', priority: '긴급',  assignee: '유제민', due: '2026-04-05' },
    { id: 't4', title: '설치 현장 준비',     status: '할 일',  priority: '보통',  assignee: '임지영', due: '2026-06-08' },
    { id: 't5', title: '납품 및 설치',       status: '할 일',  priority: '높음',  assignee: '유제민', due: '2026-06-11' },
  ], service: '납품설치', logs: 3 },
  { id: '2', name: '서울A중 스마트교실 2차', client: '서울A중학교',   assignee: '유제민', status: '계약완료',  revenue: 3200000,  tasks: [
    { id: 't6', title: '계약서 수령',        status: '완료',   priority: '보통',  assignee: '유제민', due: '2026-03-20' },
    { id: 't7', title: '납품 일정 확정',     status: '진행중', priority: '보통',  assignee: '유제민', due: '2026-04-10' },
  ], service: '납품설치', logs: 1 },
  { id: '3', name: '부천교육지원청 기자재',  client: '부천교육지원청', assignee: '김수아', status: '계약전',   revenue: 1500000,  tasks: [
    { id: 't8', title: '제안서 작성',        status: '진행중', priority: '높음',  assignee: '김수아', due: '2026-04-07' },
  ], service: '납품설치', logs: 0 },
  { id: '4', name: '인천Y고 악기 렌탈',     client: '인천Y고등학교', assignee: '조민현', status: '완납',     revenue: 2400000,  tasks: [], service: '렌탈', logs: 2 },
  { id: '5', name: '용인 초등 AS 3월',      client: '용인시청',     assignee: '임지영', status: '완납',     revenue: 450000,   tasks: [], service: '유지보수', logs: 1 },
]

const STATUS_DOT: Record<string, string> = {
  '완납':      'bg-green-400',
  '중도금수령': 'bg-blue-400',
  '선금수령':  'bg-yellow-400',
  '계약완료':  'bg-yellow-300',
  '계약전':    'bg-gray-300',
}
const STATUS_BADGE: Record<string, string> = {
  '완납':      'bg-green-50 text-green-700',
  '중도금수령': 'bg-blue-50 text-blue-700',
  '선금수령':  'bg-yellow-50 text-yellow-700',
  '계약완료':  'bg-blue-50 text-blue-600',
  '계약전':    'bg-gray-100 text-gray-500',
}
const TASK_STATUS_STYLE: Record<string, string> = {
  '완료':   'line-through text-gray-300',
  '진행중': 'text-gray-900',
  '할 일':  'text-gray-700',
  '보류':   'text-gray-400',
}
const PRIORITY_COLOR: Record<string, string> = {
  '긴급': 'text-red-500', '높음': 'text-orange-400', '보통': 'text-gray-300', '낮음': 'text-gray-200',
}

function formatDue(d: string) {
  const date = new Date(d); const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: `D${diff}`, cls: 'text-red-400 font-bold' }
  if (diff === 0) return { label: 'D-day', cls: 'text-red-400 font-bold' }
  if (diff <= 3) return { label: `D-${diff}`, cls: 'text-orange-400 font-semibold' }
  return { label: `D-${diff}`, cls: 'text-gray-400' }
}

// ── 메인 데모 페이지 ───────────────────────────────────────────
export default function DemoV2() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeService, setActiveService] = useState('납품설치')

  const selected = PROJECTS.find(p => p.id === selectedId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 데모 배너 */}
      <div className="bg-black text-white text-xs text-center py-1.5 font-medium tracking-wide">
        UI 개선 데모 v2 — 실제 적용 전 미리보기
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {selected ? (
          <ProjectHub project={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <DeptView
            activeService={activeService}
            onServiceChange={setActiveService}
            onSelect={setSelectedId}
          />
        )}
      </div>
    </div>
  )
}

// ── 사업부 / 서비스별 프로젝트 뷰 ─────────────────────────────
function DeptView({ activeService, onServiceChange, onSelect }: {
  activeService: string
  onServiceChange: (s: string) => void
  onSelect: (id: string) => void
}) {
  const filtered = PROJECTS.filter(p => p.service === activeService)
  const totalRevenue = filtered.reduce((s, p) => s + p.revenue, 0)

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-lg">🏫</span>
            <h1 className="text-xl font-bold text-gray-900">학교상점</h1>
          </div>
          <p className="text-sm text-gray-400">2026년 · 총 {PROJECTS.length}건 · {(PROJECTS.reduce((s,p)=>s+p.revenue,0)/10000).toFixed(0)}만원</p>
        </div>
      </div>

      {/* 서비스 탭 */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {SERVICES.map(svc => {
          const cnt = PROJECTS.filter(p => p.service === svc).length
          const active = svc === activeService
          return (
            <button
              key={svc}
              onClick={() => onServiceChange(svc)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                active ? 'text-gray-900 shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
              style={active ? { backgroundColor: '#FFCE00' } : {}}
            >
              {svc}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                active ? 'bg-black/10 text-gray-800' : 'bg-gray-100 text-gray-400'
              }`}>{cnt}</span>
            </button>
          )
        })}
      </div>

      {/* 프로젝트 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="flex items-center px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="w-2.5 mr-3 flex-shrink-0" />
          <p className="flex-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide min-w-0">건명</p>
          <p className="w-24 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden sm:block">발주처</p>
          <p className="w-16 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden sm:block text-center">담당</p>
          <p className="w-20 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-right hidden sm:block">매출</p>
          <p className="w-20 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">수금 상태</p>
          <p className="w-16 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">업무</p>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm">
            <p className="mb-1">{activeService} 건 없음</p>
          </div>
        ) : (
          <>
            {filtered.map((p, idx) => {
              const pending = p.tasks.filter(t => t.status !== '완료' && t.status !== '보류').length
              return (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={`w-full flex items-center px-4 py-3.5 hover:bg-gray-50 transition-colors text-left group ${
                    idx !== filtered.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  {/* 상태 점 */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mr-3 ${STATUS_DOT[p.status] ?? 'bg-gray-200'}`} />
                  {/* 건명 */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-gray-700 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 sm:hidden">{p.client} · {p.assignee}</p>
                  </div>
                  {/* 발주처 */}
                  <p className="w-24 text-xs text-gray-500 hidden sm:block truncate pr-2">{p.client}</p>
                  {/* 담당자 */}
                  <div className="w-16 hidden sm:flex justify-center">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{p.assignee}</span>
                  </div>
                  {/* 매출 */}
                  <p className="w-20 text-sm font-semibold text-gray-700 text-right hidden sm:block pr-2">
                    {(p.revenue / 10000).toFixed(0)}만
                  </p>
                  {/* 수금 상태 */}
                  <div className="w-20 flex justify-center">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                  </div>
                  {/* 업무 */}
                  <div className="w-16 flex justify-center">
                    {pending > 0 ? (
                      <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">{pending}건</span>
                    ) : p.tasks.length > 0 ? (
                      <span className="text-xs text-gray-400">완료</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </button>
              )
            })}

            {/* + 새 건 추가 */}
            <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50">
              <button className="text-sm text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1.5">
                <span className="text-base leading-none">+</span> 새 건 추가
              </button>
            </div>
          </>
        )}
      </div>

      {/* 하단 요약 */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-4 mt-3 px-1">
          <span className="text-xs text-gray-400">{filtered.length}건</span>
          <span className="text-xs font-semibold text-gray-700">{(totalRevenue / 10000).toFixed(0)}만원</span>
          <span className="text-xs text-gray-400">{filtered.filter(p => p.status === '완납').length}건 완납</span>
        </div>
      )}
    </div>
  )
}

// ── 프로젝트 허브 ──────────────────────────────────────────────
function ProjectHub({ project, onBack }: { project: typeof PROJECTS[0]; onBack: () => void }) {
  const [tab, setTab] = useState<'tasks' | 'logs' | 'contract'>('tasks')
  const [tasks, setTasks] = useState(project.tasks)
  const [newTitle, setNewTitle] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const pending = tasks.filter(t => t.status !== '완료' && t.status !== '보류')
  const completed = tasks.filter(t => t.status === '완료')

  function toggleTask(id: string) {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: t.status === '완료' ? '할 일' : '완료' } : t
    ))
  }

  function addTask() {
    if (!newTitle.trim()) return
    setTasks(prev => [...prev, {
      id: Date.now().toString(), title: newTitle, status: '할 일',
      priority: '보통', assignee: '-', due: '',
    }])
    setNewTitle('')
    setShowAdd(false)
  }

  const TABS = [
    { key: 'tasks' as const,    label: `업무 ${pending.length > 0 ? `(${pending.length}건 진행중)` : `(${tasks.length})`}` },
    { key: 'logs' as const,     label: `소통 내역 (${project.logs})` },
    { key: 'contract' as const, label: '계약 정보' },
  ]

  return (
    <div>
      {/* 브레드크럼 */}
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-700 transition-colors mb-3">
        ← 학교상점 / {project.service}
      </button>

      {/* 프로젝트 헤더 카드 */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{project.name}</h1>
            {/* 메타 한 줄 */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-xs text-gray-500">{project.client}</span>
              <span className="text-gray-200">·</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{project.assignee}</span>
              <span className="text-gray-200">·</span>
              <span className="text-xs font-semibold text-gray-700">{(project.revenue / 10000).toFixed(0)}만원</span>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE[project.status]}`}>
            {project.status}
          </span>
        </div>
      </div>

      {/* 탭 (3개로 단순화) */}
      <div className="flex gap-0 border-b border-gray-200 mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap ${
              tab === t.key ? 'border-yellow-400 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* 업무 탭 */}
      {tab === 'tasks' && (
        <div>
          {pending.length === 0 && !showAdd ? (
            <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-400 text-sm mb-3">등록된 업무가 없어요</p>
              <button onClick={() => setShowAdd(true)}
                className="px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-80"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                + 첫 업무 추가
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {pending.map((t, idx) => {
                const due = t.due ? formatDue(t.due) : null
                return (
                  <div key={t.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group ${
                    idx !== pending.length - 1 || showAdd ? 'border-b border-gray-50' : ''
                  }`}>
                    <button
                      onClick={() => toggleTask(t.id)}
                      className="w-4 h-4 rounded-full border-2 border-gray-300 hover:border-green-400 flex-shrink-0 transition-all"
                    />
                    <p className="flex-1 text-sm text-gray-900 min-w-0 truncate">{t.title}</p>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {t.priority !== '보통' && (
                        <span className={`text-[11px] font-semibold ${PRIORITY_COLOR[t.priority]}`}>{t.priority}</span>
                      )}
                      {due && <span className={`text-xs ${due.cls}`}>{due.label}</span>}
                      {t.assignee !== '-' && <span className="text-xs text-gray-400">{t.assignee}</span>}
                    </div>
                  </div>
                )
              })}

              {/* 추가 폼 */}
              {showAdd ? (
                <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-100">
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder="업무명 입력 후 Enter"
                    className="w-full text-sm bg-white border border-yellow-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400 mb-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={addTask}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                      style={{ backgroundColor: '#FFCE00', color: '#121212' }}>추가</button>
                    <button onClick={() => setShowAdd(false)}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                  <button onClick={() => setShowAdd(true)}
                    className="text-sm text-gray-400 hover:text-gray-700 transition-colors">+ 업무 추가</button>
                </div>
              )}
            </div>
          )}

          {/* 완료 업무 */}
          {completed.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 px-1 mb-1.5">완료 ({completed.length})</p>
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden opacity-50">
                {completed.map((t, idx) => (
                  <div key={t.id} className={`flex items-center gap-3 px-4 py-2.5 ${idx !== completed.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <button
                      onClick={() => toggleTask(t.id)}
                      className="w-4 h-4 rounded-full bg-green-400 border-2 border-green-400 flex-shrink-0"
                    />
                    <p className="flex-1 text-sm line-through text-gray-400 min-w-0 truncate">{t.title}</p>
                    {t.assignee !== '-' && <span className="text-xs text-gray-400 flex-shrink-0">{t.assignee}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 소통 내역 탭 */}
      {tab === 'logs' && (
        <div className="space-y-2">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <textarea placeholder="소통 내용 입력..." rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-yellow-400 mb-2" />
            <div className="flex gap-2">
              {['통화', '이메일', '방문', '메모'].map(t => (
                <button key={t} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:border-yellow-300">
                  {t}로 저장
                </button>
              ))}
            </div>
          </div>
          {project.logs === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">소통 내역이 없습니다</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">통화</span>
                <span className="text-xs text-gray-400">4월 2일 14:30</span>
                <span className="text-xs text-gray-400 ml-auto">{project.assignee}</span>
              </div>
              <p className="text-sm text-gray-700">납품 일정 확인 완료. 6월 11일 오전 설치 진행 예정.</p>
            </div>
          )}
        </div>
      )}

      {/* 계약 정보 탭 */}
      {tab === 'contract' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <p className="text-xs text-gray-400">계약 정보를 수정하고 저장하세요.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">건명</label>
            <input defaultValue={project.name}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">발주처</label>
              <input defaultValue={project.client}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">매출액 (원)</label>
              <input type="number" defaultValue={project.revenue}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">수금 상태</label>
            <div className="flex gap-2 flex-wrap">
              {['계약전', '계약완료', '선금수령', '중도금수령', '완납'].map(s => (
                <label key={s} className="cursor-pointer">
                  <input type="radio" name="demo_status" value={s}
                    defaultChecked={s === project.status} className="sr-only peer" />
                  <span className="px-3 py-1.5 rounded-full text-sm border border-gray-200 text-gray-500 peer-checked:border-yellow-400 peer-checked:bg-yellow-50 peer-checked:text-yellow-800 peer-checked:font-medium transition-all cursor-pointer block">
                    {s}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button className="w-full py-2 text-sm font-semibold rounded-lg hover:opacity-80 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            저장
          </button>
        </div>
      )}
    </div>
  )
}
