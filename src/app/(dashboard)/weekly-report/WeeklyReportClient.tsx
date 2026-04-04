'use client'
import { useState, useTransition } from 'react'
import { upsertWeeklyReport, addFeedback } from './actions'

interface WeekItem { start: string; end: string; label: string }
interface Report {
  id: string
  user_id: string
  week_start: string
  week_end: string
  this_week_done: string | null
  next_week_todo: string | null
  issues: string | null
  ideas: string | null
  support_needed: string | null
  feedback: string | null
  submitted_at: string | null
  profiles?: { id: string; name: string }
}

interface Props {
  currentUserId: string
  currentUserName: string
  isAdmin: boolean
  weeks: WeekItem[]
  myReports: Report[]
  allReports: Report[]
  profiles: { id: string; name: string; role: string }[]
}

export default function WeeklyReportClient({
  currentUserId, currentUserName, isAdmin, weeks, myReports, allReports, profiles
}: Props) {
  const [view, setView] = useState<'내 보고서' | '전체 보고서'>('내 보고서')
  const [selectedWeek, setSelectedWeek] = useState(weeks[0])
  const [isPending, startTransition] = useTransition()

  // 내 보고서 상태
  const myReport = myReports.find(r => r.week_start === selectedWeek.start)
  const [form, setForm] = useState({
    this_week_done: myReport?.this_week_done ?? '',
    next_week_todo: myReport?.next_week_todo ?? '',
    issues: myReport?.issues ?? '',
    ideas: myReport?.ideas ?? '',
    support_needed: myReport?.support_needed ?? '',
  })
  const [submitted, setSubmitted] = useState(!!myReport?.submitted_at)
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({})

  const handleWeekChange = (week: WeekItem) => {
    setSelectedWeek(week)
    const r = myReports.find(r => r.week_start === week.start)
    setForm({
      this_week_done: r?.this_week_done ?? '',
      next_week_todo: r?.next_week_todo ?? '',
      issues: r?.issues ?? '',
      ideas: r?.ideas ?? '',
      support_needed: r?.support_needed ?? '',
    })
    setSubmitted(!!r?.submitted_at)
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const res = await upsertWeeklyReport({
        week_start: selectedWeek.start,
        week_end: selectedWeek.end,
        ...form,
      })
      if (res.success) setSubmitted(true)
    })
  }

  const handleFeedback = (reportId: string) => {
    const text = feedbackInputs[reportId]
    if (!text?.trim()) return
    startTransition(async () => {
      await addFeedback(reportId, text)
      setFeedbackInputs(prev => ({ ...prev, [reportId]: '' }))
    })
  }

  // 이번주 제출 현황 (전체 보기용)
  const weekReports = allReports.filter(r => r.week_start === selectedWeek.start)
  const submittedIds = new Set(weekReports.filter(r => r.submitted_at).map(r => r.user_id))

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">주간 보고</h1>
          <p className="text-gray-500 text-sm mt-1">매주 한 일 · 다음 주 계획 · 이슈 공유</p>
        </div>
      </div>

      {/* 탭 + 주차 선택 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2">
          <button onClick={() => setView('내 보고서')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === '내 보고서' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            내 보고서
          </button>
          {isAdmin && (
            <button onClick={() => setView('전체 보고서')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === '전체 보고서' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              전체 보고서
            </button>
          )}
        </div>
        <select
          value={selectedWeek.start}
          onChange={e => {
            const w = weeks.find(w => w.start === e.target.value)
            if (w) handleWeekChange(w)
          }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white">
          {weeks.map(w => <option key={w.start} value={w.start}>{w.label}</option>)}
        </select>
      </div>

      {/* 내 보고서 작성 */}
      {view === '내 보고서' && (
        <div className="space-y-4">
          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-green-700 font-semibold">제출 완료</span>
                  <span className="text-xs text-green-600">{selectedWeek.label}</span>
                </div>
                <button onClick={() => setSubmitted(false)}
                  className="text-xs text-green-600 underline hover:text-green-700">
                  수정하기
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ReportSection title="이번 주 한 일" content={form.this_week_done} />
                <ReportSection title="다음 주 할 일" content={form.next_week_todo} />
                <ReportSection title="이슈 / 건의" content={form.issues} highlight />
              </div>
              {(form.ideas || form.support_needed) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-green-100">
                  {form.ideas && <ReportSection title="아이디어" content={form.ideas} />}
                  {form.support_needed && <ReportSection title="지원 및 요청" content={form.support_needed} />}
                </div>
              )}
              {myReport?.feedback && (
                <div className="mt-4 pt-4 border-t border-green-100">
                  <p className="text-xs font-semibold text-gray-500 mb-1">관리자 피드백</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{myReport.feedback}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <p className="text-sm text-gray-500 font-medium">{selectedWeek.label}</p>

              <FormField label="이번 주 한 일" hint="완료된 업무, 성과, 처리 건"
                value={form.this_week_done}
                onChange={v => setForm(f => ({ ...f, this_week_done: v }))}
                rows={4} placeholder="- 항목 1&#10;- 항목 2" />

              <FormField label="다음 주 할 일" hint="예정 업무, 목표"
                value={form.next_week_todo}
                onChange={v => setForm(f => ({ ...f, next_week_todo: v }))}
                rows={4} placeholder="- 항목 1&#10;- 항목 2" />

              <FormField label="이슈 / 건의" hint="문제, 도움 필요, 건의사항"
                value={form.issues}
                onChange={v => setForm(f => ({ ...f, issues: v }))}
                rows={3} placeholder="없음" />

              <details className="group">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                  + 아이디어 / 지원 요청 (선택)
                </summary>
                <div className="mt-3 space-y-3">
                  <FormField label="아이디어"
                    value={form.ideas}
                    onChange={v => setForm(f => ({ ...f, ideas: v }))}
                    rows={2} placeholder="주간 회의 안건 등" />
                  <FormField label="지원 및 요청"
                    value={form.support_needed}
                    onChange={v => setForm(f => ({ ...f, support_needed: v }))}
                    rows={2} placeholder="도움 필요한 것" />
                </div>
              </details>

              <button onClick={handleSubmit} disabled={isPending}
                className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {isPending ? '제출 중...' : '제출하기'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 전체 보고서 (관리자) */}
      {view === '전체 보고서' && isAdmin && (
        <div className="space-y-3">
          {/* 제출 현황 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {profiles.map(p => {
              const ok = submittedIds.has(p.id)
              return (
                <div key={p.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                  <span>{ok ? '✓' : '○'}</span> {p.name}
                </div>
              )
            })}
          </div>

          {profiles.map(p => {
            const r = weekReports.find(r => r.user_id === p.id)
            if (!r?.submitted_at) return (
              <div key={p.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2">
                  <Avatar name={p.name} muted />
                  <span className="font-semibold text-gray-500 text-sm">{p.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">미제출</span>
                </div>
              </div>
            )
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Avatar name={p.name} />
                  <span className="font-semibold text-gray-800">{p.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">제출완료</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ReportSection title="이번 주 한 일" content={r.this_week_done} />
                  <ReportSection title="다음 주 할 일" content={r.next_week_todo} />
                  <ReportSection title="이슈" content={r.issues} highlight />
                </div>
                {(r.ideas || r.support_needed) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
                    {r.ideas && <ReportSection title="아이디어" content={r.ideas} />}
                    {r.support_needed && <ReportSection title="지원 요청" content={r.support_needed} />}
                  </div>
                )}
                {/* 관리자 피드백 */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {r.feedback && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-gray-400 mb-1">내 피드백</p>
                      <p className="text-sm text-gray-600 whitespace-pre-line">{r.feedback}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={feedbackInputs[r.id] ?? ''}
                      onChange={e => setFeedbackInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleFeedback(r.id)}
                      placeholder={r.feedback ? '피드백 수정...' : '피드백 남기기 (선택)'}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
                    <button onClick={() => handleFeedback(r.id)} disabled={isPending}
                      className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-50">
                      {r.feedback ? '수정' : '저장'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FormField({ label, hint, value, onChange, rows, placeholder }: {
  label: string; hint?: string; value: string
  onChange: (v: string) => void; rows: number; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-1.5">
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-gray-400">{hint}</span>}
      </label>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-200"
        rows={rows} placeholder={placeholder} />
    </div>
  )
}

function ReportSection({ title, content, highlight }: { title: string; content?: string | null; highlight?: boolean }) {
  const empty = !content || content.trim() === '' || content === '없음'
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 mb-1.5">{title}</p>
      <p className={`text-sm whitespace-pre-line leading-relaxed ${highlight && !empty ? 'text-red-600 font-medium' : empty ? 'text-gray-300' : 'text-gray-700'}`}>
        {empty ? '없음' : content}
      </p>
    </div>
  )
}

function Avatar({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${muted ? 'bg-gray-200 text-gray-400' : 'bg-yellow-100 text-yellow-700'}`}>
      {name[0]}
    </div>
  )
}
