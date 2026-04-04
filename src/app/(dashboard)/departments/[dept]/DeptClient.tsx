'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createGoal, updateGoal, deleteGoal } from './actions'

interface Goal {
  id: string
  department: string
  title: string
  description: string | null
  year: number
  target_value: number | null
  current_value: number
  unit: string | null
  status: string
  deadline: string | null
}

interface Sale {
  id: string
  name: string
  service_type: string | null
  payment_status: string | null
  revenue: number | null
  inflow_date: string | null
  client_org: string | null
  assignee: { name: string } | null
}

interface Task {
  id: string
  title: string
  status: string
  priority: string | null
  assignee_id: string | null
  assignee: { name: string } | null
  project_id: string | null
  sale: { name: string } | null
  due_date: string | null
  description: string | null
}

interface DeptClientProps {
  dept: string
  deptLabel: string
  deptIcon: string
  sales: Sale[]
  goals: Goal[]
  tasks: Task[]
  isAdmin: boolean
  year: number
}

const STATUS_COLORS: Record<string, string> = {
  '진행전': 'bg-gray-100 text-gray-500',
  '진행중': 'bg-blue-100 text-blue-700',
  '달성':   'bg-green-100 text-green-700',
  '보류':   'bg-yellow-100 text-yellow-700',
}

const PAY_STATUS_COLORS: Record<string, string> = {
  '완료':   'bg-green-100 text-green-700',
  '진행중': 'bg-blue-100 text-blue-700',
  '대기':   'bg-gray-100 text-gray-500',
  '취소':   'bg-red-100 text-red-500',
}

const TASK_STATUS_COLORS: Record<string, string> = {
  '할 일':  'bg-gray-100 text-gray-500',
  '진행중': 'bg-blue-100 text-blue-700',
  '검토중': 'bg-purple-100 text-purple-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-yellow-100 text-yellow-700',
}

const PRIORITY_COLORS: Record<string, string> = {
  '높음': 'text-red-500',
  '보통': 'text-yellow-500',
  '낮음': 'text-gray-400',
}

