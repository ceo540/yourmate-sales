'use client'
import { useState } from 'react'

const STATUS_BADGE: Record<string, string> = {
  '유입':    'bg-blue-100 text-blue-700',
  '회신대기': 'bg-yellow-100 text-yellow-700',
  '견적발송': 'bg-orange-100 text-orange-700',
  '조율중':   'bg-purple-100 text-purple-700',
  '계약':    'bg-teal-100 text-teal-700',
  '취소':    'bg-red-100 text-red-400',
}
const STATUS_BAR: Record<string, string> = {
  '유입':    'bg-blue-500',
  '회신대기': 'bg-yellow-400',
  '견적발송': 'bg-orange-400',
  '조율중':   'bg-purple-400',
  '계약':    'bg-teal-500',
  '취소':    'bg-red-300',
}

const STATUSES = ['유입', '회신대기', '견적발송', '조율중', '계약', '취소']

type Lead = {
  id: string; lead_id: string; client_org: string; contact_name: string
  service_type: string; status: string; remind_date: string | null
  assignee: string; converted_sale_id: string | null
  relatedSales: { id: string; name: string; payment_status: string }[]
}

const MOCK_LEADS: Lead[] = [
  { id: '1', lead_id: 'LEAD20260408-0001', client_org: '○○초등학교', contact_name: '김교감', service_type: '교육프로그램', status: '견적발송', remind_date: '2026-04-11', assignee: '조민현', converted_sale_id: null, relatedSales: [] },
  { id: '2', lead_id: 'LEAD20260407-0003', client_org: '△△문화재단', contact_name: '이팀장', service_type: '행사운영', status: '조율중', remind_date: '2026-04-09', assignee: '임지영', converted_sale_id: null, relatedSales: [] },
  { id: '3', lead_id: 'LEAD20260405-0002', client_org: '□□교육청', contact_name: '박장학사', service_type: 'SOS', status: '유입', remind_date: null, assignee: '방준영', converted_sale_id: null, relatedSales: [] },
  { id: '4', lead_id: 'LEAD20260401-0001', client_org: '★★복지관', contact_name: '최관장', service_type: '콘텐츠제작', status: '계약', remind_date: null, assignee: '임지영', converted_sale_id: 'sale-1', relatedSales: [{ id: 'sale-1', name: '★★복지관 영상제작', payment_status: '계약전' }] },
  { id: '5', lead_id: 'LEAD20260328-0002', client_org: '◇◇중학교', contact_name: '정선생', service_type: '납품설치', status: '계약', remind_date: null, assignee: '방준영', converted_sale_id: 'sale-2', relatedSales: [{ id: 'sale-2', name: '◇◇중 음향장비 납품', payment_status: '선금수령' }, { id: 'sale-3', name: '◇◇중 추가 설치', payment_status: '계약전' }] },
  { id: '6', lead_id: 'LEAD20260320-0001', client_org: '△△아트센터', contact_name: '', service_type: '행사대여', status: '취소', remind_date: null, assignee: '조민현', converted_sale_id: null, relatedSales: [] },
]

function daysFromToday(d: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const t = new Date(d); t.setHours(0,0,0,0)
  return Math.round((t.getTime() - today.getTime()) / 86400000)
}
function getDday(r: string | null) {
  if (!r) return null
  const diff = daysFromToday(r)
  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, color: 'bg-red-100 text-red-700 font-bold' }
  if (diff === 0) return { label: 'D-day', color: 'bg-red-500 text-white font-bold' }
  if (diff <= 3)  return { label: `D-${diff}`, color: 'bg-orange-100 text-orange-700 font-semibold' }
  if (diff <= 7)  return { label: `D-${diff}`, color: 'bg-yellow-100 text-yellow-700' }
  return { label: `D-${diff}`, color: 'bg-gray-100 text-gray-400' }
}

