'use client'

import Link from 'next/link'

interface Project {
  id: string
  name: string
  project_number: string | null
  service_type: string | null
  department: string | null
  status: string
  dropbox_url: string | null
  memo: string | null
  notes: string | null
  customer_id: string | null
  pm_id: string | null
}

interface Props {
  project: Project
  isAdmin: boolean
  currentUserId: string
}

const STATUS_CLR: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-red-100 text-red-600',
  '취소':   'bg-gray-100 text-gray-500',
}

export default function ProjectV2Client({ project }: Props) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* ── 헤더 ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2 text-xs">
          <Link href="/projects" className="text-gray-400 hover:text-gray-700">← 프로젝트 목록</Link>
          <span className="text-gray-300">·</span>
          <Link href={`/projects/${project.id}`} className="text-gray-400 hover:text-gray-700">기존 페이지</Link>
          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>V2 미리보기</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {project.project_number && (
            <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {project.project_number}
            </span>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLR[project.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {project.status}
          </span>
          {project.service_type && (
            <span className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
              {project.service_type}
            </span>
          )}
        </div>
      </div>

      {/* ── 2-column 본문 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* 좌: 메인 */}
        <div className="space-y-4">
          <PlaceholderCard title="◆ 프로젝트 개요 (V1.6 예정)" subtitle="클라이언트 / 과업 / 진행 상황 위키" />
          <PlaceholderCard title="◆ 소통 Timeline (V1.7 예정)" subtitle="통화·이메일·미팅·메모 통합 시간순" />
          <PlaceholderCard title="◆ 일정 (V1.7 일부)" subtitle="이 프로젝트 관련 캘린더 이벤트" />
          <PlaceholderCard title="◆ 연관 서비스 (V1.8 예정)" subtitle="렌탈 N건 / SOS N건 카드 + 직접 추가" />
          <PlaceholderCard title="◆ 계약 / 업무 / 메모 (V1.9 예정)" subtitle="기존 기능 통합 정리" />
        </div>

        {/* 우: 사이드 */}
        <aside className="space-y-3 lg:sticky lg:top-4 self-start">
          <PlaceholderCard title="🤖 빵빵이" subtitle="V1.3 — 능동 제안 V2.0" small />
          <PlaceholderCard title="📋 기본정보" subtitle="V1.4 — 고객사·담당자·부서" small />
          <PlaceholderCard title="💰 재무 요약" subtitle="V1.5 — 매출·원가·수금" small />
          {project.dropbox_url && (
            <a href={project.dropbox_url} target="_blank" rel="noopener noreferrer"
              className="block bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 hover:bg-blue-100 transition-colors">
              <p className="text-xs text-blue-600 font-semibold">📁 드롭박스 폴더</p>
              <p className="text-xs text-blue-400 mt-1 truncate">열기 ↗</p>
            </a>
          )}
        </aside>
      </div>

      <p className="text-center text-xs text-gray-300 mt-8">
        V2는 구축 중입니다. 한 단계씩 채워집니다.
      </p>
    </div>
  )
}

function PlaceholderCard({ title, subtitle, small }: { title: string; subtitle: string; small?: boolean }) {
  return (
    <div className={`bg-white border border-dashed border-gray-200 rounded-xl ${small ? 'px-4 py-3' : 'px-5 py-4'}`}>
      <p className={`font-semibold text-gray-700 ${small ? 'text-xs' : 'text-sm'}`}>{title}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  )
}