export default function DeptClient({ dept, deptLabel, deptIcon, sales, goals, tasks, isAdmin, year }: DeptClientProps) {
  const [tab, setTab] = useState<'projects' | 'goals' | 'tasks'>('projects')
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [filterStatus, setFilterStatus] = useState('전체')

  const filteredSales = filterStatus === '전체'
    ? sales
    : sales.filter(s => s.payment_status === filterStatus)

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.revenue ?? 0), 0)

  async function handleDeleteGoal(id: string) {
    if (!confirm('목표를 삭제할까요?')) return
    await deleteGoal(id, dept)
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{deptIcon}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{deptLabel}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{year}년 · {sales.length}개 프로젝트</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {(['projects', 'tasks', 'goals'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              tab === t ? 'border-yellow-400 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {t === 'projects' ? `프로젝트 (${sales.length})` : t === 'tasks' ? `업무 (${tasks.length})` : `목표 (${goals.length})`}
          </button>
        ))}
      </div>

      {/* ─ 프로젝트 탭 ─ */}
      {tab === 'projects' && (
        <div>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {['전체', '진행중', '완료', '대기'].map(st => {
              const count = st === '전체' ? sales.length : sales.filter(s => s.payment_status === st).length
              return (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`rounded-xl p-3 text-left border transition-all ${
                    filterStatus === st ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="text-xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-400">{st}</p>
                </button>
              )
            })}
          </div>

          {/* 프로젝트 목록 */}
          {filteredSales.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">프로젝트가 없습니다</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400">
                      <th className="text-left px-4 py-3 font-medium">프로젝트명</th>
                      <th className="text-left px-4 py-3 font-medium">발주처</th>
                      <th className="text-left px-4 py-3 font-medium">서비스</th>
                      <th className="text-right px-4 py-3 font-medium">매출</th>
                      <th className="text-center px-4 py-3 font-medium">상태</th>
                      <th className="text-left px-4 py-3 font-medium">PM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/sales/${s.id}`} className="font-medium text-gray-900 hover:text-yellow-600 transition-colors">
                            {s.name}
                          </Link>
                          {s.inflow_date && (
                            <p className="text-[11px] text-gray-400">{s.inflow_date.slice(0, 10)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{s.client_org ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{s.service_type ?? '-'}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {s.revenue ? `${(s.revenue / 10000).toLocaleString()}만` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PAY_STATUS_COLORS[s.payment_status ?? ''] ?? 'bg-gray-100 text-gray-400'}`}>
                            {s.payment_status ?? '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{s.assignee?.name ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {filteredSales.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                        <td colSpan={3} className="px-4 py-2.5">합계</td>
                        <td className="px-4 py-2.5 text-right text-gray-900 font-semibold">
                          {(totalRevenue / 10000).toLocaleString()}만원
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─ 업무 탭 ─ */}
      {tab === 'tasks' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">이 사업부 프로젝트에 연결된 업무 {tasks.length}개</p>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">등록된 업무가 없습니다</div>
          ) : (
            <div className="space-y-1">
              {(['할 일', '진행중', '검토중', '완료', '보류'] as const).map(status => {
                const grouped = tasks.filter(t => t.status === status)
                if (grouped.length === 0) return null
                return (
                  <div key={status} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLORS[status]}`}>
                        {status}
                      </span>
                      <span className="text-xs text-gray-400">{grouped.length}개</span>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      {grouped.map((task, idx) => (
                        <div key={task.id} className={`flex items-start gap-3 px-4 py-3 ${idx !== grouped.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{task.title}</p>
                            {task.sale && (
                              <p className="text-[11px] text-gray-400 mt-0.5">📁 {task.sale.name}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
                            {task.priority && (
                              <span className={`font-medium ${PRIORITY_COLORS[task.priority] ?? ''}`}>{task.priority}</span>
                            )}
                            {task.assignee && <span>{task.assignee.name}</span>}
                            {task.due_date && <span>{task.due_date.slice(0, 10)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─ 목표 탭 ─ */}
      {tab === 'goals' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{year}년 목표 {goals.length}개</p>
            {isAdmin && (
              <button
                onClick={() => { setEditingGoal(null); setShowGoalForm(true) }}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg hover:opacity-80 transition-all"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}
              >
                + 목표 추가
              </button>
            )}
          </div>

          {/* 목표 등록/수정 폼 */}
          {showGoalForm && (
            <div className="bg-white border border-yellow-300 rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">{editingGoal ? '목표 수정' : '새 목표'}</h3>
              <form
                action={async (fd) => {
                  if (editingGoal) {
                    fd.set('id', editingGoal.id)
                    await updateGoal(fd)
                  } else {
                    await createGoal(fd)
                  }
                  setShowGoalForm(false)
                  setEditingGoal(null)
                }}
                className="space-y-3"
              >
                <input type="hidden" name="department" value={dept} />
                <input type="hidden" name="year" value={year} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">목표명 *</label>
                    <input
                      name="title"
                      required
                      defaultValue={editingGoal?.title ?? ''}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                      placeholder="예: 연간 매출 3억 달성"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">설명</label>
                    <input
                      name="description"
                      defaultValue={editingGoal?.description ?? ''}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                      placeholder="목표 설명 (선택)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">목표값</label>
                    <input
                      name="target_value"
                      type="number"
                      defaultValue={editingGoal?.target_value ?? ''}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                      placeholder="예: 300000000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">현재값</label>
                    <input
                      name="current_value"
                      type="number"
                      defaultValue={editingGoal?.current_value ?? 0}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">단위</label>
                    <input
                      name="unit"
                      defaultValue={editingGoal?.unit ?? ''}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                      placeholder="원, 건, % 등"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">상태</label>
                    <select
                      name="status"
                      defaultValue={editingGoal?.status ?? '진행중'}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                    >
                      {['진행전', '진행중', '달성', '보류'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">마감일</label>
                    <input
                      name="deadline"
                      type="date"
                      defaultValue={editingGoal?.deadline ?? ''}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-80 transition-all"
                    style={{ backgroundColor: '#FFCE00', color: '#121212' }}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowGoalForm(false); setEditingGoal(null) }}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 목표 목록 */}
          {goals.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {isAdmin ? '+ 목표 추가 버튼으로 첫 번째 목표를 등록하세요' : '등록된 목표가 없습니다'}
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map(goal => {
                const pct = goal.target_value && goal.target_value > 0
                  ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
                  : null

                return (
                  <div key={goal.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{goal.title}</p>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[goal.status] ?? 'bg-gray-100 text-gray-400'}`}>
                            {goal.status}
                          </span>
                        </div>
                        {goal.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{goal.description}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => { setEditingGoal(goal); setShowGoalForm(true) }}
                            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 진행률 바 */}
                    {pct !== null && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>
                            {goal.unit
                              ? `${goal.current_value.toLocaleString()}${goal.unit} / ${goal.target_value?.toLocaleString()}${goal.unit}`
                              : `${goal.current_value.toLocaleString()} / ${goal.target_value?.toLocaleString()}`
                            }
                          </span>
                          <span className="font-medium text-gray-700">{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 100 ? '#22c55e' : '#FFCE00'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {goal.deadline && (
                      <p className="text-[11px] text-gray-400 mt-2">마감 {goal.deadline}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
