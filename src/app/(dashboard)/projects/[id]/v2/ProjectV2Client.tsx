'use client'

import Link from 'next/link'
import ProjectClaudeChat from '@/components/ProjectClaudeChat'

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
interface Customer {
  id: string; name: string; type: string | null
  contact_name: string | null; phone: string | null; contact_email: string | null
}
interface ContactPerson {
  name: string; dept: string | null; title: string | null
  phone: string | null; email: string | null
}
interface Finance {
  revenue: number; cost: number; received: number; contractCount: number
}
interface Contract {
  id: string; name: string; revenue: number | null
  contract_stage: string | null; progress_status: string | null
  client_org: string | null
}
interface Task {
  id: string; title: string; status: string; priority: string | null
  due_date: string | null; project_id: string | null
}
interface Log {
  id: string; content: string; log_type: string; log_category: string | null
  contacted_at: string | null; created_at: string
  author_name: string | null
  sale_id: string | null
  location: string | null
  participants: string[] | null
  outcome: string | null
}
interface Rental {
  id: string; sale_id: string | null; customer_name: string
  status: string; rental_start: string | null; rental_end: string | null
}

interface Props {
  project: Project
  pmName: string | null
  customer: Customer | null
  contactPerson: ContactPerson | null
  finance: Finance
  contracts: Contract[]
  tasks: Task[]
  logs: Log[]
  rentals: Rental[]
  leadIds: string[]
  isAdmin: boolean
  currentUserId: string
}

const STATUS_CLR: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-red-100 text-red-600',
  '취소':   'bg-gray-100 text-gray-500',
}

function fmtMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}

export default function ProjectV2Client({
  project, pmName, customer, contactPerson, finance,
  contracts, tasks, logs, rentals, leadIds, currentUserId,
}: Props) {
  const profitRate = finance.revenue > 0
    ? Math.round(((finance.revenue - finance.cost) / finance.revenue) * 100)
    : null
  const receivedRate = finance.revenue > 0
    ? Math.round((finance.received / finance.revenue) * 100)
    : 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* ── 헤더 ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2 text-xs">
          <Link href="/projects" className="text-gray-400 hover:text-gray-700">← 프로젝트 목록</Link>
          <span className="text-gray-300">·</span>
          <Link href={`/projects/${project.id}`} className="text-gray-400 hover:text-gray-700">기존 페이지</Link>
          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>V2 미리보기</span>
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
          {pmName && (
            <span className="text-xs text-gray-400">PM {pmName}</span>
          )}
        </div>
      </div>

      {/* ── 2-column 본문 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* 좌: 메인 */}
        <div className="space-y-4">
          <PlaceholderCard title="◆ 프로젝트 개요 (V1.6 예정)" subtitle="클라이언트 / 과업 / 진행 상황 위키" />
          <PlaceholderCard title="◆ 소통 Timeline (V1.7 예정)" subtitle={`총 ${logs.length}건의 소통 기록`} />
          <PlaceholderCard title="◆ 연관 서비스 (V1.8 예정)" subtitle={`렌탈 ${rentals.length}건 등 — 직접 추가/이동`} />
          <PlaceholderCard title="◆ 계약 / 업무 / 메모 (V1.9 예정)" subtitle={`계약 ${contracts.length}건 · 업무 ${tasks.length}건`} />
        </div>

        {/* 우: 사이드 */}
        <aside className="space-y-3 lg:sticky lg:top-4 self-start">
          {/* 🤖 빵빵이 — V1.3 */}
          <BbangiCard project={project} contracts={contracts} tasks={tasks} logs={logs} currentUserId={currentUserId} leadIds={leadIds} />

          {/* 📋 기본정보 — V1.4 */}
          <BasicInfoCard customer={customer} contactPerson={contactPerson} pmName={pmName} project={project} />

          {/* 💰 재무 요약 — V1.5 */}
          <FinanceCard finance={finance} profitRate={profitRate} receivedRate={receivedRate} />

          {/* 📁 드롭박스 */}
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

/* ── 우측 사이드 위젯들 ─────────────────────────────────── */

function BbangiCard({ project }: {
  project: Project; contracts: Contract[]; tasks: Task[]; logs: Log[]; currentUserId: string; leadIds: string[]
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">🤖 빵빵이</p>
        <span className="text-[10px] text-gray-400">프로젝트 협업</span>
      </div>
      <ProjectClaudeChat
        projectId={project.id}
        projectName={project.name}
        serviceType={project.service_type}
        dropboxUrl={project.dropbox_url}
        defaultOpen={true}
      />
    </div>
  )
}

function BasicInfoCard({ customer, contactPerson, pmName, project }: {
  customer: Customer | null; contactPerson: ContactPerson | null; pmName: string | null; project: Project
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-2.5">
      <p className="text-xs font-semibold text-gray-700">📋 기본정보</p>

      {customer ? (
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">고객사</p>
          <p className="text-sm font-medium text-gray-800">{customer.name}</p>
          {customer.type && <p className="text-[11px] text-gray-400">{customer.type}</p>}
        </div>
      ) : (
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">고객사</p>
          <p className="text-sm text-gray-400">미연결</p>
        </div>
      )}

      {(contactPerson || customer?.contact_name) && (
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">담당자</p>
          <p className="text-sm font-medium text-gray-800">
            {contactPerson?.name ?? customer?.contact_name}
            {contactPerson?.title && <span className="text-gray-400 font-normal ml-1">· {contactPerson.title}</span>}
          </p>
          {contactPerson?.dept && (
            <p className="text-[11px] text-gray-500">{contactPerson.dept}</p>
          )}
          {(contactPerson?.phone || customer?.phone) && (
            <p className="text-[11px] text-gray-400">{contactPerson?.phone ?? customer?.phone}</p>
          )}
          {(contactPerson?.email || customer?.contact_email) && (
            <p className="text-[11px] text-gray-400 truncate">{contactPerson?.email ?? customer?.contact_email}</p>
          )}
        </div>
      )}

      {pmName && (
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">PM</p>
          <p className="text-sm font-medium text-gray-800">{pmName}</p>
        </div>
      )}

      {project.service_type && (
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">서비스</p>
          <p className="text-sm text-gray-800">{project.service_type}</p>
        </div>
      )}
    </div>
  )
}

function FinanceCard({ finance, profitRate, receivedRate }: {
  finance: Finance; profitRate: number | null; receivedRate: number
}) {
  const profit = finance.revenue - finance.cost
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">💰 재무 요약</p>
        <span className="text-[10px] text-gray-400">계약 {finance.contractCount}건</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">매출</span>
          <span className="text-sm font-semibold text-gray-900">{fmtMoney(finance.revenue)}원</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">원가</span>
          <span className="text-sm text-gray-600">{fmtMoney(finance.cost)}원</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <span className="text-[11px] text-gray-500">이익</span>
          <span className={`text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {fmtMoney(profit)}원
            {profitRate !== null && (
              <span className="ml-1 text-[10px] text-gray-400">({profitRate}%)</span>
            )}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-gray-500">수금</span>
          <span className="text-[11px] text-gray-600">{fmtMoney(finance.received)}원 / {receivedRate}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(receivedRate, 100)}%`, backgroundColor: receivedRate >= 100 ? '#22c55e' : '#FFCE00' }} />
        </div>
      </div>
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
