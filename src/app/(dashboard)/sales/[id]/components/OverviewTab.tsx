'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { listSaleDropboxFiles } from '../dropbox-action'
import { saveProjectOverview, generateProjectOverview, generateDocument } from '../notes-action'
import QuotationModal from '../QuotationModal'

const TiptapEditor = dynamic(() => import('../TiptapEditor'), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-50 rounded-lg animate-pulse" />,
})

const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금'] as const
const CONTRACT_STAGE_MAP: Record<string, number> = {
  '계약': 0, '착수': 1, '선금': 2, '중도금': 3, '완수': 4, '계산서발행': 5, '잔금': 6,
}

function formatDue(d: string | null) {
  if (!d) return null
  const date = new Date(d); const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: `D${diff}`, color: 'text-red-500 font-bold' }
  if (diff === 0) return { label: 'D-day', color: 'text-red-500 font-bold' }
  if (diff <= 3) return { label: `D-${diff}`, color: 'text-orange-500 font-semibold' }
  return { label: `D-${diff}`, color: 'text-gray-400' }
}

interface Task {
  id: string; title: string; status: string; priority: string | null
  due_date: string | null; description: string | null
  assignee: { id: string; name: string } | null
}
interface Log {
  id: string; content: string; log_type: string; created_at: string
  author: { name: string } | null
}
interface CostItem {
  id: string; item: string; amount: number
  unit_price?: number | null; quantity?: number | null
  category: string
}
interface Sale {
  id: string; name: string; memo: string | null
  contract_stage: string | null; service_type: string | null
  dropbox_url: string | null; client_org: string | null
  revenue: number | null
}

interface Props {
  sale: Sale
  tasks: Task[]
  logs: Log[]
  notes: string
  initialOverview: string
  costs: CostItem[]
  showInternalCosts: boolean
}

