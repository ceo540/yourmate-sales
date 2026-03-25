'use client'

import { useState } from 'react'
import { DEPARTMENT_LABELS, type Department } from '@/types'

interface UserProfile {
  id: string
  name: string
  department: string | null
  role: string
  created_at: string
}

interface Props {
  users: UserProfile[]
}

const EMPTY_FORM = { name: '', email: '', department: '' as Department | '', role: 'member' }

export default function AdminClient({ users: initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)

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
    } catch (err) {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
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
    if (!res.ok) {
      alert(data.error ?? '변경 실패')
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    }
  }

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`${userName} 님을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return

    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    const data = await res.json()
    if (!res.ok) {
      alert(data.error ?? '삭제 실패')
    } else {
      setUsers(prev => prev.filter(u => u.id !== userId))
    }
  }

  return (
    <div className="space-y-6">
      {/* 팀원 목록 */}
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
            <div key={user.id} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{user.name || '이름 없음'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {user.department ? DEPARTMENT_LABELS[user.department as Department] ?? user.department : '사업부 미지정'}
                  {' · '}
                  {new Date(user.created_at).toLocaleDateString('ko-KR')} 가입
                </p>
              </div>
              <div className="flex items-center gap-3">
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
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 성공 메시지 */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* 초대 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">새 팀원 초대</h2>
          <p className="text-xs text-gray-400 mb-4">
            입력한 이메일로 초대 링크를 발송합니다. 상대방이 링크를 클릭하면 비밀번호를 설정하고 가입됩니다.
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
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">사업부</label>
                <select
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value as Department | '' }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
                >
                  <option value="">선택 안함</option>
                  {Object.entries(DEPARTMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
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
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

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
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
