'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── 현재 메뉴 구조 ───────────────────────────────────────────
interface NavItem { href: string; label: string; icon: string; admin?: boolean }

const ALL_MENUS: Record<string, NavItem[]> = {
  영업: [
    { href: '/dashboard',    label: '대시보드',    icon: '🏠' },
    { href: '/sales',        label: '매출 현황',   icon: '💰' },
    { href: '/sales/report', label: '계약 목록',   icon: '📄' },
    { href: '/leads',        label: '리드 관리',   icon: '📥' },
    { href: '/tasks',        label: '업무 관리',   icon: '✅' },
  ],
  재무: [
    { href: '/receivables',  label: '미수금 현황', icon: '🔔' },
    { href: '/payments',     label: '지급 관리',   icon: '📋', admin: true },
    { href: '/finance',      label: '재무 현황',   icon: '📈', admin: true },
    { href: '/payroll',      label: '인건비 관리', icon: '💼', admin: true },
    { href: '/fixed-costs',  label: '고정비 관리', icon: '🔒', admin: true },
    { href: '/cashflow',     label: '자금일보',    icon: '📊', admin: true },
  ],
  관리: [
    { href: '/customers',    label: '고객 DB',     icon: '🗂️' },
    { href: '/vendors',      label: '거래처 DB',   icon: '🏢' },
    { href: '/admin',        label: '팀원 관리',   icon: '⚙️', admin: true },
  ],
}

const CATEGORIES = ['영업', '재무', '관리'] as const
type Category = typeof CATEGORIES[number]
const CATEGORY_COLORS: Record<Category, string> = {
  영업: 'text-blue-500',
  재무: 'text-emerald-500',
  관리: 'text-gray-400',
}
const TAB_COLORS: Record<Category, { active: string; dot: string }> = {
  영업: { active: 'border-blue-500 text-blue-600', dot: 'bg-blue-500' },
  재무: { active: 'border-emerald-500 text-emerald-600', dot: 'bg-emerald-500' },
  관리: { active: 'border-gray-500 text-gray-600', dot: 'bg-gray-500' },
}

