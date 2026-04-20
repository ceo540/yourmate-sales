'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── 샘플 데이터 ──────────────────────────────────────────────────────────────
const SAMPLE_PROJECTS = [
  {
    id: '1', name: '경기도특수교육원 진드페', client_org: '경기도교육청', assignee: '임지영',
    contract_stage: '선금', revenue: 4200000,
    tasks: { total: 7, done: 3, urgent: 2 },
  },
  {
    id: '2', name: 'SOS 행사운영 — 한양대', client_org: '한양대학교', assignee: '유제민',
    contract_stage: '착수', revenue: 1800000,
    tasks: { total: 4, done: 0, urgent: 1 },
  },
  {
    id: '3', name: '장곡중학교 악기렌탈 4월', client_org: '장곡중학교', assignee: '방준영',
    contract_stage: '잔금', revenue: 640000,
    tasks: { total: 3, done: 3, urgent: 0 },
  },
  {
    id: '4', name: '용인교육지원청 홍보영상', client_org: '용인교육지원청', assignee: '이하나',
    contract_stage: '계약', revenue: 3500000,
    tasks: { total: 2, done: 0, urgent: 0 },
  },
]

const SAMPLE_TASKS = [
  { id: 't1', title: '견적서 제출', status: '완료', priority: '높음', assignee: '임지영', due: '2026-04-02', project: '경기도특수교육원 진드페', dept: 'artkiwoom', saleId: '1', overdue: false },
  { id: 't2', title: '현장 답사 일정 확인', status: '진행중', priority: '높음', assignee: '임지영', due: '2026-04-07', project: '경기도특수교육원 진드페', dept: 'artkiwoom', saleId: '1', overdue: false },
  { id: 't3', title: '음향 장비 사전 점검', status: '할 일', priority: '긴급', assignee: '유제민', due: '2026-04-05', project: 'SOS 행사운영 — 한양대', dept: 'sound_of_school', saleId: '2', overdue: true },
  { id: 't4', title: '드라이버 배치 확정', status: '할 일', priority: '높음', assignee: '유제민', due: '2026-04-06', project: 'SOS 행사운영 — 한양대', dept: 'sound_of_school', saleId: '2', overdue: false },
  { id: 't5', title: '악기 수거 스케줄링', status: '진행중', priority: '보통', assignee: '방준영', due: '2026-04-10', project: '장곡중학교 악기렌탈 4월', dept: 'school_store', saleId: '3', overdue: false },
  { id: 't6', title: '인터뷰 섭외 확인', status: '할 일', priority: '보통', assignee: '이하나', due: '2026-04-15', project: '용인교육지원청 홍보영상', dept: '002_creative', saleId: '4', overdue: false },
  { id: 't7', title: '촬영 로케이션 헌팅', status: '할 일', priority: '낮음', assignee: '이하나', due: null, project: '용인교육지원청 홍보영상', dept: '002_creative', saleId: '4', overdue: false },
]

