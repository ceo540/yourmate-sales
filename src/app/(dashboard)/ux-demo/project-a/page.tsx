'use client'

import { useState } from 'react'

// ── 목업 데이터 ────────────────────────────────────────────────────────────────
const PROJECT = {
  id: '1',
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
  dropbox: 'https://www.dropbox.com/home/...',
  notes: '음향 장비 사전 점검 필수. 86명 규모 진드페 행사. 특수교육 학생 대상으로 보조교사 별도 배치 필요.',
  notion_url: null,
}

const PIPELINE = ['유입', '협의중', '견적발송', '계약', '진행중', '완료']

const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']

const TASKS = [
  { id: 1, title: '사전답사 일정 확정', status: '완료', assignee: '임지영', due: '2026-04-18', priority: '높음' },
  { id: 2, title: '강사 섭외 및 계약', status: '진행중', assignee: '임지영', due: '2026-04-25', priority: '긴급' },
  { id: 3, title: '음향 장비 사전 점검', status: '할 일', assignee: '유제민', due: '2026-05-10', priority: '높음' },
  { id: 4, title: '행사 진행 매뉴얼 작성', status: '할 일', assignee: '임지영', due: '2026-05-20', priority: '보통' },
  { id: 5, title: '세금계산서 발행', status: '할 일', assignee: '방준영', due: '2026-06-20', priority: '보통' },
]

const LOGS = [
  { id: 1, date: '2026-04-20', type: '방문', author: '임지영', content: '곤지암리조트 사전답사 완료. 음향 설치 위치 확인. 무대 사이즈 10x6m, 좌석 86석 세팅 가능 확인.' },
  { id: 2, date: '2026-04-15', type: '통화', author: '임지영', content: '김미현 주무관 통화 — 행사 테마 "함께하는 우리" 확정. 프로그램 초안 4/25까지 제출 요청.' },
  { id: 3, date: '2026-04-10', type: '이메일', author: '방준영', content: '견적서 발송 완료. 총액 4,200만원. 교통비/숙박비 별도 협의 예정.' },
  { id: 4, date: '2026-04-05', type: '내부회의', author: '임지영', content: '사업부 회의 — 강사 풀 검토. 음악치료사 2명 + 무용치료사 1명 조합으로 결정.' },
]

const COSTS = [
  { id: 1, item: '강사비 (음악치료사 2명)', category: '인건비', amount: 8000000 },
  { id: 2, item: '강사비 (무용치료사 1명)', category: '인건비', amount: 3000000 },
  { id: 3, item: '음향 장비 렌탈', category: '장비', amount: 5500000 },
  { id: 4, item: '교통·숙박', category: '경비', amount: 2000000 },
  { id: 5, item: '소모품·재료비', category: '기타', amount: 1500000 },
  { id: 6, item: '기타 용역비', category: '기타', amount: 8500000 },
]

const CONTRACT_INFO = {
  type: '용역계약',
  entity: '(주)유어메이트',
  signed_date: '2026-04-12',
  payment_date: '2026-06-20',
  advance: 8400000,
  balance: 33600000,
}

const TYPE_COLORS: Record<string, string> = {
  방문: 'bg-green-50 text-green-600 border-green-100',
  통화: 'bg-blue-50 text-blue-600 border-blue-100',
  이메일: 'bg-purple-50 text-purple-600 border-purple-100',
  내부회의: 'bg-orange-50 text-orange-600 border-orange-100',
  메모: 'bg-yellow-50 text-yellow-700 border-yellow-100',
}

const STATUS_STYLE: Record<string, string> = {
  '완료': 'bg-green-100 text-green-700',
  '진행중': 'bg-blue-100 text-blue-700',
  '할 일': 'bg-gray-100 text-gray-500',
  '보류': 'bg-red-100 text-red-500',
}

