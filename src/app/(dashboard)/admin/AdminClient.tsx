'use client'

import { useState } from 'react'
import { DEPARTMENT_LABELS, type Department } from '@/types'

interface UserProfile {
  id: string
  name: string
  email: string | null
  departments: string[] | null
  role: string
  created_at: string
  last_sign_in_at: string | null
  confirmed_at: string | null
}

interface Props {
  users: UserProfile[]
}

const DEPT_KEYS = Object.keys(DEPARTMENT_LABELS) as Department[]
const EMPTY_FORM = { name: '', email: '', departments: [] as string[], role: 'member' }

function DeptCheckboxes({ selected, onChange }: { selected: string[], onChange: (v: string[]) => void }) {
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter(d => d !== key) : [...selected, key])
  return (
    <div className="flex flex-wrap gap-2">
      {DEPT_KEYS.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            selected.includes(key)
              ? 'border-yellow-400 bg-yellow-50 text-yellow-800 font-medium'
              : 'border-gray-200 text-gray-500 hover:border-yellow-300'
          }`}
        >
          {DEPARTMENT_LABELS[key]}
        </button>
      ))}
    </div>
  )
}

export default function AdminClient({ users: initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDepts, setEditDepts] = useState<string[]>([])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({ error: `서버 오류 (${res.status})` }))
      if (!res.ok) {
        setError(data.error ?? '초대 실패')
      } else {
        setSuccess(`${form.email}로 초대 메일을 발송했습니다.`)
        setForm(EMPTY_FORM)
        setShowForm(false)
        const res2 = await fetch('/api/admin/users')
        const data2 = await res2.json()
        if (data2.users) setUsers(data2.users)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? '변경 실패'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  const handleDeptSave = async (userId: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, departments: editDepts }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? '변경 실패'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, departments: editDepts } : u))
    setEditingId(null)
  }

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`${userName} 님을 삭제하시겠습니까?`)) return
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? '삭제 실패'); return }
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">현재 팀원 ({users.length}명)</h2>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}
          >
            + 팀원 초대
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {users.map(user => (
            <div key={user.id} className="px-6 py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{user.name || '이름 없음'}</p>
                    {user.confirmed_at
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">가입완료</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">초대됨</span>
                    }
                  </div>
                  {user.email && <p className="text-xs text-gray-400">{user.email}</p>}
                  {editingId === user.id ? (
                    <div className="mt-2 space-y-2">
                      <DeptCheckboxes selected={editDepts} onChange={setEditDepts} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeptSave(user.id)}
                          className="text-xs px-3 py-1 rounded-lg font-semibold"
                          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
                        >저장</button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500"
                        >취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {(user.departments ?? []).length > 0
                        ? (user.departments ?? []).map(d => (
                          <span key={d} className="text-xs text-gray-500">
                            {DEPARTMENT_LABELS[d as Department] ?? d}
                          </span>
                        ))
                        : <span className="text-xs text-gray-300">사업부 미지정</span>
                      }
                      <button
                        onClick={() => { setEditingId(user.id); setEditDepts(user.departments ?? []) }}
                        className="text-xs text-gray-300 hover:text-yellow-600 ml-1"
                      >수정</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <button
                    onClick={() => handleRoleChange(user.id, user.role)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors hover:opacity-70 ${
                      user.role === 'admin' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {user.role === 'admin' ? '관리자' : '멤버'}
                  </button>
                  <button
                    onClick={() => handleDelete(user.id, user.name)}
                    className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                  >삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">새 팀원 초대</h2>
          <p className="text-xs text-gray-400 mb-4">
            입력한 이메일로 초대 링크를 발송합니다.
          </p>
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이름</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="홍길동"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="name@yourmate.io"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">담당 사업부 (복수 선택 가능)</label>
              <DeptCheckboxes selected={form.departments} onChange={v => setForm(f => ({ ...f, departments: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">권한</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
              >
                <option value="member">멤버</option>
                <option value="admin">관리자</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}
              >
                {loading ? '발송 중...' : '초대 메일 발송'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError('') }}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 border border-gray-200"
              >취소</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