export default function OverviewTab({ sale, tasks, logs, notes, initialOverview, costs, showInternalCosts }: Props) {
  const [overview, setOverview] = useState(initialOverview)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [docTarget, setDocTarget] = useState<'client' | 'internal' | 'freelancer' | null>(null)
  const [docContent, setDocContent] = useState('')
  const [docGenerating, setDocGenerating] = useState(false)
  const [showQuotation, setShowQuotation] = useState(false)

  const [dropboxFiles, setDropboxFiles] = useState<{ name: string; path: string; type: 'file' | 'folder' }[] | null>(null)
  const [loadingDropbox, setLoadingDropbox] = useState(false)

  useEffect(() => {
    if (!sale.dropbox_url) return
    setLoadingDropbox(true)
    listSaleDropboxFiles(sale.dropbox_url)
      .then(files => setDropboxFiles(files))
      .catch(() => setDropboxFiles([]))
      .finally(() => setLoadingDropbox(false))
  }, [sale.dropbox_url])

  useEffect(() => {
    if (!initialOverview) {
      handleGenerateOverview()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pending = tasks.filter(t => t.status !== '완료' && t.status !== '보류')
  const completed = tasks.filter(t => t.status === '완료')
  const urgent = pending.filter(t => t.priority === '긴급' || t.priority === '높음')
  const stageIdx = CONTRACT_STAGE_MAP[sale.contract_stage ?? '계약'] ?? 0
  const taskPct = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0

  async function handleGenerateOverview() {
    setGenerating(true)
    try {
      const html = await generateProjectOverview({
        sale: { name: sale.name, client_org: sale.client_org, service_type: sale.service_type, revenue: sale.revenue, contract_stage: sale.contract_stage, memo: sale.memo },
        tasks: tasks.map(t => ({ title: t.title, status: t.status, priority: t.priority, assignee: t.assignee?.name ?? null, due_date: t.due_date, description: t.description })),
        logs: logs.map(l => ({ content: l.content, log_type: l.log_type, created_at: l.created_at, author: l.author?.name ?? null })),
        notes,
      })
      setOverview(html)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveOverview() {
    setSaving(true)
    await saveProjectOverview(sale.id, overview)
    setSaving(false)
    setSavedMsg('저장됨')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  async function handleGenerateDoc(target: 'client' | 'internal' | 'freelancer') {
    setDocTarget(target)
    setDocGenerating(true)
    setDocContent('')
    try {
      const html = await generateDocument({
        target,
        sale: { name: sale.name, client_org: sale.client_org, service_type: sale.service_type, revenue: sale.revenue },
        tasks: tasks.map(t => ({ title: t.title, status: t.status, priority: t.priority, assignee: t.assignee?.name ?? null, due_date: t.due_date, description: t.description })),
        logs: logs.map(l => ({ content: l.content, log_type: l.log_type, created_at: l.created_at })),
        notes,
        overview,
      })
      setDocContent(html)
    } finally {
      setDocGenerating(false)
    }
  }

  const TARGET_LABELS = { client: '클라이언트용', internal: '내부 실무용', freelancer: '프리랜서용' }

  return (
    <div className="space-y-4">
      {/* 핵심 지표 */}
      <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center gap-1 flex-wrap">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-gray-900">{pending.length}</span>
          <span className="text-xs text-gray-400">건 진행중</span>
        </div>
        {tasks.length > 0 && (
          <>
            <span className="mx-3 text-gray-200 select-none">·</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${taskPct}%`, backgroundColor: taskPct === 100 ? '#22c55e' : '#FFCE00' }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">{taskPct}%</span>
              <span className="text-xs text-gray-400">({completed.length}/{tasks.length})</span>
            </div>
          </>
        )}
        <span className="mx-3 text-gray-200 select-none">·</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-gray-900">{logs.length}</span>
          <span className="text-xs text-gray-400">소통</span>
        </div>
        {urgent.length > 0 && (
          <span className="ml-auto text-xs font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-full">⚠ 긴급 {urgent.length}건</span>
        )}
      </div>

      {/* 긴급 업무 */}
      {urgent.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-1.5">
          {urgent.map(t => {
            const due = formatDue(t.due_date)
            return (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-gray-700 flex-1 truncate">{t.title}</span>
                {t.assignee && <span className="text-gray-400">{t.assignee.name}</span>}
                {due && <span className={due.color}>{due.label}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* 수금 단계 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">수금 단계</p>
        <div className="flex items-center">
          {CONTRACT_STAGES.map((status, i) => {
            const done = i < stageIdx; const current = i === stageIdx
            return (
              <div key={status} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    done ? 'bg-green-500 text-white' : current ? 'text-gray-900 border-2' : 'bg-gray-100 text-gray-400'
                  }`} style={current ? { backgroundColor: '#FFCE00', borderColor: '#FFCE00' } : {}}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[9px] mt-0.5 text-center px-0.5 ${current ? 'text-gray-900 font-semibold' : done ? 'text-green-600' : 'text-gray-400'}`}>{status}</span>
                </div>
                {i < CONTRACT_STAGES.length - 1 && <div className={`h-0.5 flex-1 -mt-3.5 mx-0.5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 수익성 */}
      {showInternalCosts && costs.length > 0 && (() => {
        const calcAmt = (r: CostItem) => (r.unit_price && r.quantity) ? Number(r.unit_price) * Number(r.quantity) : (Number(r.amount) || 0)
        const totalCost = costs.reduce((s, r) => s + calcAmt(r), 0)
        const revenue = sale.revenue ?? 0
        const margin = revenue - totalCost
        const marginRate = revenue > 0 ? Math.round((margin / revenue) * 100) : null
        return (
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-gray-600 mb-3">수익성</p>
            <div className="flex gap-6 flex-wrap">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">매출</p>
                <p className="text-base font-bold text-gray-700">{revenue > 0 ? `${Math.round(revenue/10000)}만원` : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">원가합계</p>
                <p className="text-base font-bold text-gray-700">{Math.round(totalCost/10000)}만원</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">마진</p>
                <p className={`text-base font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>{Math.round(margin/10000)}만원</p>
              </div>
              {marginRate !== null && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">마진율</p>
                  <p className={`text-base font-bold ${marginRate >= 30 ? 'text-green-600' : marginRate >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>{marginRate}%</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* 프로젝트 개요 */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-600">
            프로젝트 개요
            {generating && <span className="ml-2 text-gray-400 font-normal">AI 작성 중...</span>}
          </p>
          <div className="flex items-center gap-2">
            {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
            {!generating && overview && (
              <button onClick={handleSaveOverview} disabled={saving}
                className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40 px-2 py-1 rounded hover:bg-gray-100">
                {saving ? '저장 중...' : '저장'}
              </button>
            )}
            <button onClick={handleGenerateOverview} disabled={generating}
              className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40 px-2 py-1 rounded hover:bg-gray-100"
              title="AI로 다시 생성">
              {generating ? '...' : '↺ 재생성'}
            </button>
          </div>
        </div>
        <div className="px-4 py-3">
          {generating ? (
            <div className="space-y-2 animate-pulse py-4">
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-4/5" />
              <div className="h-3 bg-gray-100 rounded w-3/5" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ) : (
            <TiptapEditor
              content={overview || '<p></p>'}
              onChange={setOverview}
              placeholder="프로젝트 개요를 직접 작성하거나 위의 &quot;AI로 생성&quot; 버튼을 눌러보세요"
            />
          )}
        </div>
      </div>

      {/* 견적서 생성 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-600">견적서 생성</p>
            <p className="text-xs text-gray-400 mt-0.5">항목 입력 → 인쇄용 HTML 생성</p>
          </div>
          <button
            onClick={() => setShowQuotation(true)}
            className="px-4 py-2 text-xs font-semibold bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg transition-colors"
          >
            견적서 만들기
          </button>
        </div>
      </div>

      {showQuotation && (
        <QuotationModal
          serviceType={sale.service_type}
          clientOrg={sale.client_org}
          onClose={() => setShowQuotation(false)}
        />
      )}

      {/* 문서 생성 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">문서 생성</p>
        <div className="flex gap-2 flex-wrap">
          {(['client', 'internal', 'freelancer'] as const).map(target => (
            <button
              key={target}
              onClick={() => handleGenerateDoc(target)}
              disabled={docGenerating}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-50 ${
                docTarget === target ? 'border-yellow-400 bg-yellow-50 text-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {TARGET_LABELS[target]}
            </button>
          ))}
        </div>

        {docGenerating && (
          <div className="mt-3 space-y-2 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-5/6" />
          </div>
        )}

        {docContent && !docGenerating && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">{TARGET_LABELS[docTarget!]} 초안</p>
              <button
                onClick={() => {
                  const w = window.open('', '_blank')
                  if (!w) return
                  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sale.name} - ${TARGET_LABELS[docTarget!]}</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#111}h1,h2,h3{margin-top:1.5em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}@media print{body{margin:0}}</style></head><body>${docContent}</body></html>`)
                  w.document.close()
                  setTimeout(() => w.print(), 300)
                }}
                className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              >
                인쇄 / PDF
              </button>
            </div>
            <div className="border border-gray-100 rounded-xl p-4 prose prose-sm max-w-none bg-gray-50 max-h-[400px] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: docContent }}
            />
          </div>
        )}
      </div>

      {/* 드롭박스 파일 목록 */}
      {sale.dropbox_url && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-600">드롭박스 파일</p>
            <a href={sale.dropbox_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700">폴더 열기 →</a>
          </div>
          {loadingDropbox ? (
            <div className="space-y-1.5 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-3 bg-gray-100 rounded w-3/4" />)}
            </div>
          ) : !dropboxFiles || dropboxFiles.length === 0 ? (
            <p className="text-xs text-gray-400">파일이 없거나 불러올 수 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {dropboxFiles.map(f => (
                <a
                  key={f.path}
                  href={sale.dropbox_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-sm">{f.type === 'folder' ? '📁' : '📄'}</span>
                  <span className="text-xs text-gray-700 group-hover:text-blue-600 truncate">{f.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
