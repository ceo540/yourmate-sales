'use client'

import { useState } from 'react'

// ── 목업 데이터 ────────────────────────────────────────────────────────────────
const PROJECT = {
  name: '260414 경기도특수교육원 진드페',
  client_org: '경기도교육청 특수교육원',
  contact_name: '김미현 주무관',
  phone: '031-000-0000',
  service: '교육프로그램',
  assignee: '임지영',
  revenue: 42000000,
  cost: 28500000,
  pipeline_status: '진행중',
  contract_stage: '선금',
  inflow_date: '2026-04-14',
  event_date: '2026-06-11',
  notes: '음향 장비 사전 점검 필수. 보조교사 별도 배치 필요.',
}

const PIPELINE = ['유입', '협의중', '견적발송', '계약', '진행중', '완료']
const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']

const TASKS = [
  { id: 1, title: '강사 섭외 및 계약', status: '진행중', assignee: '임지영', due: '2026-04-25', priority: '긴급' },
  { id: 2, title: '음향 장비 사전 점검', status: '할 일', assignee: '유제민', due: '2026-05-10', priority: '높음' },
  { id: 3, title: '행사 진행 매뉴얼 작성', status: '할 일', assignee: '임지영', due: '2026-05-20', priority: '보통' },
  { id: 4, title: '세금계산서 발행', status: '할 일', assignee: '방준영', due: '2026-06-20', priority: '보통' },
  { id: 5, title: '사전답사 일정 확정', status: '완료', assignee: '임지영', due: '2026-04-18', priority: '높음' },
]

const LOGS = [
  { id: 1, date: '2026-04-20', type: '방문', author: '임지영', content: '곤지암리조트 사전답사 완료. 음향 설치 위치 확인. 무대 10x6m, 86석 세팅 가능.' },
  { id: 2, date: '2026-04-15', type: '통화', author: '임지영', content: '김미현 주무관 — 행사 테마 "함께하는 우리" 확정. 프로그램 초안 4/25까지 제출 요청.' },
  { id: 3, date: '2026-04-10', type: '이메일', author: '방준영', content: '견적서 발송 완료. 총액 4,200만원. 교통비/숙박비 별도 협의 예정.' },
]

const COSTS = [
  { id: 1, item: '강사비 (음악치료사 2명)', category: '인건비', amount: 8000000 },
  { id: 2, item: '강사비 (무용치료사 1명)', category: '인건비', amount: 3000000 },
  { id: 3, item: '음향 장비 렌탈', category: '장비', amount: 5500000 },
  { id: 4, item: '교통·숙박', category: '경비', amount: 2000000 },
  { id: 5, item: '소모품·재료비', category: '기타', amount: 1500000 },
  { id: 6, item: '기타 용역비', category: '기타', amount: 8500000 },
]

const TYPE_COLORS: Record<string, string> = {
  방문: 'text-green-600 bg-green-50',
  통화: 'text-blue-600 bg-blue-50',
  이메일: 'text-purple-600 bg-purple-50',
  내부회의: 'text-orange-600 bg-orange-50',
  메모: 'text-yellow-700 bg-yellow-50',
}

const PRIORITY_COLOR: Record<string, string> = {
  긴급: 'text-red-500', 높음: 'text-orange-400', 보통: 'text-gray-300', 낮음: 'text-gray-200',
}

const STAGE_COLORS: Record<string, string> = {
  계약: 'bg-blue-100 text-blue-700',
  착수: 'bg-purple-100 text-purple-700',
  선금: 'bg-yellow-100 text-yellow-700',
  중도금: 'bg-orange-100 text-orange-700',
  완수: 'bg-teal-100 text-teal-700',
  계산서발행: 'bg-indigo-100 text-indigo-700',
  잔금: 'bg-green-100 text-green-700',
}

function fmtMoney(n: number) {
  return `${Math.round(n / 10000).toLocaleString()}만원`
}

