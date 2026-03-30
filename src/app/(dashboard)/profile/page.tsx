'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== confirm) {
      setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' })
      return
    }
    if (next.length < 8) {
      setMessage({ type: 'error', text: '비밀번호는 8자 이상이어야 합니다.' })
      return
    }

    setSaving(true)
    setMessage(null)

    const supabase = createClient()

    // 현재 비밀번호 확인 (재로그인)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      setMessage({ type: 'error', text: '사용자 정보를 불러올 수 없습니다.' })
      setSaving(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    })

    if (signInError) {
      setMessage({ type: 'error', text: '현재 비밀번호가 올바르지 않습니다.' })
      setSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: next })
    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: '변경 실패: ' + error.message })
    } else {
      setMessage({ type: 'success', text: '비밀번호가 변경되었습니다.' })
      setCurrent('')
      setNext('')
      setConfirm('')
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 bg-white'
  const labelCls = 'block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5'

  return (
    <div className="max-w-md mx-auto pt-12 px-4">
      <h1 className="text-xl font-bold text-gray-900 mb-6">비밀번호 변경</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4 shadow-sm">
        <div>
          <label className={labelCls}>현재 비밀번호</label>
          <input
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            className={inputCls}
            placeholder="현재 비밀번호 입력"
          />
        </div>
        <div>
          <label className={labelCls}>새 비밀번호</label>
          <input
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            required
            className={inputCls}
            placeholder="8자 이상"
          />
        </div>
        <div>
          <label className={labelCls}>새 비밀번호 확인</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            className={inputCls}
            placeholder="새 비밀번호 재입력"
          />
        </div>

        {message && (
          <div className={`px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-600 border border-red-100'
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}
          >
            {saving ? '변경 중...' : '변경하기'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  )
}