export default function LeadsDemoV2() {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)
  const [statusFilter, setStatusFilter] = useState('활성')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showConverted, setShowConverted] = useState(false)

  // 활성 = 계약/취소 제외, 완료 = 계약+취소
  const filtered = leads.filter(l => {
    if (statusFilter === '활성') return !['계약', '취소'].includes(l.status)
    if (statusFilter === '계약') return l.status === '계약'
    if (statusFilter === '취소') return l.status === '취소'
    if (statusFilter === '전체') return true
    return l.status === statusFilter
  })

  function handleConvert(leadId: string) {
    const saleName = leads.find(l => l.id === leadId)?.client_org + ' (전환건)'
    setLeads(prev => prev.map(l => l.id === leadId ? {
      ...l,
      status: '계약',
      converted_sale_id: 'demo-sale',
      relatedSales: [{ id: 'demo-sale', name: saleName, payment_status: '계약전' }],
    } : l))
    setSelected(prev => prev?.id === leadId ? {
      ...prev,
      status: '계약',
      converted_sale_id: 'demo-sale',
      relatedSales: [{ id: 'demo-sale', name: saleName, payment_status: '계약전' }],
    } : prev)
    // 필터를 활성으로 유지 (계약으로 빠짐)
    setTimeout(() => setStatusFilter('활성'), 600)
    setSelected(null)
  }

  const activeCnt = leads.filter(l => !['계약','취소'].includes(l.status)).length
  const contractCnt = leads.filter(l => l.status === '계약').length
  const cancelCnt = leads.filter(l => l.status === '취소').length

  return (
    <div className="max-w-7xl mx-auto">
      {/* 데모 안내 배너 */}
      <div className="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800 flex items-center gap-2">
        <span className="font-bold">[데모]</span>
        <span>이 페이지는 <b>'계약' 상태 도입 제안</b>을 보여주는 목업입니다. 실제 데이터가 아닙니다.</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">리드 관리 <span className="text-sm font-normal text-yellow-600 ml-2">v2 데모</span></h1>
          <p className="text-gray-500 text-sm mt-1">잠재 고객 문의 및 영업 파이프라인</p>
        </div>
      </div>

      {/* 파이프라인 흐름 시각화 */}
      <div className="mb-5 bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-400 mb-3 font-medium">리드 파이프라인 흐름</p>
        <div className="flex items-center gap-1 flex-wrap">
          {['유입', '회신대기', '견적발송', '조율중'].map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[s]}`}>{s}</span>
              <span className="text-gray-300 text-xs">→</span>
            </div>
          ))}
          <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-teal-100 text-teal-700 ring-2 ring-teal-300">계약 ✓</span>
          <span className="text-gray-300 mx-2">|</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-400">취소</span>
        </div>
        <p className="text-xs text-gray-400 mt-2.5">
          계약 전환 시 리드는 <b className="text-teal-700">'계약'</b> 상태로 닫히고, 매출건 관리로 넘어갑니다.<br/>
          <span className="text-gray-300">기존 '진행중' 상태 제거 — '계약' 상태가 전환 완료를 의미합니다.</span>
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-blue-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 mb-1">활성 리드</p>
          <p className="text-2xl font-bold text-blue-600">{activeCnt}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 mb-1">리마인드 초과</p>
          <p className="text-2xl font-bold text-red-500">{leads.filter(l => l.remind_date && !['계약','취소'].includes(l.status) && daysFromToday(l.remind_date) <= 0).length}</p>
        </div>
        <div className="bg-teal-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 mb-1">계약 완료</p>
          <p className="text-2xl font-bold text-teal-600">{contractCnt}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 mb-1">취소</p>
          <p className="text-2xl font-bold text-gray-400">{cancelCnt}</p>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[
          { key: '활성', label: `활성 리드 (${activeCnt})`, primary: true },
          ...STATUSES.filter(s => !['계약','취소'].includes(s)).map(s => ({
            key: s, label: `${s} (${leads.filter(l => l.status === s).length})`, primary: false
          })),
          { key: '계약', label: `계약 완료 (${contractCnt})`, primary: false },
          { key: '취소', label: `취소 (${cancelCnt})`, primary: false },
          { key: '전체', label: '전체', primary: false },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setStatusFilter(tab.key); setSelected(null) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === tab.key
                ? tab.primary ? 'text-gray-900' : 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            style={statusFilter === tab.key && tab.primary ? { backgroundColor: '#FFCE00' } : {}}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 스플릿 뷰 */}
      <div className="flex flex-col md:flex-row gap-4 md:h-[calc(100vh-460px)] md:min-h-[480px]">

        {/* 리드 목록 */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} md:w-[55%] flex-col border border-gray-200 rounded-xl bg-white overflow-hidden`}>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-1">
                <p>{statusFilter === '활성' ? '활성 리드가 없어요.' : '해당 항목이 없어요.'}</p>
                {statusFilter === '활성' && contractCnt > 0 && (
                  <button onClick={() => setStatusFilter('계약')} className="text-xs text-teal-600 underline mt-1">계약 완료 리드 보기 →</button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="border-b border-gray-100">
                    <th className="w-1 p-0" />
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-20">D-day</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">기관명</th>
                    <th className="hidden sm:table-cell text-left px-3 py-3 text-xs font-semibold text-gray-500">서비스</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lead => {
                    const dday = getDday(lead.remind_date)
                    const isContract = lead.status === '계약'
                    const isSelected = selected?.id === lead.id
                    return (
                      <tr key={lead.id}
                        onClick={() => setSelected(isSelected ? null : lead)}
                        className={`border-t border-gray-50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-yellow-50 ring-1 ring-inset ring-yellow-200' :
                          isContract ? 'opacity-60 hover:opacity-80 hover:bg-gray-50' :
                          'hover:bg-gray-50'
                        }`}>
                        <td className="p-0">
                          <div className={`w-1 min-h-[52px] ${STATUS_BAR[lead.status] || 'bg-gray-200'}`} />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {dday
                            ? <span className={`text-xs px-2 py-0.5 rounded-full ${dday.color}`}>{dday.label}</span>
                            : isContract
                              ? <span className="text-teal-400 text-xs">✓</span>
                              : <span className="text-gray-300 text-xs">-</span>}
                        </td>
                        <td className="px-3 py-3">
                          <div className={`font-medium text-sm leading-tight ${isContract ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{lead.client_org}</div>
                          <div className="text-xs text-gray-400">{lead.contact_name}</div>
                        </td>
                        <td className="hidden sm:table-cell px-3 py-3">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">{lead.service_type}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[lead.status] || ''}`}>
                            {lead.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 상세 패널 */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-gray-200 rounded-xl bg-white overflow-hidden`}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <span className="text-3xl">👈</span>
              <p className="text-sm">왼쪽에서 리드를 선택하세요</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 shrink-0">
                <button onClick={() => setSelected(null)} className="md:hidden flex items-center gap-1 text-xs text-gray-400 mb-2">← 목록으로</button>
                <p className="text-xs text-gray-400">{selected.lead_id}</p>
                <h2 className="text-base font-bold text-gray-900">{selected.client_org}</h2>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[selected.status] || ''}`}>{selected.status}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{selected.service_type}</span>
                  {selected.status === '계약' && (
                    <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">계약건 {selected.relatedSales.length}개 연결됨</span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                {/* 기본 정보 */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  {[
                    ['담당자', selected.contact_name || '-'],
                    ['담당 직원', selected.assignee],
                    ['서비스', selected.service_type],
                    ['리마인드', selected.remind_date || '-'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span className="text-gray-400 text-xs">{k}</span>
                      <p className="text-gray-800 text-sm font-medium">{v}</p>
                    </div>
                  ))}
                </div>

                {/* 계약 상태일 때: 연관 매출건 */}
                {selected.status === '계약' && selected.relatedSales.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">연관 매출건 ({selected.relatedSales.length})</p>
                    <div className="space-y-1.5">
                      {selected.relatedSales.map(sale => (
                        <a key={sale.id} href={`/sales/${sale.id}`}
                          className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl px-3 py-2.5 hover:border-teal-300 hover:bg-teal-100 transition-colors group">
                          <p className="text-sm font-medium text-gray-800 group-hover:text-teal-700 transition-colors">{sale.name}</p>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sale.payment_status === '계약전' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                              {sale.payment_status}
                            </span>
                            <span className="text-xs text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                          </div>
                        </a>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">매출 진행은 <b>/sales</b> 또는 <b>/pipeline</b>에서 관리됩니다.</p>
                  </div>
                )}

                {/* 활성 리드: 상태 변경 시뮬레이션 */}
                {!['계약', '취소'].includes(selected.status) && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">상태 변경</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {STATUSES.filter(s => !['계약','취소'].includes(s)).map(s => (
                        <button key={s} onClick={() => {
                          setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, status: s } : l))
                          setSelected(prev => prev ? { ...prev, status: s } : prev)
                        }}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${selected.status === s ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* 하단 버튼 */}
              <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0 flex-wrap">
                {selected.status === '계약' ? (
                  <div className="w-full text-center text-xs text-gray-400 py-1">
                    이 리드는 계약으로 전환 완료되었습니다. 매출건에서 진행 관리하세요.
                  </div>
                ) : selected.status === '취소' ? (
                  <div className="w-full text-center text-xs text-gray-400 py-1">취소된 리드입니다.</div>
                ) : (
                  <>
                    <button
                      onClick={() => handleConvert(selected.id)}
                      className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg"
                      style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                      계약 전환 (시뮬레이션)
                    </button>
                    <button
                      onClick={() => {
                        setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, status: '취소' } : l))
                        setSelected(null)
                      }}
                      className="px-3 py-2 text-sm text-red-400 border border-red-100 rounded-lg hover:bg-red-50">
                      취소
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 하단 비교 설명 */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-500 mb-2">현재 방식</p>
          <div className="space-y-1 text-xs text-gray-600">
            <p>• 전환 후 리드 상태 → <b>진행중</b> (활성 리드처럼 보임)</p>
            <p>• 활성/전환 리드가 섞여서 파이프라인이 지저분</p>
            <p>• "진행중"이 리드 진행 중인지, 매출건 진행 중인지 애매</p>
          </div>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <p className="text-xs font-bold text-teal-700 mb-2">제안 방식 (v2)</p>
          <div className="space-y-1 text-xs text-teal-800">
            <p>• 전환 후 리드 상태 → <b className="text-teal-700">계약</b> (명확하게 닫힘)</p>
            <p>• 기본 탭 = 활성 리드만 (계약/취소 자동 필터)</p>
            <p>• 계약 탭에서 전환된 리드 + 연결된 매출건 조회 가능</p>
          </div>
        </div>
      </div>
    </div>
  )
}
