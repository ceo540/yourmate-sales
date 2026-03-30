'use client'
import { useState } from 'react'

const MOCK_SALE = {
  id: 'demo',
  name: '2025 ○○학교 졸업앨범',
  revenue: 12000000,
}

const MOCK_COSTS = [
  { id: '1', item: '부가세', amount: 1200000, category: '내부원가', is_paid: false },
  { id: '2', item: '감가상각비', amount: 720000, category: '내부원가', is_paid: false },
  { id: '3', item: '지급수수료', amount: 240000, category: '내부원가', is_paid: false },
  { id: '4', item: '프리랜서', amount: 800000, category: '외부원가', is_paid: true },
  { id: '5', item: '인쇄소', amount: 2100000, category: '외부원가', is_paid: false },
]

const INNER = MOCK_COSTS.filter(c => c.category === '내부원가')
const OUTER = MOCK_COSTS.filter(c => c.category === '외부원가')
const TOTAL = MOCK_COSTS.reduce((s, c) => s + c.amount, 0)
const PROFIT = MOCK_SALE.revenue - TOTAL

function CostList() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">내부원가</p>
        <div className="space-y-1.5">
          {INNER.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <span className="flex-1 text-sm text-gray-800">{item.item}</span>
              <span className="text-sm font-medium text-gray-700">{item.amount.toLocaleString()}원</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">외부원가</p>
        <div className="space-y-1.5">
          {OUTER.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <span className="flex-1 text-sm text-gray-800">{item.item}</span>
              <span className="text-sm font-medium text-gray-700">{item.amount.toLocaleString()}원</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_paid ? 'bg-green-100 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                {item.is_paid ? '지급완료' : '미지급'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
        <span className="text-gray-500">총 원가 <strong className="text-gray-800">{TOTAL.toLocaleString()}원</strong></span>
        <span className="text-gray-500">이익 <strong className="text-green-600">{PROFIT.toLocaleString()}원</strong></span>
      </div>
    </div>
  )
}

// ─── UI 1: 팝업 모달 ───────────────────────────────────────
function ModalDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <table className="w-full">
          <tbody>
            <tr className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3.5 text-sm font-medium text-gray-900">{MOCK_SALE.name}</td>
              <td className="px-4 py-3.5 text-right text-sm text-gray-700">{MOCK_SALE.revenue.toLocaleString()}</td>
              <td className="px-4 py-3.5 text-right">
                <button
                  onClick={() => setOpen(true)}
                  className="text-sm text-gray-600 hover:text-yellow-700 font-medium underline decoration-dashed underline-offset-2"
                >
                  {TOTAL.toLocaleString()}
                </button>
              </td>
              <td className="px-4 py-3.5 text-right text-sm font-medium text-green-600">{PROFIT.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 text-center">↑ 원가 숫자 클릭</p>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">세부 원가</h2>
                <p className="text-xs text-gray-400 mt-0.5">{MOCK_SALE.name}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-4">
              <CostList />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
              <button onClick={() => setOpen(false)} className="px-5 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── UI 2: 우측 슬라이드 패널 ─────────────────────────────
function DrawerDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <table className="w-full">
          <tbody>
            <tr className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3.5 text-sm font-medium text-gray-900">{MOCK_SALE.name}</td>
              <td className="px-4 py-3.5 text-right text-sm text-gray-700">{MOCK_SALE.revenue.toLocaleString()}</td>
              <td className="px-4 py-3.5 text-right">
                <button
                  onClick={() => setOpen(true)}
                  className="text-sm text-gray-600 hover:text-yellow-700 font-medium underline decoration-dashed underline-offset-2"
                >
                  {TOTAL.toLocaleString()}
                </button>
              </td>
              <td className="px-4 py-3.5 text-right text-sm font-medium text-green-600">{PROFIT.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 text-center">↑ 원가 숫자 클릭</p>

      {/* 오버레이 */}
      {open && <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setOpen(false)} />}

      {/* 슬라이드 패널 */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">세부 원가</h2>
            <p className="text-xs text-gray-400 mt-0.5">{MOCK_SALE.name}</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <CostList />
        </div>
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button onClick={() => setOpen(false)} className="px-5 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>완료</button>
        </div>
      </div>
    </div>
  )
}

