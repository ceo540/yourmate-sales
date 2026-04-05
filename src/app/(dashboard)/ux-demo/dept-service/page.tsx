'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── 목업 데이터 (실제 학교상점 기반) ────────────────────────────────
const PROJECTS = {
  납품설치: [
    { id: '1', name: '260306 삼일공고(지지스튜디오)', client: '삼일공고', revenue: 250, stage: '견적', assignee: '임지영', memo: null },
    { id: '2', name: '260312 용인 공유학교(첼로)', client: '용인교육지원청', revenue: 120, stage: '계약', assignee: '조민현', memo: '첼로 납품건, 렌탈계약으로 결제 진행' },
    { id: '3', name: '260310 디지털피아노(박진우)', client: '박진우 주무관', revenue: 380, stage: '납품', assignee: '임지영', memo: null },
    { id: '4', name: '260317 동백청소년문화의집', client: '동백청소년', revenue: 290, stage: '완료', assignee: '조민현', memo: null },
  ],
  렌탈: [
    { id: '5', name: '260211 송파구청 교구대여', client: '송파구청', revenue: 50, stage: '수거완료', assignee: '조민현', delivery: '2026-02-20', pickup: '2026-03-01' },
  ],
  유지보수: [],
  제작인쇄: [
    { id: '6', name: '260325 용인교육지원청_L자화일', client: '용인교육지원청', revenue: 15, stage: '완료', assignee: '임지영', memo: null },
  ],
  미분류: [
    { id: '7', name: '260319 광명시꿈드림', client: '광명시청소년재단', revenue: 50, stage: '계약', assignee: '-', memo: null },
    { id: '8', name: '260319 보정청소년문화의집', client: '보정청소년', revenue: 45, stage: '견적', assignee: '-', memo: null },
  ],
}

const STAGES_납품설치 = ['견적', '계약', '납품', '완료']
const STAGE_COLORS: Record<string, string> = {
  견적:    'bg-gray-100 text-gray-600',
  계약:    'bg-blue-100 text-blue-700',
  납품:    'bg-yellow-100 text-yellow-700',
  완료:    'bg-green-100 text-green-700',
  수거완료: 'bg-green-100 text-green-700',
}

export default function DemoA() {
  const [service, setService] = useState('납품설치')

  const services = ['납품설치', '렌탈', '유지보수', '제작인쇄', '미분류']
  const counts: Record<string, number> = Object.fromEntries(
    services.map(s => [s, (PROJECTS as any)[s]?.length ?? 0])
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* 데모 배너 */}
      <div className="mb-4 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
        <p className="text-xs text-purple-700 font-medium">🎨 안 A 데모 — 서비스별 탭 분리 방식</p>
        <Link href="/ux-demo/project-hub" className="text-xs text-purple-600 underline">안 B 데모 보기 →</Link>
      </div>

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl">🏫</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">학교상점</h1>
          <p className="text-sm text-gray-400">납품설치 · 렌탈 · 유지보수 · 제작인쇄</p>
        </div>
      </div>

      {/* 서비스 탭 (메인 네비게이션) */}
      <div className="flex gap-2 flex-wrap mb-6 pb-4 border-b border-gray-200">
        {services.map(s => (
          <button
            key={s}
            onClick={() => setService(s)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              service === s
                ? 'text-gray-900 border-transparent shadow-sm'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
            style={service === s ? { backgroundColor: '#FFCE00', borderColor: '#FFCE00' } : {}}
          >
            {s}
            <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
              service === s ? 'bg-black/10 text-gray-900' : 'bg-gray-100 text-gray-400'
            }`}>{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* ── 납품설치 뷰 ── */}
      {service === '납품설치' && (
        <div>
          {/* 파이프라인 요약 */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {STAGES_납품설치.map(stage => {
              const cnt = PROJECTS.납품설치.filter(p => p.stage === stage).length
              return (
                <div key={stage} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{cnt}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[stage]}`}>{stage}</span>
                </div>
              )
            })}
          </div>

          {/* 프로젝트 목록 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {PROJECTS.납품설치.map((p, idx) => (
              <div key={p.id} className={`flex items-start gap-3 px-4 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${idx !== PROJECTS.납품설치.length - 1 ? 'border-b border-gray-50' : ''}`}>
                {/* 단계 표시 */}
                <div className="w-16 flex-shrink-0 pt-0.5">
                  <span className={`text-[11px] px-2 py-1 rounded-lg font-medium ${STAGE_COLORS[p.stage]}`}>{p.stage}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.client}</p>
                  {p.memo && (
                    <p className="text-xs text-gray-500 mt-1.5 bg-yellow-50 px-2 py-1 rounded">💬 {p.memo}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{p.revenue}만</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.assignee}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 px-1">* 건 클릭 시 상세 진행/메모/업무 열람·수정 가능 (실제 구현 시)</p>
        </div>
      )}

      {/* ── 렌탈 뷰 ── */}
      {service === '렌탈' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">렌탈은 배송·수거 일정 중심으로 관리</p>
            <Link href="/rentals" className="px-3 py-1.5 text-sm font-semibold rounded-lg hover:opacity-80" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              렌탈 관리 →
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {PROJECTS.렌탈.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-gray-400">📦 배송 {p.delivery}</span>
                    <span className="text-xs text-gray-400">↩ 수거 {p.pickup}</span>
                  </div>
                </div>
                <span className={`text-[11px] px-2 py-1 rounded-lg font-medium ${STAGE_COLORS[p.stage]}`}>{p.stage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 유지보수 뷰 ── */}
      {service === '유지보수' && (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
          <p className="text-3xl mb-3">🔧</p>
          <p className="text-gray-500 font-medium">유지보수 건 없음</p>
          <p className="text-sm text-gray-400 mt-1">새 요청 접수 시 여기서 관리</p>
          <button className="mt-4 px-4 py-2 text-sm font-semibold rounded-lg" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            + 유지보수 등록
          </button>
        </div>
      )}

      {/* ── 제작인쇄 뷰 ── */}
      {service === '제작인쇄' && (
        <div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {PROJECTS.제작인쇄.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.client}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{p.revenue}만</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[p.stage]}`}>{p.stage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 미분류 뷰 ── */}
      {service === '미분류' && (
        <div>
          <div className="mb-3 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg">
            <p className="text-xs text-orange-700">서비스 타입 미지정 건입니다. 계약 수정에서 서비스를 지정해 주세요.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {PROJECTS.미분류.map((p: any, idx: number) => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-4 ${idx !== PROJECTS.미분류.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.client}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{p.revenue}만</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[p.stage] ?? 'bg-gray-100 text-gray-400'}`}>{p.stage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
