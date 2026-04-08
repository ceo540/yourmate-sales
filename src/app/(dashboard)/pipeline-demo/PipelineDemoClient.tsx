'use client'
import { useState } from 'react'

// ─── 3컬럼 파이프라인 단계 ──────────────────────────────────────
const STAGES = [
  {
    key: 'lead',
    label: '리드',
    sub: '유입 · 견적 · 협의',
    color: 'border-blue-200 bg-blue-50',
    headerBg: 'bg-blue-100',
    dot: 'bg-blue-400',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'active',
    label: '계약 · 진행',
    sub: '계약완료 · 착수중',
    color: 'border-yellow-200 bg-yellow-50',
    headerBg: 'bg-yellow-100',
    dot: 'bg-yellow-400',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  {
    key: 'done',
    label: '완수 · 완납',
    sub: '완수대기 · 완납',
    color: 'border-green-200 bg-green-50',
    headerBg: 'bg-green-100',
    dot: 'bg-green-400',
    badge: 'bg-green-100 text-green-700',
  },
] as const

type StageKey = typeof STAGES[number]['key']

// ─── 목업 데이터 ────────────────────────────────────────────────
interface PipelineItem {
  id: string
  stage: StageKey
  stageLabel: string   // 실제 세부 단계
  org: string
  service: string
  assignee: string
  revenue: number | null
  dday: number | null
}

const MOCK: PipelineItem[] = [
  { id:'1',  stage:'lead',   stageLabel:'유입',     org:'서울 △△중학교',    service:'SOS',       assignee:'방준영', revenue:null,     dday:5    },
  { id:'2',  stage:'lead',   stageLabel:'유입',     org:'경기 □□고등학교',  service:'교구대여',   assignee:'임지영', revenue:null,     dday:-2   },
  { id:'3',  stage:'lead',   stageLabel:'유입',     org:'○○교육청',         service:'교육프로그램',assignee:'조민현', revenue:null,     dday:12   },
  { id:'4',  stage:'lead',   stageLabel:'견적발송', org:'인천 ▽▽초등학교',  service:'납품설치',   assignee:'방준영', revenue:8500000,  dday:3    },
  { id:'5',  stage:'lead',   stageLabel:'견적발송', org:'수원 ◇◇중학교',    service:'행사운영',   assignee:'임지영', revenue:3200000,  dday:0    },
  { id:'6',  stage:'lead',   stageLabel:'협의중',   org:'부산 ★★고등학교',  service:'SOS',       assignee:'조민현', revenue:15000000, dday:-1   },
  { id:'7',  stage:'lead',   stageLabel:'협의중',   org:'△△특수학교',       service:'납품설치',   assignee:'방준영', revenue:5600000,  dday:7    },
  { id:'8',  stage:'active', stageLabel:'계약완료', org:'용인 ◎◎중학교',    service:'교육프로그램',assignee:'임지영', revenue:7800000,  dday:14   },
  { id:'9',  stage:'active', stageLabel:'계약완료', org:'광주 □□교육청',    service:'002ENT',    assignee:'방준영', revenue:20000000, dday:null },
  { id:'10', stage:'active', stageLabel:'착수중',   org:'안산 △△중학교',    service:'행사운영',   assignee:'조민현', revenue:4500000,  dday:3    },
  { id:'11', stage:'active', stageLabel:'착수중',   org:'성남 ○○고',         service:'콘텐츠제작', assignee:'임지영', revenue:9000000,  dday:10   },
  { id:'12', stage:'active', stageLabel:'착수중',   org:'경기 ★★초등학교',  service:'납품설치',   assignee:'방준영', revenue:3300000,  dday:2    },
  { id:'13', stage:'done',   stageLabel:'완수(잔금대기)',org:'인천 ▲▲중학교',service:'행사운영',   assignee:'조민현', revenue:6600000,  dday:null },
  { id:'14', stage:'done',   stageLabel:'완수(잔금대기)',org:'경기 ◆◆고',    service:'SOS',       assignee:'방준영', revenue:18000000, dday:null },
  { id:'15', stage:'done',   stageLabel:'완납',     org:'서울 □□초등학교',  service:'납품설치',   assignee:'임지영', revenue:2800000,  dday:null },
  { id:'16', stage:'done',   stageLabel:'완납',     org:'부산 △△중학교',    service:'교육프로그램',assignee:'조민현', revenue:5100000,  dday:null },
]

const ASSIGNEES = ['전체', '방준영', '임지영', '조민현']
const SERVICES  = ['전체', 'SOS', '교구대여', '교육프로그램', '납품설치', '행사운영', '콘텐츠제작', '002ENT']

const SERVICE_COLORS: Record<string, string> = {
  'SOS':         'bg-blue-50 text-blue-600',
  '교구대여':     'bg-emerald-50 text-emerald-600',
  '교육프로그램': 'bg-purple-50 text-purple-600',
  '납품설치':     'bg-amber-50 text-amber-700',
  '행사운영':     'bg-orange-50 text-orange-600',
  '콘텐츠제작':   'bg-pink-50 text-pink-600',
  '002ENT':      'bg-indigo-50 text-indigo-600',
}

const STAGE_LABEL_COLORS: Record<string, string> = {
  '유입':          'text-blue-500',
  '견적발송':      'text-orange-500',
  '협의중':        'text-purple-500',
  '계약완료':      'text-yellow-600',
  '착수중':        'text-green-600',
  '완수(잔금대기)':'text-teal-600',
  '완납':          'text-gray-400',
}

function fmt(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}천만`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return `${n.toLocaleString()}원`
}

function DdayBadge({ dday }: { dday: number | null }) {
  if (dday === null) return null
  if (dday < 0)   return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-bold shrink-0">D+{Math.abs(dday)}</span>
  if (dday === 0) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold shrink-0">D-day</span>
  if (dday <= 3)  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold shrink-0">D-{dday}</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">D-{dday}</span>
}

export default function PipelineDemoClient() {
  const [assignee, setAssignee] = useState('전체')
  const [service,  setService]  = useState('전체')

  const filtered = MOCK.filter(m =>
    (assignee === '전체' || m.assignee === assignee) &&
    (service  === '전체' || m.service  === service)
  )

  const stageData = STAGES.map(s => {
    const items = filtered.filter(m => m.stage === s.key)
    return {
      ...s,
      items,
      total: items.reduce((acc, m) => acc + (m.revenue ?? 0), 0),
    }
  })

  const totalActive   = filtered.filter(m => m.stage !== 'done').length
  const totalRevenue  = filtered.reduce((a, m) => a + (m.revenue ?? 0), 0)
  const pendingRevenue= filtered.filter(m => m.stageLabel === '완수(잔금대기)').reduce((a, m) => a + (m.revenue ?? 0), 0)
  const urgentCount   = filtered.filter(m => m.dday !== null && m.dday >= 0 && m.dday <= 3).length

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">파이프라인</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">데모</span>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '진행 중',     value: `${totalActive}건` },
          { label: '총 예상 매출', value: totalRevenue ? fmt(totalRevenue) : '-' },
          { label: '잔금 대기',    value: pendingRevenue ? fmt(pendingRevenue) : '-' },
          { label: '긴급 (D-3)',   value: `${urgentCount}건`, red: urgentCount > 0 },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${c.red ? 'text-red-500' : 'text-gray-900'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* 담당자 탭 */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {ASSIGNEES.map(a => (
            <button key={a} onClick={() => setAssignee(a)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                assignee === a ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {a}
            </button>
          ))}
        </div>

        {/* 서비스 드롭다운 */}
        <select value={service} onChange={e => setService(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400">
          {SERVICES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* ── 칸반 3컬럼 ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stageData.map(stage => (
          <div key={stage.key} className={`rounded-2xl border p-3 ${stage.color}`}>
            {/* 컬럼 헤더 */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                  <span className="text-sm font-bold text-gray-800">{stage.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.badge}`}>{stage.items.length}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 ml-3.5">{stage.sub}</p>
              </div>
              {stage.total > 0 && (
                <span className="text-sm font-bold text-gray-700">{fmt(stage.total)}</span>
              )}
            </div>

            {/* 카드 목록 */}
            <div className="space-y-2">
              {stage.items.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl h-20 flex items-center justify-center">
                  <span className="text-xs text-gray-300">없음</span>
                </div>
              ) : stage.items.map(item => (
                <div key={item.id}
                  className="bg-white border border-gray-100 rounded-xl px-3.5 py-3 hover:border-yellow-300 hover:shadow-sm transition-all cursor-pointer">
                  {/* 세부 단계 + D-day */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-semibold ${STAGE_LABEL_COLORS[item.stageLabel] ?? 'text-gray-400'}`}>
                      {item.stageLabel}
                    </span>
                    <DdayBadge dday={item.dday} />
                  </div>

                  {/* 기관명 */}
                  <p className="text-sm font-semibold text-gray-800 leading-tight mb-1">{item.org}</p>

                  {/* 서비스 + 담당자 */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SERVICE_COLORS[item.service] ?? 'bg-gray-100 text-gray-500'}`}>
                      {item.service}
                    </span>
                    <span className="text-[11px] text-gray-400">{item.assignee}</span>
                  </div>

                  {/* 매출 */}
                  {item.revenue && (
                    <p className="text-xs font-bold text-gray-700 mt-1.5">{fmt(item.revenue)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-300 text-right">* 목업 데이터입니다</p>
    </div>
  )
}