// ─── Option A: 그룹형 사이드바 ─────────────────────────────────
function OptionA() {
  return (
    <div className="flex h-[520px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* 사이드바 */}
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFCE00' }}>
              <span className="text-xs font-black" style={{ color: '#121212' }}>Y</span>
            </div>
            <p className="text-sm font-bold text-gray-900">유어메이트</p>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
          {CATEGORIES.map(cat => (
            <div key={cat}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest px-2 mb-1 ${CATEGORY_COLORS[cat]}`}>{cat}</p>
              {ALL_MENUS[cat].map(item => (
                <div
                  key={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    item.admin ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.admin && <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-yellow-50 text-yellow-600">관리자</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
              <span className="text-xs font-bold text-yellow-800">방</span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-800">방준영</p>
              <span className="text-[10px] text-yellow-700 bg-yellow-50 px-1.5 rounded">관리자</span>
            </div>
          </div>
        </div>
      </aside>

      {/* 콘텐츠 */}
      <div className="flex-1 bg-gray-50 p-6">
        <p className="text-xs text-gray-400 mb-4">그룹형 사이드바 — 카테고리 레이블로 구분</p>
        <div className="space-y-2">
          <div className="bg-white rounded-lg p-4 border border-gray-100 text-sm text-gray-500">페이지 내용</div>
          <div className="bg-white rounded-lg p-3 border border-gray-100 text-xs text-gray-300">카드</div>
          <div className="bg-white rounded-lg p-3 border border-gray-100 text-xs text-gray-300">카드</div>
        </div>
      </div>
    </div>
  )
}

// ─── Option B: 상단 탭 + 사이드 서브메뉴 ──────────────────────
function OptionB() {
  const [activeCat, setActiveCat] = useState<Category>('영업')
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm h-[520px] flex flex-col">
      {/* 상단 탭 바 */}
      <div className="bg-white border-b border-gray-200 flex items-center px-4 gap-1">
        <div className="flex items-center gap-2 py-3 pr-6 border-r border-gray-100 mr-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFCE00' }}>
            <span className="text-[10px] font-black" style={{ color: '#121212' }}>Y</span>
          </div>
          <span className="text-xs font-bold text-gray-900">유어메이트</span>
        </div>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`px-4 py-3.5 text-xs font-semibold border-b-2 transition-all ${
              activeCat === cat ? TAB_COLORS[cat].active : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${activeCat === cat ? TAB_COLORS[cat].dot : 'bg-gray-300'}`} />
              {cat}
            </div>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 py-2">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
              <span className="text-[10px] font-bold text-yellow-800">방</span>
            </div>
            <span className="text-xs text-gray-600">방준영</span>
          </div>
        </div>
      </div>

      {/* 바디 */}
      <div className="flex flex-1 overflow-hidden bg-gray-50">
        {/* 서브 메뉴 */}
        <aside className="w-44 bg-white border-r border-gray-100 px-2 py-3 space-y-0.5">
          {ALL_MENUS[activeCat].map(item => (
            <div
              key={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                item.admin ? 'text-gray-400 hover:bg-gray-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.admin && <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-yellow-50 text-yellow-600">관리자</span>}
            </div>
          ))}
        </aside>

        {/* 콘텐츠 */}
        <div className="flex-1 p-6">
          <p className="text-xs text-gray-400 mb-4">상단 탭 + 서브 사이드바 — 카테고리 클릭 시 서브 메뉴 전환</p>
          <div className="space-y-2">
            <div className="bg-white rounded-lg p-4 border border-gray-100 text-sm text-gray-500">페이지 내용</div>
            <div className="bg-white rounded-lg p-3 border border-gray-100 text-xs text-gray-300">카드</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Option C: 아이콘 사이드바 ─────────────────────────────────
function OptionC() {
  const [hovered, setHovered] = useState<string | null>(null)
  const allItems = Object.values(ALL_MENUS).flat()

  return (
    <div className="flex h-[520px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* 좁은 아이콘 바 */}
      <aside className="w-14 bg-white border-r border-gray-100 flex flex-col items-center py-3 gap-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#FFCE00' }}>
          <span className="text-sm font-black" style={{ color: '#121212' }}>Y</span>
        </div>
        {allItems.map(item => (
          <div
            key={item.href}
            className="relative group"
            onMouseEnter={() => setHovered(item.href)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors text-base ${
              item.admin ? 'hover:bg-yellow-50 opacity-60' : 'hover:bg-gray-100'
            }`}>
              {item.icon}
            </div>
            {/* 툴팁 */}
            {hovered === item.href && (
              <div className="absolute left-12 top-1/2 -translate-y-1/2 z-50 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg pointer-events-none">
                {item.label}
                {item.admin && <span className="ml-1.5 text-yellow-300 text-[9px]">관리자</span>}
              </div>
            )}
          </div>
        ))}
        <div className="mt-auto">
          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
            <span className="text-xs font-bold text-yellow-800">방</span>
          </div>
        </div>
      </aside>

      {/* 콘텐츠 */}
      <div className="flex-1 bg-gray-50 p-6">
        <p className="text-xs text-gray-400 mb-4">아이콘 사이드바 — 아이콘에 마우스 올리면 이름 표시 (가장 컴팩트)</p>
        <div className="space-y-2">
          <div className="bg-white rounded-lg p-4 border border-gray-100 text-sm text-gray-500">페이지 내용</div>
          <div className="bg-white rounded-lg p-3 border border-gray-100 text-xs text-gray-300">카드</div>
          <div className="bg-white rounded-lg p-3 border border-gray-100 text-xs text-gray-300">카드</div>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 ──────────────────────────────────────────────────────
const OPTIONS = [
  {
    id: 'A',
    label: 'A. 그룹형 사이드바',
    desc: '지금이랑 비슷한데 카테고리 레이블로 묶음. 가장 무난하고 빠르게 적용 가능.',
    pros: ['현재 구조와 유사 → 적용 쉬움', '카테고리가 한눈에 보임'],
    cons: ['사이드바 높이는 그대로'],
  },
  {
    id: 'B',
    label: 'B. 상단 탭 + 서브 사이드바',
    desc: '상단에 영업·재무·관리 탭, 클릭하면 해당 메뉴만 사이드바에 표시.',
    pros: ['메뉴가 카테고리별로 분리돼 깔끔', '확장성 좋음 (카테고리 추가 쉬움)'],
    cons: ['클릭 2번 필요', '현재 구조 변경 필요'],
  },
  {
    id: 'C',
    label: 'C. 아이콘 전용 사이드바',
    desc: '아이콘만 표시, 마우스 올리면 이름 툴팁. 가장 컴팩트하지만 초보자에겐 불편.',
    pros: ['사이드바가 가장 좁음 (콘텐츠 영역 극대화)'],
    cons: ['아이콘 외워야 함', '빠른 메뉴 파악 어려움'],
  },
]

export default function NavDemoPage() {
  const [selected, setSelected] = useState<'A' | 'B' | 'C'>('A')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">네비게이션 구조 데모</h1>
        <p className="text-sm text-gray-400 mt-1">현재 메뉴 14개를 3가지 방식으로 정리해봤어. 원하는 방향 골라줘.</p>
      </div>

      {/* 옵션 선택 */}
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id as 'A' | 'B' | 'C')}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              selected === opt.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <p className="text-sm font-semibold text-gray-900 mb-1">{opt.label}</p>
            <p className="text-xs text-gray-500 mb-3">{opt.desc}</p>
            <div className="space-y-1">
              {opt.pros.map(p => (
                <p key={p} className="text-[11px] text-emerald-600">✓ {p}</p>
              ))}
              {opt.cons.map(c => (
                <p key={c} className="text-[11px] text-gray-400">— {c}</p>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* 프리뷰 */}
      <div>
        <p className="text-xs text-gray-400 mb-3">미리보기 (마우스 올리거나 클릭해봐)</p>
        {selected === 'A' && <OptionA />}
        {selected === 'B' && <OptionB />}
        {selected === 'C' && <OptionC />}
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
        어떤 방향으로 갈지 정해지면 바로 실제 사이드바에 적용할게.
      </div>

      <div className="pb-4">
        <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">← 대시보드로 돌아가기</Link>
      </div>
    </div>
  )
}