// ── 섹션 래퍼 ─────────────────────────────────────────────────────────────────
function Section({ title, count, action, children, defaultOpen = true }: {
  title: string; count?: number; action?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {count !== undefined && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{count}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {action && <span onClick={e => e.stopPropagation()}>{action}</span>}
          <span className="text-gray-300 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && <div className="border-t border-gray-50">{children}</div>}
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function ProjectDemoB() {
  const [tasks, setTasks] = useState(TASKS)
  const [logs, setLogs] = useState(LOGS)
  const [newLog, setNewLog] = useState('')
  const [logType, setLogType] = useState('통화')
  const [finTab, setFinTab] = useState<'contract' | 'cost'>('contract')
  const [claudeInput, setClaudeInput] = useState('')
  const [claudeMessages, setClaudeMessages] = useState<{role:'user'|'ai', text:string}[]>([])
  const [showDoneTask, setShowDoneTask] = useState(false)

  const pipelineIdx = PIPELINE.indexOf(PROJECT.pipeline_status)
  const contractStageIdx = CONTRACT_STAGES.indexOf(PROJECT.contract_stage)
  const profit = PROJECT.revenue - PROJECT.cost
  const margin = Math.round((profit / PROJECT.revenue) * 100)

  const pendingTasks = tasks.filter(t => t.status !== '완료')
  const doneTasks = tasks.filter(t => t.status === '완료')

  function toggleTask(id: number) {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: t.status === '완료' ? '할 일' : '완료' } : t))
  }

  function addLog() {
    if (!newLog.trim()) return
    setLogs(ls => [{ id: Date.now(), date: new Date().toISOString().slice(0, 10), type: logType, author: '방준영', content: newLog }, ...ls])
    setNewLog('')
  }

  function sendClaude() {
    if (!claudeInput.trim()) return
    setClaudeMessages(msgs => [...msgs, { role: 'user', text: claudeInput }, { role: 'ai', text: '(Claude가 프로젝트 맥락을 바탕으로 답변 생성 중...)' }])
    setClaudeInput('')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

      {/* ── 헤더 ── */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{PROJECT.service}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[PROJECT.contract_stage]}`}>{PROJECT.contract_stage}</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">{PROJECT.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{PROJECT.client_org} · {PROJECT.contact_name} · 담당: {PROJECT.assignee}</p>
          </div>
          <button className="flex-shrink-0 text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">수정</button>
        </div>

        {/* 파이프라인 */}
        <div className="flex items-center gap-0 bg-gray-50 rounded-xl px-3 py-2">
          {PIPELINE.map((stage, i) => (
            <div key={stage} className="flex items-center flex-1">
              <div className={`flex-1 text-center text-xs py-1 rounded-lg transition-all ${
                i === pipelineIdx ? 'bg-yellow-400 text-gray-900 font-semibold shadow-sm' :
                i < pipelineIdx ? 'text-gray-300' : 'text-gray-400'
              }`}>
                {i < pipelineIdx ? '✓' : stage}
              </div>
              {i < PIPELINE.length - 1 && <span className="text-gray-300 text-xs mx-0.5">›</span>}
            </div>
          ))}
        </div>

        {/* 키 수치 */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { k: '매출', v: fmtMoney(PROJECT.revenue), color: 'text-gray-900' },
            { k: `마진 ${margin}%`, v: fmtMoney(profit), color: 'text-green-600' },
            { k: '진행 업무', v: `${pendingTasks.length}건`, color: 'text-blue-600' },
            { k: '행사일 D-52', v: '6/11', color: 'text-orange-500' },
          ].map(c => (
            <div key={c.k} className="text-center">
              <p className={`text-base font-bold ${c.color}`}>{c.v}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.k}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 업무 ── */}
      <Section title="업무" count={pendingTasks.length > 0 ? pendingTasks.length : tasks.length}
        action={<button className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">+ 추가</button>}>
        <div className="px-5 py-3 space-y-0.5">
          {pendingTasks.map(t => (
            <div key={t.id} className="flex items-center gap-3 py-2.5 group">
              <button onClick={() => toggleTask(t.id)}
                className="w-4 h-4 rounded-full border-2 border-gray-300 hover:border-yellow-400 flex-shrink-0 transition-all" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-800">{t.title}</span>
                <span className={`ml-2 text-xs font-medium ${PRIORITY_COLOR[t.priority]}`}>●</span>
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <span>{t.assignee}</span>
                <span>{t.due?.slice(5).replace('-', '/')}</span>
              </div>
            </div>
          ))}

          {doneTasks.length > 0 && (
            <div className="pt-2">
              <button onClick={() => setShowDoneTask(s => !s)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <span>{showDoneTask ? '▲' : '▼'}</span>
                완료 {doneTasks.length}건
              </button>
              {showDoneTask && doneTasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2 opacity-40">
                  <button onClick={() => toggleTask(t.id)}
                    className="w-4 h-4 rounded-full bg-green-400 flex-shrink-0 flex items-center justify-center">
                    <span className="text-white text-xs leading-none">✓</span>
                  </button>
                  <span className="text-sm line-through text-gray-400">{t.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── 소통 내역 ── */}
      <Section title="소통 내역" count={logs.length}>
        {/* 입력 */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-50">
          <div className="flex gap-2 mb-2">
            {['통화', '이메일', '방문', '메모'].map(t => (
              <button key={t} onClick={() => setLogType(t)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${logType === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea value={newLog} onChange={e => setNewLog(e.target.value)}
              placeholder="소통 내용 입력..."
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
              rows={2} />
            <button onClick={addLog}
              className="px-4 self-end py-2 bg-yellow-400 text-gray-900 text-sm font-medium rounded-lg hover:bg-yellow-300">저장</button>
          </div>
        </div>

        {/* 타임라인 */}
        <div className="px-5 py-3 space-y-0">
          {logs.map((l, i) => (
            <div key={l.id} className="flex gap-3 py-3 relative">
              {/* 타임라인 선 */}
              {i < logs.length - 1 && (
                <div className="absolute left-[7px] top-8 bottom-0 w-px bg-gray-100" />
              )}
              <div className={`w-3.5 h-3.5 rounded-full mt-1 flex-shrink-0 ${TYPE_COLORS[l.type]?.includes('green') ? 'bg-green-200' : TYPE_COLORS[l.type]?.includes('blue') ? 'bg-blue-200' : TYPE_COLORS[l.type]?.includes('purple') ? 'bg-purple-200' : 'bg-gray-200'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[l.type]}`}>{l.type}</span>
                  <span className="text-xs text-gray-400">{l.date}</span>
                  <span className="text-xs text-gray-400">{l.author}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{l.content}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Claude 협업 ── */}
      <Section title="Claude 협업" defaultOpen={true}
        action={<span className="text-xs text-gray-400">프로젝트 맥락 자동 주입</span>}>
        <div className="px-5 py-4">
          {claudeMessages.length === 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                '강사 계약서 초안 써줘',
                '김미현 주무관에게 일정 확인 이메일 써줘',
                '행사 체크리스트 만들어줘',
              ].map(q => (
                <button key={q} onClick={() => setClaudeInput(q)}
                  className="text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full hover:bg-gray-100">
                  {q}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
              {claudeMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-700'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={claudeInput} onChange={e => setClaudeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendClaude() }}
              placeholder="질문하거나 업무를 지시하세요..."
              className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            <button onClick={sendClaude}
              className="px-4 py-2.5 bg-yellow-400 text-gray-900 text-sm font-medium rounded-xl hover:bg-yellow-300">전송</button>
          </div>
        </div>
      </Section>

      {/* ── 재무 (접기 가능) ── */}
      <Section title="재무" defaultOpen={false}
        action={
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['contract', 'cost'] as const).map(t => (
              <button key={t} onClick={() => setFinTab(t)}
                className={`text-xs px-3 py-1 transition-all ${finTab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t === 'contract' ? '계약 정보' : '원가'}
              </button>
            ))}
          </div>
        }>
        {finTab === 'contract' ? (
          <div className="px-5 py-4">
            {/* 계약 단계 */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">계약 단계</p>
              <div className="flex gap-1 flex-wrap">
                {CONTRACT_STAGES.map((s, i) => (
                  <div key={s} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
                    i === contractStageIdx ? STAGE_COLORS[s] + ' font-medium' :
                    i < contractStageIdx ? 'text-gray-300' : 'bg-gray-50 text-gray-400'
                  }`}>
                    {i < contractStageIdx && <span>✓</span>}
                    {s}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 입금 현황 */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-2">입금 현황</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">선금 (20%)</span>
                    <span className="text-green-600 font-medium">840만원 ✓</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">잔금 (80%)</span>
                    <span className="text-gray-300">3,360만원</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full" style={{ width: '20%' }} />
                  </div>
                </div>
              </div>
              {/* 계약 정보 */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                {[
                  { k: '계약 유형', v: '용역계약' },
                  { k: '발행사', v: '(주)유어메이트' },
                  { k: '계약일', v: '2026-04-12' },
                  { k: '정산 예정', v: '2026-06-20' },
                ].map(r => (
                  <div key={r.k} className="flex justify-between text-xs">
                    <span className="text-gray-400">{r.k}</span>
                    <span className="text-gray-700">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4">
            <div className="space-y-2.5">
              {COSTS.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-14 flex-shrink-0">{c.category}</span>
                  <span className="flex-1 text-sm text-gray-700">{c.item}</span>
                  <span className="text-sm font-medium text-gray-800">{(c.amount / 10000).toLocaleString()}만</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">이익</span>
              <div className="text-right">
                <p className="text-base font-bold text-green-600">{fmtMoney(profit)}</p>
                <p className="text-xs text-gray-400">마진 {margin}%</p>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── 기본 정보 (접기) ── */}
      <Section title="기본 정보" defaultOpen={false}>
        <div className="px-5 py-4 grid grid-cols-2 gap-3 text-sm">
          {[
            { k: '고객 기관', v: PROJECT.client_org },
            { k: '고객 담당자', v: PROJECT.contact_name },
            { k: '연락처', v: PROJECT.phone },
            { k: '담당 팀원', v: PROJECT.assignee },
            { k: '유입일', v: PROJECT.inflow_date },
            { k: '행사일', v: PROJECT.event_date },
          ].map(r => (
            <div key={r.k}>
              <p className="text-xs text-gray-400 mb-0.5">{r.k}</p>
              <p className="text-gray-700 font-medium">{r.v}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