const PRIORITY_DOT: Record<string, string> = {
  긴급: 'bg-red-500', 높음: 'bg-orange-400', 보통: 'bg-gray-300', 낮음: 'bg-gray-200',
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
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000000) return `${Math.round(n / 10000000) * 10}백만`
  return `${Math.round(n / 10000)}만`
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function ProjectDemoA() {
  const [finTab, setFinTab] = useState<'contract' | 'cost'>('contract')
  const [tasks, setTasks] = useState(TASKS)
  const [newLog, setNewLog] = useState('')
  const [logs, setLogs] = useState(LOGS)
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending'>('pending')

  const pipelineIdx = PIPELINE.indexOf(PROJECT.pipeline_status)
  const contractStageIdx = CONTRACT_STAGES.indexOf(PROJECT.contract_stage)
  const pendingTasks = tasks.filter(t => t.status !== '완료')
  const profit = PROJECT.revenue - PROJECT.cost
  const margin = Math.round((profit / PROJECT.revenue) * 100)

  function toggleTask(id: number) {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: t.status === '완료' ? '할 일' : '완료' } : t))
  }

  const shownTasks = taskFilter === 'pending' ? pendingTasks : tasks

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 상단 헤더 ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-400">교육프로그램</span>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-400">아트키움 사업부</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 truncate">{PROJECT.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{PROJECT.client_org} · {PROJECT.contact_name}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${STAGE_COLORS[PROJECT.contract_stage]}`}>
                {PROJECT.contract_stage}
              </span>
              <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg font-medium hover:bg-gray-700">
                수정
              </button>
            </div>
          </div>

          {/* 파이프라인 진행 바 */}
          <div className="flex items-center gap-0 mt-4">
            {PIPELINE.map((stage, i) => (
              <div key={stage} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  i < pipelineIdx ? 'text-gray-400' :
                  i === pipelineIdx ? 'bg-yellow-400 text-gray-900 shadow-sm' :
                  'text-gray-300'
                }`}>
                  {i < pipelineIdx && <span className="text-green-500">✓</span>}
                  {stage}
                </div>
                {i < PIPELINE.length - 1 && (
                  <span className={`text-xs mx-0.5 ${i < pipelineIdx ? 'text-gray-300' : 'text-gray-200'}`}>›</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 본문: 좌우 분할 ── */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6 items-start">

        {/* ── 좌측: 메인 콘텐츠 ──────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* 요약 카드 4개 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '매출', value: fmtMoney(PROJECT.revenue) + '원', sub: '계약금액', color: 'text-gray-900' },
              { label: '원가', value: fmtMoney(PROJECT.cost) + '원', sub: `마진 ${margin}%`, color: 'text-gray-900' },
              { label: '진행 업무', value: `${pendingTasks.length}건`, sub: `전체 ${tasks.length}건`, color: pendingTasks.length > 0 ? 'text-blue-600' : 'text-green-600' },
              { label: '행사일', value: '6/11', sub: 'D-52', color: 'text-orange-500' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* 메모 */}
          {PROJECT.notes && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-yellow-700 mb-1">메모</p>
              <p className="text-sm text-yellow-800 leading-relaxed">{PROJECT.notes}</p>
            </div>
          )}

          {/* 업무 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-800">업무</h2>
                <div className="flex gap-1">
                  {(['pending', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setTaskFilter(f)}
                      className={`text-xs px-2 py-0.5 rounded-full ${taskFilter === f ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                      {f === 'pending' ? `진행중 ${pendingTasks.length}` : `전체 ${tasks.length}`}
                    </button>
                  ))}
                </div>
              </div>
              <button className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">+ 추가</button>
            </div>
            <div className="divide-y divide-gray-50">
              {shownTasks.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400">진행 중인 업무 없음</p>
              ) : shownTasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
                  <button onClick={() => toggleTask(t.id)}
                    className={`w-4.5 h-4.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      t.status === '완료' ? 'border-green-400 bg-green-400' : 'border-gray-300 hover:border-gray-500'
                    }`}>
                    {t.status === '완료' && <span className="text-white text-xs leading-none">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${t.status === '완료' ? 'line-through text-gray-300' : 'text-gray-800'}`}>{t.title}</p>
                    <p className="text-xs text-gray-400">{t.assignee} · {t.due ? `마감 ${t.due}` : '마감일 미정'}</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 소통 내역 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">소통 내역</h2>
              <span className="text-xs text-gray-400">{logs.length}건</span>
            </div>

            {/* 입력 */}
            <div className="px-4 pt-3 pb-2 border-b border-gray-50">
              <textarea
                value={newLog}
                onChange={e => setNewLog(e.target.value)}
                placeholder="소통 내용 입력..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
                rows={2}
              />
              <div className="flex gap-2 mt-2">
                {['통화', '이메일', '방문', '메모'].map(t => (
                  <button key={t} onClick={() => {
                    if (!newLog.trim()) return
                    setLogs(ls => [{ id: Date.now(), date: new Date().toISOString().slice(0, 10), type: t, author: '방준영', content: newLog }, ...ls])
                    setNewLog('')
                  }}
                    className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                    + {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 로그 리스트 */}
            <div className="divide-y divide-gray-50">
              {logs.map(l => (
                <div key={l.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${TYPE_COLORS[l.type] || 'bg-gray-50 text-gray-500 border-gray-100'}`}>{l.type}</span>
                    <span className="text-xs text-gray-400">{l.date}</span>
                    <span className="text-xs text-gray-400">{l.author}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{l.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Claude 협업 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">Claude 협업</h2>
              <span className="text-xs text-gray-400">자동으로 프로젝트 맥락 주입됨</span>
            </div>
            <div className="p-4">
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-500">이 프로젝트에 대해 질문하거나 업무를 지시할 수 있어요.</p>
                <p className="text-xs text-gray-400 mt-1">예: "강사 계약서 초안 작성해줘" / "김미현 주무관에게 보낼 일정 확인 이메일 써줘"</p>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="메시지 입력..." className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                <button className="px-4 py-2 bg-yellow-400 text-gray-900 text-sm font-medium rounded-lg hover:bg-yellow-300">전송</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 우측: 재무 사이드바 (sticky) ───────────────── */}
        <div className="w-80 flex-shrink-0 sticky top-4 space-y-4">

          {/* 기본 정보 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">기본 정보</h2>
            </div>
            <div className="px-4 py-3 space-y-2.5 text-sm">
              {[
                { label: '담당자', value: PROJECT.assignee },
                { label: '고객 담당자', value: PROJECT.contact_name },
                { label: '연락처', value: PROJECT.phone },
                { label: '유입일', value: PROJECT.inflow_date },
                { label: '행사일', value: PROJECT.event_date },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-gray-400">{r.label}</span>
                  <span className="text-gray-700 font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 재무 탭 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex border-b border-gray-100">
              {(['contract', 'cost'] as const).map(t => (
                <button key={t} onClick={() => setFinTab(t)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all ${finTab === t ? 'text-gray-900 border-b-2 border-yellow-400' : 'text-gray-400'}`}>
                  {t === 'contract' ? '계약 정보' : '원가'}
                </button>
              ))}
            </div>

            {finTab === 'contract' && (
              <div className="px-4 py-3 space-y-3">
                {/* 계약 단계 진행 */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">계약 단계</p>
                  <div className="flex flex-wrap gap-1">
                    {CONTRACT_STAGES.map((s, i) => (
                      <span key={s} className={`text-xs px-2 py-0.5 rounded-full ${
                        i < contractStageIdx ? 'text-gray-300 line-through' :
                        i === contractStageIdx ? STAGE_COLORS[s] :
                        'text-gray-300'
                      }`}>{s}</span>
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-50 pt-3 space-y-2 text-sm">
                  {[
                    { label: '계약 유형', value: CONTRACT_INFO.type },
                    { label: '발행사', value: CONTRACT_INFO.entity },
                    { label: '계약일', value: CONTRACT_INFO.signed_date },
                    { label: '정산일', value: CONTRACT_INFO.payment_date },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between">
                      <span className="text-gray-400">{r.label}</span>
                      <span className="text-gray-700">{r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-50 pt-3">
                  <p className="text-xs text-gray-400 mb-2">입금 현황</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">선금 20%</span>
                      <span className="text-green-600 font-medium">{(CONTRACT_INFO.advance / 10000).toLocaleString()}만원 ✓</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">잔금 80%</span>
                      <span className="text-gray-300">{(CONTRACT_INFO.balance / 10000).toLocaleString()}만원</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full" style={{ width: '20%' }} />
                  </div>
                </div>
              </div>
            )}

            {finTab === 'cost' && (
              <div className="px-4 py-3">
                <div className="space-y-2">
                  {COSTS.map(c => (
                    <div key={c.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 truncate flex-1 mr-2">{c.item}</span>
                      <span className="text-gray-700 font-medium flex-shrink-0">{(c.amount / 10000).toLocaleString()}만</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 mt-3 pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-700">원가 합계</span>
                    <span className="text-gray-900">{(PROJECT.cost / 10000).toLocaleString()}만원</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">매출</span>
                    <span className="text-gray-500">{(PROJECT.revenue / 10000).toLocaleString()}만원</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-green-600">이익</span>
                    <span className="text-green-600">{((PROJECT.revenue - PROJECT.cost) / 10000).toLocaleString()}만원 ({margin}%)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 드롭박스 링크 */}
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-2">연결된 폴더</p>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-blue-500 text-sm">☁</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-blue-600 truncate hover:underline cursor-pointer">Dropbox 폴더 열기</p>
                <p className="text-xs text-gray-400 truncate">아트키움/2 프로젝트/260414 경기도...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