const PAY_COLORS: Record<string, string> = {
  '계약':       'bg-blue-50 text-blue-600',
  '착수':       'bg-purple-50 text-purple-600',
  '선금':       'bg-yellow-50 text-yellow-700',
  '중도금':     'bg-orange-50 text-orange-600',
  '완수':       'bg-teal-50 text-teal-600',
  '계산서발행': 'bg-indigo-50 text-indigo-600',
  '잔금':       'bg-green-100 text-green-700',
}
const STATUS_COLORS: Record<string, string> = {
  '할 일':  'bg-gray-100 text-gray-600',
  '진행중': 'bg-blue-100 text-blue-700',
  '검토중': 'bg-yellow-100 text-yellow-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-red-100 text-red-600',
}
const PRIORITY_DOT: Record<string, string> = {
  '긴급': 'bg-red-500', '높음': 'bg-orange-400', '보통': 'bg-gray-300', '낮음': 'bg-gray-200',
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
export default function V3Demo() {
  const [activeSection, setActiveSection] = useState<'dept' | 'tasks' | 'proposals'>('dept')

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">데모 v3</span>
          <span className="text-xs text-gray-400">실제 배포 전 미리보기</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">유어메이트 업무 시스템 개선안</h1>
        <p className="text-sm text-gray-500 mt-1">노션 이질감 해소 · 사업부 중심 UX · 업무 흐름 고도화</p>
      </div>

      {/* 섹션 탭 */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
        {[
          { key: 'dept', label: '① 사업부 프로젝트 목록', desc: '+ 새 건 · 업무 진행률' },
          { key: 'tasks', label: '② 전체 업무 보기', desc: 'Notion-like 개선' },
          { key: 'proposals', label: '③ 추가 제안', desc: '미래 기능' },
        ].map(({ key, label, desc }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key as any)}
            className={`flex-1 text-left px-4 py-3 rounded-xl border transition-all ${
              activeSection === key
                ? 'border-yellow-400 bg-yellow-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <p className={`text-sm font-semibold ${activeSection === key ? 'text-yellow-800' : 'text-gray-700'}`}>{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      {/* ① 사업부 프로젝트 목록 */}
      {activeSection === 'dept' && <DeptSection />}

      {/* ② 전체 업무 보기 */}
      {activeSection === 'tasks' && <TasksSection tasks={SAMPLE_TASKS} />}

      {/* ③ 추가 제안 */}
      {activeSection === 'proposals' && <ProposalsSection />}

      {/* 하단 액션 */}
      <div className="mt-10 p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">이 개선안이 마음에 드시나요?</p>
          <p className="text-xs text-gray-500 mt-0.5">원하는 섹션만 선택해서 배포할 수도 있어요</p>
        </div>
        <div className="flex gap-2">
          <Link href="/departments/artkiwoom" className="px-4 py-2 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100">실제 사업부 보기</Link>
          <span className="px-4 py-2 text-sm rounded-xl font-semibold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            &quot;전체 배포해줘&quot; 라고 말씀해주세요
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── ① 사업부 섹션 ────────────────────────────────────────────────────────────
function DeptSection() {
  const [showNewForm, setShowNewForm] = useState(false)
  const [filterAssignee, setFilterAssignee] = useState('')

  const filtered = filterAssignee
    ? SAMPLE_PROJECTS.filter(p => p.assignee === filterAssignee)
    : SAMPLE_PROJECTS

  return (
    <div>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <strong>개선 포인트:</strong> ① 목록에서 업무 진행률 바로 확인 ② 담당자 필터 ③ 사업부 내에서 직접 새 건 추가
      </div>

      {/* 서비스 탭 (현재 탭) */}
      <div className="flex items-center gap-2 mb-1 pb-3 border-b border-gray-200">
        {['교육프로그램', 'SOS', '행사운영'].map((svc, i) => (
          <button key={svc} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            i === 0 ? 'border-transparent shadow-sm' : 'bg-white border-gray-200 text-gray-400'
          }`} style={i === 0 ? { backgroundColor: '#FFCE00', borderColor: '#FFCE00', color: '#121212' } : {}}>
            {svc} <span className={`text-xs ml-1 ${i === 0 ? 'opacity-60' : 'text-gray-300'}`}>{i === 0 ? 4 : i === 1 ? 2 : 1}</span>
          </button>
        ))}
      </div>

      {/* 툴바 */}
      <div className="flex items-center justify-between mt-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">4건</span>
          <span className="text-sm font-semibold text-gray-900">1,014만원</span>
          {/* 담당자 필터 — 신규 */}
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="ml-2 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400"
          >
            <option value="">전체 담당자</option>
            {['임지영', '유제민', '방준영', '이하나'].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        {/* + 새 건 버튼 — 신규 */}
        <button
          onClick={() => setShowNewForm(true)}
          className="px-3 py-1.5 text-sm font-semibold rounded-xl hover:opacity-80 transition-all"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
        >
          + 새 건
        </button>
      </div>

      {/* + 새 건 폼 — 신규 */}
      {showNewForm && (
        <div className="mb-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-gray-800">새 프로젝트 추가</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">건명 *</label>
              <input placeholder="예: 서울중학교 교육프로그램" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">발주처</label>
              <input placeholder="예: 서울중학교" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">담당자</label>
              <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400">
                <option>미지정</option>
                {['임지영', '유제민', '방준영', '이하나'].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">매출액 (원)</label>
              <input type="number" placeholder="0" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-gray-500 block mb-1">서비스 기본 업무 템플릿 적용</label>
              <div className="flex items-center gap-2 p-2.5 bg-white border border-green-200 rounded-lg">
                <input type="checkbox" defaultChecked className="accent-yellow-500" />
                <span className="text-xs text-gray-700">교육프로그램 기본 업무 5개 자동 생성</span>
                <span className="text-[11px] text-gray-400 ml-auto">견적→계약→강사섭외→현장→정산</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-semibold rounded-xl" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>추가</button>
            <button onClick={() => setShowNewForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500">취소</button>
          </div>
        </div>
      )}

      {/* 프로젝트 목록 — 개선 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.map((s, idx) => {
          const pct = s.tasks.total > 0 ? Math.round((s.tasks.done / s.tasks.total) * 100) : 0
          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group cursor-pointer ${idx !== filtered.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              {/* 상태 점 */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                s.contract_stage === '잔금' ? 'bg-green-400' :
                s.contract_stage === '착수' || s.contract_stage === '선금' ? 'bg-yellow-400' :
                'bg-gray-300'
              }`} />

              {/* 건명 + 클라이언트 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                {s.client_org && <p className="text-xs text-gray-400 mt-0.5">{s.client_org}</p>}
              </div>

              {/* 업무 진행률 — 신규 */}
              <div className="flex items-center gap-2 flex-shrink-0 w-28">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#22c55e' : '#FFCE00' }}
                  />
                </div>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">{s.tasks.done}/{s.tasks.total}</span>
                {s.tasks.urgent > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-semibold whitespace-nowrap">
                    ⚠ {s.tasks.urgent}
                  </span>
                )}
              </div>

              {/* 담당자 */}
              <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">{s.assignee}</span>

              {/* 매출 */}
              <span className="text-xs font-medium text-gray-600 flex-shrink-0">
                {(s.revenue / 10000).toFixed(0)}만
              </span>

              {/* 결제 상태 */}
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PAY_COLORS[s.contract_stage] ?? 'bg-gray-100 text-gray-400'}`}>
                {s.contract_stage}
              </span>

              <span className="text-gray-300 group-hover:text-gray-500 text-xs flex-shrink-0">→</span>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">* 위의 진행률 바, 담당자 필터, + 새 건 버튼이 실제 배포됩니다</p>
    </div>
  )
}

// ─── ② 업무 보기 섹션 ────────────────────────────────────────────────────────
function TasksSection({ tasks }: { tasks: typeof SAMPLE_TASKS }) {
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')

  const assignees = Array.from(new Set(tasks.map(t => t.assignee)))

  let filtered = tasks
  if (myTasksOnly) filtered = filtered.filter(t => t.assignee === '방준영') // 현재 사용자 시뮬레이션
  if (filterAssignee) filtered = filtered.filter(t => t.assignee === filterAssignee)
  if (filterStatus === 'active') filtered = filtered.filter(t => t.status !== '완료' && t.status !== '보류')
  else if (filterStatus !== 'all') filtered = filtered.filter(t => t.status === filterStatus)

  // 프로젝트별 그룹화
  const grouped: Record<string, typeof tasks> = {}
  filtered.forEach(t => {
    if (!grouped[t.saleId]) grouped[t.saleId] = []
    grouped[t.saleId].push(t)
  })

  return (
    <div>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <strong>개선 포인트:</strong> ① &quot;내 업무&quot; 토글 ② 담당자 필터 ③ 긴급·지연 업무 색상 강조 ④ 프로젝트 링크 → 사업부 내 페이지로 이동
      </div>

      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 내 업무 토글 — 신규 */}
          <button
            onClick={() => { setMyTasksOnly(v => !v); setFilterAssignee('') }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
              myTasksOnly ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            내 업무
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
              filterStatus === 'active' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-500'
            }`}
          >
            진행 중 <span className="ml-0.5 text-xs opacity-70">{tasks.filter(t => t.status !== '완료' && t.status !== '보류').length}</span>
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
              filterStatus === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-500'
            }`}
          >
            전체 <span className="ml-0.5 text-xs opacity-70">{tasks.length}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* 담당자 필터 — 신규 */}
          <select
            value={filterAssignee}
            onChange={e => { setFilterAssignee(e.target.value); setMyTasksOnly(false) }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400"
          >
            <option value="">전체 담당자</option>
            {assignees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* 프로젝트별 그룹 */}
      <div className="space-y-3">
        {Object.entries(grouped).map(([saleId, groupTasks]) => {
          const proj = SAMPLE_PROJECTS.find(p => p.id === saleId)
          const dept = groupTasks[0]?.dept
          return (
            <div key={saleId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* 그룹 헤더 */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 bg-gray-50/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">▼</span>
                  {/* 프로젝트 링크 → /departments/[dept]/[id] — 개선 */}
                  <a
                    href={`/departments/${dept}/${saleId}`}
                    className="text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline"
                  >
                    {proj?.name ?? '(프로젝트 없음)'}
                  </a>
                  <span className="text-xs text-gray-400">{groupTasks.length}개</span>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PAY_COLORS[proj?.contract_stage ?? ''] ?? 'bg-gray-100 text-gray-400'}`}>
                  {proj?.contract_stage}
                </span>
              </div>

              {/* 업무 목록 */}
              <div className="divide-y divide-gray-50">
                {groupTasks.map(task => {
                  const isOverdue = task.overdue
                  const isUrgent = task.priority === '긴급'
                  const urgentBg = isOverdue ? 'bg-red-50/50' : isUrgent ? 'bg-orange-50/30' : ''

                  return (
                    <div key={task.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${urgentBg}`}>
                      {/* 상태 */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[task.status]}`}>
                        {task.status}
                      </span>

                      {/* 제목 */}
                      <span className={`flex-1 text-sm min-w-0 ${task.status === '완료' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {isOverdue && <span className="mr-1 text-red-500 text-xs font-bold">지연</span>}
                        {task.title}
                      </span>

                      {/* 우선순위 점 */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-gray-200'}`} title={task.priority} />

                      {/* 담당자 */}
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">{task.assignee}</span>

                      {/* 마감일 — 긴급 색상 */}
                      {task.due ? (
                        <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                          {task.due.slice(5).replace('-', '/')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-200 flex-shrink-0">-</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-xl border border-gray-100">
          해당하는 업무가 없어요
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3 text-center">
        * &quot;내 업무&quot; 토글, 담당자 필터, 긴급/지연 강조, 사업부 링크가 실제 배포됩니다
      </p>
    </div>
  )
}

// ─── ③ 추가 제안 섹션 ────────────────────────────────────────────────────────
function ProposalsSection() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">당장 적용하진 않지만, 시스템이 안정화되면 순차 적용할 수 있는 기능들이에요.</p>

      {[
        {
          title: '서비스별 기본 업무 템플릿',
          badge: '다음 우선순위',
          badgeColor: 'bg-green-100 text-green-700',
          desc: '새 건 추가 시, 서비스 유형에 맞는 기본 업무를 자동으로 생성해요.',
          details: [
            'SOS 행사운영: 사전답사 → 장비리스트 → 셋업 → 당일운영 → 장비수거',
            '교육프로그램: 견적서 → 강사섭외 → 자료준비 → 현장진행 → 정산',
            '콘텐츠제작: 기획안 → 촬영 → 편집 → 검수 → 납품',
          ],
        },
        {
          title: '대시보드 "내 업무" 위젯',
          badge: '권장',
          badgeColor: 'bg-blue-100 text-blue-700',
          desc: '홈 대시보드에 오늘 마감 / 이번 주 업무 요약 카드를 보여줘요.',
          details: [
            '로그인하면 내가 담당한 업무 중 긴급·지연 건 바로 확인',
            '클릭하면 해당 프로젝트로 바로 이동',
          ],
        },
        {
          title: '업무 댓글 / 소통 스레드',
          badge: '향후 검토',
          badgeColor: 'bg-gray-100 text-gray-600',
          desc: '업무 상세 패널에서 팀원들이 댓글로 소통할 수 있어요.',
          details: [
            '지금은 project_logs (소통내역 탭)이 프로젝트 단위',
            '업무 단위 소통이 되면 위임 후 결과 확인이 훨씬 편해짐',
          ],
        },
        {
          title: '노션 프로젝트 임포트',
          badge: '대화로 요청',
          badgeColor: 'bg-purple-100 text-purple-700',
          desc: '"노션에서 [프로젝트명] 가져와줘" 라고 하시면 바로 처리해드려요.',
          details: [
            '노션 API 연동 → 해당 프로젝트 + 하위 업무 + 소통내역 일괄 임포트',
            '별도 UI 없이 대화로 요청하는 방식 (현재 작업 방식 유지)',
          ],
        },
      ].map(({ title, badge, badgeColor, desc, details }) => (
        <div key={title} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-semibold text-gray-900">{title}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${badgeColor}`}>{badge}</span>
          </div>
          <p className="text-sm text-gray-600 mb-3">{desc}</p>
          <ul className="space-y-1">
            {details.map((d, i) => (
              <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                <span className="mt-0.5 text-gray-300 flex-shrink-0">•</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