// ─── UI 3: 인라인 확장 (Accordion) ───────────────────────
function AccordionDemo() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <table className="w-full">
          <tbody>
            <tr
              className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${expanded ? 'bg-yellow-50' : ''}`}
              onClick={() => setExpanded(!expanded)}
            >
              <td className="px-4 py-3.5 text-sm font-medium text-gray-900 flex items-center gap-2">
                <span className={`text-gray-300 text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
                {MOCK_SALE.name}
              </td>
              <td className="px-4 py-3.5 text-right text-sm text-gray-700">{MOCK_SALE.revenue.toLocaleString()}</td>
              <td className="px-4 py-3.5 text-right text-sm font-medium text-gray-600 underline decoration-dashed underline-offset-2">
                {TOTAL.toLocaleString()}
              </td>
              <td className="px-4 py-3.5 text-right text-sm font-medium text-green-600">{PROFIT.toLocaleString()}</td>
            </tr>
            {expanded && (
              <tr>
                <td colSpan={4} className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                  <CostList />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 text-center">↑ 행 전체 클릭</p>
    </div>
  )
}

// ─── 메인 데모 페이지 ──────────────────────────────────────
const UIS = [
  {
    id: 'modal',
    label: '① 팝업 모달',
    desc: '현재 방식. 화면 중앙에 팝업으로 띄움. 배경이 어두워지면서 집중됨.',
    pros: ['집중 편집에 좋음', '모바일에서도 깔끔'],
    cons: ['보고서 테이블이 가려짐'],
    Component: ModalDemo,
  },
  {
    id: 'drawer',
    label: '② 우측 슬라이드 패널',
    desc: '오른쪽에서 패널이 밀려들어옴. 보고서 테이블을 보면서 원가 편집 가능.',
    pros: ['테이블을 보면서 편집', '공간이 넓어 항목이 많아도 편함'],
    cons: ['화면이 좁으면 덮힐 수 있음'],
    Component: DrawerDemo,
  },
  {
    id: 'accordion',
    label: '③ 인라인 확장',
    desc: '행을 클릭하면 바로 아래로 펼쳐짐. 모달/패널 없이 테이블 안에서 처리.',
    pros: ['가장 심플', '페이지 이동 없이 빠름'],
    cons: ['항목이 많으면 스크롤이 길어짐'],
    Component: AccordionDemo,
  },
]

export default function CostUIDemoPage() {
  const [activeTab, setActiveTab] = useState('modal')
  const active = UIS.find(u => u.id === activeTab)!

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">원가 입력 UI 비교</h1>
        <p className="text-sm text-gray-400 mt-1">각 탭을 눌러 직접 체험해보세요. 원가 숫자를 클릭하면 작동합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        {UIS.map(u => (
          <button
            key={u.id}
            onClick={() => setActiveTab(u.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === u.id ? 'text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === u.id ? { backgroundColor: '#FFCE00' } : { backgroundColor: '#f3f4f6' }}
          >
            {u.label}
          </button>
        ))}
      </div>

      {/* 설명 */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
        <p className="text-sm text-gray-700 mb-3">{active.desc}</p>
        <div className="flex gap-6">
          <div>
            <p className="text-xs font-semibold text-green-600 mb-1">장점</p>
            {active.pros.map(p => <p key={p} className="text-xs text-gray-600">✓ {p}</p>)}
          </div>
          <div>
            <p className="text-xs font-semibold text-red-400 mb-1">단점</p>
            {active.cons.map(c => <p key={c} className="text-xs text-gray-500">· {c}</p>)}
          </div>
        </div>
      </div>

      {/* 데모 영역 */}
      <div className="relative">
        <div className="absolute -top-2 left-3 bg-yellow-400 text-xs font-semibold px-2 py-0.5 rounded text-gray-900 z-10">
          데모
        </div>
        <div className="border-2 border-yellow-300 rounded-xl p-5 pt-6">
          <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-400 px-4 mb-2">
            <span>건명</span>
            <span className="text-right">매출액</span>
            <span className="text-right">원가 ↗</span>
            <span className="text-right">이익</span>
          </div>
          <active.Component />
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        마음에 드는 UI 방식을 알려주시면 실제 매출 보고서에 적용할게요.
      </p>
    </div>
  )
}
