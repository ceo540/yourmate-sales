'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { upsertDailyReport } from './actions'

interface DailyReport {
  id: string; report_date: string
  tasks_done: string | null; issues: string | null; tomorrow_plan: string | null
  status: string; linked_task_ids?: string[] | null
}

interface TeamReport extends DailyReport {
  user: { name: string } | null
}

interface Profile { id: string; name: string }
interface Task { id: string; title: string; status: string; project_id: string | null }

interface Props {
  myReports: DailyReport[]
  todayTeamReports: TeamReport[]
  profiles: Profile[]
  currentUserId: string
  isAdmin: boolean
  today: string
  myTasks: Task[]
}

export default function DailyReportClient({ myReports, todayTeamReports, profiles, currentUserId, isAdmin, today, myTasks }: Props) {
  const [selectedDate, setSelectedDate] = useState(today)
  const [isPending, startTransition] = useTransition()

  const existing = myReports.find(r => r.report_date === selectedDate)
  const [tasksDone, setTasksDone] = useState(existing?.tasks_done ?? '')
  const [issues, setIssues] = useState(existing?.issues ?? '')
  const [tomorrowPlan, setTomorrowPlan] = useState(existing?.tomorrow_plan ?? '')
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>(existing?.linked_task_ids ?? [])
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [taskSearch, setTaskSearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  // 날짜 바뀌면 폼 동기화
  useEffect(() => {
    const r = myReports.find(r => r.report_date === selectedDate)
    setTasksDone(r?.tasks_done ?? '')
    setIssues(r?.issues ?? '')
    setTomorrowPlan(r?.tomorrow_plan ?? '')
    setLinkedTaskIds(r?.linked_task_ids ?? [])
  }, [selectedDate, myReports])

  // 외부 클릭 시 피커 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowTaskPicker(false)
        setTaskSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSave(status: '작성중' | '제출완료') {
    startTransition(async () => {
      await upsertDailyReport(selectedDate, { tasks_done: tasksDone, issues, tomorrow_plan: tomorrowPlan, status, linked_task_ids: linkedTaskIds })
    })
  }

  function toggleTask(taskId: string) {
    setLinkedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    )
  }

  const isSubmitted = existing?.status === '제출완료'
  const linkedTasks = myTasks.filter(t => linkedTaskIds.includes(t.id))
  const filteredTasks = myTasks.filter(t =>
    t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !linkedTaskIds.includes(t.id)
  )

  // 최근 7일 날짜 선택 탭
  const recentDates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - i)
    recentDates.push(d.toISOString().slice(0, 10))
  }

  function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const diff = Math.round((new Date(today + 'T00:00:00').getTime() - d.getTime()) / 86400000)
    if (diff === 0) return '오늘'
    if (diff === 1) return '어제'
    return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* 날짜 탭 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {recentDates.map(date => {
          const r = myReports.find(r => r.report_date === date)
          const submitted = r?.status === '제출완료'
          const draft = r && !submitted
          return (
            <button key={date} onClick={() => setSelectedDate(date)}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                selectedDate === date
                  ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}>
              <span>{formatDateLabel(date)}</span>
              {submitted && <span className="ml-1 text-green-500">✓</span>}
              {draft && <span className="ml-1 text-yellow-500">•</span>}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 내 업무표 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {formatDateLabel(selectedDate) === '오늘' ? '오늘 업무표' : `${selectedDate} 업무표`}
              </h2>
              {existing && (
                <span className={`text-xs mt-0.5 inline-block px-1.5 py-0.5 rounded-full font-medium ${
                  isSubmitted ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                }`}>
                  {isSubmitted ? '제출완료' : '임시저장'}
                </span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">오늘 한 일</label>
              <textarea
                value={tasksDone}
                onChange={e => setTasksDone(e.target.value)}
                placeholder={'• SOS 행사 견적서 발송\n• 렌탈 픽업 확인\n• 팀 미팅 참석'}
                rows={4}
                disabled={isSubmitted}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-300 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">이슈 / 메모</label>
              <textarea
                value={issues}
                onChange={e => setIssues(e.target.value)}
                placeholder={'• 고객 A 미수금 연락 필요\n• 서버 오류 확인 중'}
                rows={3}
                disabled={isSubmitted}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-300 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">내일 할 일</label>
              <textarea
                value={tomorrowPlan}
                onChange={e => setTomorrowPlan(e.target.value)}
                placeholder={'• 계약서 초안 검토\n• 납품 스케줄 확인'}
                rows={3}
                disabled={isSubmitted}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-300 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {/* 관련 업무 링크 */}
            {myTasks.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">관련 업무 태그</label>

                {/* 선택된 태그 칩 */}
                {linkedTasks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {linkedTasks.map(t => (
                      <span key={t.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-gray-800">
                        <span className="max-w-[120px] truncate">{t.title}</span>
                        {!isSubmitted && (
                          <button type="button" onClick={() => toggleTask(t.id)}
                            className="text-gray-400 hover:text-gray-600 flex-shrink-0">×</button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {/* 업무 추가 피커 */}
                {!isSubmitted && (
                  <div className="relative" ref={pickerRef}>
                    <button type="button"
                      onClick={() => setShowTaskPicker(v => !v)}
                      className="text-xs px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-yellow-400 hover:text-yellow-600 transition-colors">
                      + 업무 연결
                    </button>

                    {showTaskPicker && (
                      <div className="absolute left-0 top-full mt-1 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                          <input
                            type="text"
                            value={taskSearch}
                            onChange={e => setTaskSearch(e.target.value)}
                            placeholder="업무 검색..."
                            autoFocus
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                          {filteredTasks.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-gray-400 text-center">
                              {taskSearch ? '검색 결과 없음' : '연결할 업무가 없습니다'}
                            </p>
                          ) : filteredTasks.map(t => (
                            <button key={t.id} type="button"
                              onClick={() => { toggleTask(t.id); setTaskSearch('') }}
                              className="w-full px-3 py-2.5 text-left hover:bg-yellow-50 transition-colors">
                              <p className="text-xs text-gray-800 line-clamp-2">{t.title}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isSubmitted ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave('작성중')}
                  disabled={isPending}
                  className="flex-1 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  {isPending ? '저장 중...' : '임시저장'}
                </button>
                <button
                  onClick={() => handleSave('제출완료')}
                  disabled={isPending || (!tasksDone.trim() && !issues.trim() && !tomorrowPlan.trim())}
                  className="flex-1 py-2 text-sm font-semibold rounded-xl disabled:opacity-40"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                  {isPending ? '저장 중...' : '제출'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleSave('작성중')}
                disabled={isPending}
                className="w-full py-2 text-sm border border-gray-200 rounded-xl text-gray-400 hover:bg-gray-50 disabled:opacity-50">
                제출 취소 (수정)
              </button>
            )}
          </div>
        </div>

        {/* 우측: 팀 현황 (오늘) + 최근 이력 */}
        <div className="space-y-4">
          {/* 오늘 팀 제출 현황 (관리자만) */}
          {isAdmin && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">오늘 팀 제출 현황</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {profiles.map(p => {
                  const rep = todayTeamReports.find(r => (r.user as any)?.name === p.name || r.user?.name === p.name)
                  const submitted = rep?.status === '제출완료'
                  const draft = rep && !submitted
                  return (
                    <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-sm text-gray-700">{p.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        submitted ? 'bg-green-50 text-green-600' :
                        draft ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {submitted ? '제출완료' : draft ? '임시저장' : '미작성'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 내 최근 업무표 이력 */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">최근 작성 이력</h3>
            </div>
            {myReports.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">작성된 업무표가 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {myReports.slice(0, 5).map(r => (
                  <button key={r.id} onClick={() => setSelectedDate(r.report_date)}
                    className={`w-full flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 transition-colors text-left ${
                      selectedDate === r.report_date ? 'bg-yellow-50' : ''
                    }`}>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700">{r.report_date}</span>
                      {r.linked_task_ids && r.linked_task_ids.length > 0 && (
                        <span className="ml-2 text-xs text-gray-400">업무 {r.linked_task_ids.length}개</span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      r.status === '제출완료' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                    }`}>{r.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
