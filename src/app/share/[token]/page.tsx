import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

const STAGE_LABEL: Record<string, string> = {
  '계약': '계약', '착수': '착수', '선금': '선금 수령',
  '중도금': '중도금 수령', '완수': '완수', '계산서발행': '계산서 발행', '잔금': '잔금 수령',
}

const STAGE_STEP = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: sale } = await admin
    .from('sales')
    .select('id, name, client_org, service_type, department, contract_stage, progress_status, notes, project_overview, inflow_date')
    .eq('share_token', token)
    .single()

  if (!sale) notFound()

  const [{ data: tasksRaw }, { data: logsRaw }] = await Promise.all([
    admin.from('tasks').select('id, title, status, priority, due_date').eq('project_id', sale.id).order('created_at'),
    admin.from('project_logs')
      .select('id, content, log_type, contacted_at, log_category')
      .eq('sale_id', sale.id)
      .eq('log_category', '외부')
      .order('contacted_at', { ascending: false })
      .limit(20),
  ])

  const tasks = tasksRaw ?? []
  const logs = logsRaw ?? []
  const stageIdx = STAGE_STEP.indexOf(sale.contract_stage ?? '계약')

  const pendingTasks = tasks.filter((t: any) => t.status !== '완료')
  const doneTasks = tasks.filter((t: any) => t.status === '완료')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-yellow-400 rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold text-gray-900">Y</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">유어메이트</span>
        </div>
        <span className="text-xs text-gray-400">프로젝트 현황 공유</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* 기본 정보 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">{sale.name}</h1>
          {sale.client_org && <p className="text-sm text-gray-500 mb-4">{sale.client_org}</p>}
          <div className="flex flex-wrap gap-2">
            {sale.service_type && (
              <span className="text-xs px-2.5 py-1 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-100">
                {sale.service_type}
              </span>
            )}
            {sale.progress_status && (
              <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                {sale.progress_status}
              </span>
            )}
          </div>
        </div>

        {/* 계약 단계 */}
        {sale.contract_stage && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">계약 진행 단계</h2>
            <div className="flex items-center gap-1">
              {STAGE_STEP.map((s, i) => (
                <div key={s} className="flex items-center flex-1 min-w-0">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${i < stageIdx ? 'bg-green-100 text-green-700' : i === stageIdx ? 'bg-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-400'}`}>
                    {i < stageIdx ? '✓' : i + 1}
                  </div>
                  {i < STAGE_STEP.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-0.5 ${i < stageIdx ? 'bg-green-200' : 'bg-gray-100'}`} />
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">현재: {STAGE_LABEL[sale.contract_stage] ?? sale.contract_stage}</p>
          </div>
        )}

        {/* 과업 목록 */}
        {tasks.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">과업 목록</h2>
            <div className="space-y-2">
              {pendingTasks.map((t: any) => (
                <div key={t.id} className="flex items-start gap-2.5 py-1.5">
                  <div className="w-4 h-4 rounded border border-gray-200 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{t.title}</p>
                    {t.due_date && (
                      <p className="text-xs text-gray-400 mt-0.5">기한 {t.due_date.slice(0, 10)}</p>
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0
                    ${t.status === '진행중' ? 'bg-blue-50 text-blue-600' : t.status === '검토중' ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-500'}`}>
                    {t.status}
                  </span>
                </div>
              ))}
              {doneTasks.length > 0 && (
                <div className="pt-2 border-t border-gray-50">
                  <p className="text-xs text-gray-400 mb-1.5">완료 ({doneTasks.length})</p>
                  {doneTasks.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2.5 py-1">
                      <div className="w-4 h-4 rounded bg-green-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-400 line-through">{t.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 프로젝트 개요 */}
        {sale.project_overview && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">프로젝트 개요</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{sale.project_overview}</p>
          </div>
        )}

        {/* 소통 내역 (외부만) */}
        {logs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">소통 내역</h2>
            <div className="space-y-3">
              {logs.map((l: any) => (
                <div key={l.id} className="flex gap-3">
                  <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 w-16 text-right">
                    {(l.contacted_at ?? '').slice(0, 10)}
                  </span>
                  <p className="text-sm text-gray-700 flex-1">{l.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 pb-4">
          유어메이트 (yourmate.io) · 이 페이지는 열람 전용입니다.
        </p>
      </main>
    </div>
  )
}
