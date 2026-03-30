'use client'
import { useState } from 'react'

const SAMPLE = [
  { id: '1', name: '2025 ○○학교 졸업앨범', dept: '앨범사업부', revenue: 8500000, cost: 3200000, status: '완납' },
  { id: '2', name: '△△시 홍보영상 제작', dept: '영상사업부', revenue: 5000000, cost: 1800000, status: '선금수령' },
  { id: '3', name: '□□기관 웹사이트 구축', dept: '디지털사업부', revenue: 12000000, cost: 4500000, status: '계약완료' },
]

const STATUS_COLORS: Record<string, string> = {
  '계약전': 'bg-gray-100 text-gray-500',
  '계약완료': 'bg-blue-50 text-blue-600',
  '선금수령': 'bg-yellow-50 text-yellow-700',
  '완납': 'bg-green-50 text-green-600',
}

// ── 공통 테이블 헤더 ──────────────────────────────────────────────
function TableHead() {
  return (
    <thead>
      <tr className="border-b border-gray-100 bg-gray-50">
        <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">건명</th>
        <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">사업부</th>
        <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">매출액</th>
        <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">원가</th>
        <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">이익</th>
        <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">수금상태</th>
      </tr>
    </thead>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 드로어 (현재 방식)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DrawerDemo() {
  const [open, setOpen] = useState<typeof SAMPLE[0] | null>(null)
  return (
    <div className="relative">
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
        <table className="w-full">
          <TableHead />
          <tbody className="divide-y divide-gray-50">
            {SAMPLE.map(s => (
              <tr key={s.id} onClick={() => setOpen(s)}
                className="cursor-pointer hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{s.dept}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">{s.revenue.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">{s.cost.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-green-600">{(s.revenue - s.cost).toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(null)} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-[360px] bg-white shadow-2xl flex flex-col border-l border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400">매출 건 상세</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{open.name}</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded p-1 text-lg">×</button>
            </div>
            <div className="flex-1 p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">건명</label>
                <input defaultValue={open.name} className="mt-1.5 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">사업부</label>
                <input defaultValue={open.dept} className="mt-1.5 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">매출액</label>
                <input defaultValue={open.revenue} className="mt-1.5 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
                이익: <span className="font-bold text-green-600">{(open.revenue - open.cost).toLocaleString()}원</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">원가 항목</label>
                <div className="mt-1.5 border border-gray-100 rounded-lg p-3 text-xs text-gray-400 text-center py-6 bg-gray-50">
                  원가 항목 편집 영역
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
              <button onClick={() => setOpen(null)} className="px-4 py-2.5 rounded-lg text-sm bg-gray-100 text-gray-600">닫기</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. 행 확장
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ExpandDemo() {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
      <table className="w-full">
        <TableHead />
        <tbody className="divide-y divide-gray-50">
          {SAMPLE.map(s => (
            <>
              <tr key={s.id} onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className={`cursor-pointer transition-colors ${expanded === s.id ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  <span className="mr-2 text-gray-400">{expanded === s.id ? '▾' : '▸'}</span>{s.name}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{s.dept}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">{s.revenue.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">{s.cost.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-green-600">{(s.revenue - s.cost).toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span></td>
              </tr>
              {expanded === s.id && (
                <tr key={`${s.id}-expand`}>
                  <td colSpan={6} className="p-0 border-b-2 border-yellow-300 bg-yellow-50/40">
                    <div className="px-6 py-4 grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">건명</label>
                        <input defaultValue={s.name} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">매출액</label>
                        <input defaultValue={s.revenue} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">수금상태</label>
                        <select defaultValue={s.status} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white">
                          {Object.keys(STATUS_COLORS).map(k => <option key={k}>{k}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">원가 항목</label>
                        <div className="border border-gray-100 rounded-lg p-3 text-xs text-gray-400 text-center py-4 bg-white">
                          원가 항목 편집 영역
                        </div>
                      </div>
                      <div className="col-span-3 flex gap-2">
                        <button className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                        <button onClick={() => setExpanded(null)} className="px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-600">닫기</button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. 인라인 편집
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function InlineDemo() {
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)
  const [data, setData] = useState(SAMPLE.map(s => ({ ...s })))

  const isEditing = (id: string, field: string) => editing?.id === id && editing?.field === field

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
      <p className="text-xs text-gray-400 px-4 pt-3 pb-1">셀을 직접 클릭해서 편집해보세요</p>
      <table className="w-full">
        <TableHead />
        <tbody className="divide-y divide-gray-50">
          {data.map(s => (
            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2.5" onClick={() => setEditing({ id: s.id, field: 'name' })}>
                {isEditing(s.id, 'name') ? (
                  <input autoFocus defaultValue={s.name}
                    onBlur={e => { setData(prev => prev.map(r => r.id === s.id ? { ...r, name: e.target.value } : r)); setEditing(null) }}
                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="w-full px-2 py-1 border border-yellow-400 rounded text-sm focus:outline-none bg-yellow-50" />
                ) : (
                  <span className="text-sm font-medium text-gray-900 cursor-text hover:bg-yellow-50 px-2 py-1 rounded block">{s.name}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{s.dept}</td>
              <td className="px-4 py-2.5" onClick={() => setEditing({ id: s.id, field: 'revenue' })}>
                {isEditing(s.id, 'revenue') ? (
                  <input autoFocus type="number" defaultValue={s.revenue}
                    onBlur={e => { setData(prev => prev.map(r => r.id === s.id ? { ...r, revenue: Number(e.target.value) } : r)); setEditing(null) }}
                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="w-full px-2 py-1 border border-yellow-400 rounded text-sm text-right focus:outline-none bg-yellow-50" />
                ) : (
                  <span className="text-sm text-gray-900 cursor-text hover:bg-yellow-50 px-2 py-1 rounded block text-right">{s.revenue.toLocaleString()}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-gray-600">{s.cost.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right text-sm font-medium text-green-600">{(s.revenue - s.cost).toLocaleString()}</td>
              <td className="px-4 py-2.5" onClick={() => setEditing({ id: s.id, field: 'status' })}>
                {isEditing(s.id, 'status') ? (
                  <select autoFocus defaultValue={s.status}
                    onBlur={e => { setData(prev => prev.map(r => r.id === s.id ? { ...r, status: e.target.value } : r)); setEditing(null) }}
                    onChange={e => { setData(prev => prev.map(r => r.id === s.id ? { ...r, status: e.target.value } : r)); setEditing(null) }}
                    className="px-2 py-1 border border-yellow-400 rounded text-xs focus:outline-none bg-yellow-50">
                    {Object.keys(STATUS_COLORS).map(k => <option key={k}>{k}</option>)}
                  </select>
                ) : (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. 모달
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ModalDemo() {
  const [open, setOpen] = useState<typeof SAMPLE[0] | null>(null)
  return (
    <div>
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
        <table className="w-full">
          <TableHead />
          <tbody className="divide-y divide-gray-50">
            {SAMPLE.map(s => (
              <tr key={s.id} onClick={() => setOpen(s)}
                className="cursor-pointer hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{s.dept}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">{s.revenue.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">{s.cost.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-green-600">{(s.revenue - s.cost).toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{open.name}</h2>
              <button onClick={() => setOpen(null)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 text-lg">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">건명</label>
                  <input defaultValue={open.name} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">사업부</label>
                  <input defaultValue={open.dept} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">매출액</label>
                  <input defaultValue={open.revenue} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">수금상태</label>
                  <select defaultValue={open.status} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white">
                    {Object.keys(STATUS_COLORS).map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">원가 항목</label>
                <div className="border border-gray-100 rounded-lg text-xs text-gray-400 text-center py-6 bg-gray-50">
                  원가 항목 편집 영역
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
                이익: <span className="font-bold text-green-600">{(open.revenue - open.cost).toLocaleString()}원</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
              <button onClick={() => setOpen(null)} className="px-5 py-2.5 rounded-lg text-sm bg-gray-100 text-gray-600">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 페이지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DEMOS = [
  {
    key: 'drawer',
    label: '드로어 (현재)',
    tag: '사용 중',
    tagColor: 'bg-yellow-100 text-yellow-800',
    desc: '행 클릭 시 오른쪽에서 패널이 밀려 나옴. 테이블을 보면서 편집 가능.',
    pros: ['테이블 컨텍스트 유지', '원가 포함 모든 항목 수용', '닫기 전까지 계속 편집 가능'],
    cons: ['화면 일부가 가려짐', '좁은 화면에서 불편'],
    component: DrawerDemo,
  },
  {
    key: 'expand',
    label: '행 확장',
    tag: '추천',
    tagColor: 'bg-green-100 text-green-700',
    desc: '행 클릭 시 그 아래로 폼이 펼쳐짐. 테이블 흐름을 벗어나지 않음.',
    pros: ['가장 자연스러운 흐름', '화면이 가려지지 않음', '여러 행 동시 펼침 가능'],
    cons: ['폼이 길면 스크롤 많아짐', '원가 항목까지 넣으면 다소 빽빽'],
    component: ExpandDemo,
  },
  {
    key: 'inline',
    label: '인라인 편집',
    tag: '빠른 편집',
    tagColor: 'bg-blue-100 text-blue-700',
    desc: '셀을 클릭하면 그 자리에서 바로 편집. 원가처럼 복잡한 항목은 별도 처리 필요.',
    pros: ['가장 빠른 편집', '화면 이동 없음', '스캔하며 빠르게 수정'],
    cons: ['원가 항목 편집은 따로 처리 필요', '실수로 클릭할 수 있음'],
    component: InlineDemo,
  },
  {
    key: 'modal',
    label: '모달',
    tag: '',
    tagColor: '',
    desc: '행 클릭 시 화면 중앙에 다이얼로그가 뜸. 드로어와 유사하나 화면을 더 많이 가림.',
    pros: ['시선이 집중됨', '내용이 잘 보임'],
    cons: ['테이블이 완전히 가려짐', '드로어 대비 차별점 적음'],
    component: ModalDemo,
  },
]

export default function UXDemoPage() {
  const [active, setActive] = useState('drawer')
  const demo = DEMOS.find(d => d.key === active)!
  const Component = demo.component

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">UX 패턴 비교</h1>
        <p className="text-gray-500 text-sm mt-1">행 클릭 시 편집 방식 — 직접 클릭해서 비교해보세요</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {DEMOS.map(d => (
          <button key={d.key} onClick={() => setActive(d.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              active === d.key ? 'text-gray-900 shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            style={active === d.key ? { backgroundColor: '#FFCE00' } : {}}>
            {d.label}
            {d.tag && <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${d.tagColor}`}>{d.tag}</span>}
          </button>
        ))}
      </div>

      {/* 설명 카드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <p className="text-sm text-gray-700 mb-4">{demo.desc}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-green-700 mb-2">장점</p>
            <ul className="space-y-1">
              {demo.pros.map((p, i) => <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span>{p}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-red-600 mb-2">단점</p>
            <ul className="space-y-1">
              {demo.cons.map((c, i) => <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✕</span>{c}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* 데모 */}
      <Component />
    </div>
  )
}
