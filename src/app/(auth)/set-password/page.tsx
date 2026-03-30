'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
        return
      }

      // hash 방식 토큰 처리 (#access_token=...&refresh_token=...)
      const hash = window.location.hash.slice(1)
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => {
            if (error) setSessionError(true)
            else setSessionReady(true)
          })
      } else {
        setSessionError(true)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/sales')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ backgroundColor: '#FFCE00' }}>
            <span className="text-2xl font-black" style={{ color: '#121212' }}>Y</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">유어메이트 시스템</h1>
          <p className="text-gray-500 mt-1 text-sm">비밀번호를 설정해주세요</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* 세션 로딩 중 */}
          {!sessionReady && !sessionError && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">인증 정보 확인 중...</p>
            </div>
          )}

          {/* 세션 오류 */}
          {sessionError && (
            <div className="text-center py-8">
              <p className="text-sm font-semibold text-gray-800 mb-2">링크가 만료되었거나 유효하지 않아요.</p>
              <p className="text-xs text-gray-400 mb-6">관리자에게 초대 메일 재발송을 요청해주세요.</p>
              <button
                onClick={() => router.push('/login')}
                className="text-sm font-semibold px-5 py-2.5 rounded-lg"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}
              >
                로그인 페이지로
              </button>
            </div>
          )}

          {/* 비밀번호 설정 폼 */}
          {sessionReady && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">비밀번호 설정</h2>
              <p className="text-sm text-gray-400 mb-6">앞으로 로그인에 사용할 비밀번호를 입력해주세요.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    placeholder="6자 이상"
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    placeholder="비밀번호 재입력"
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}
                >
                  {loading ? '설정 중...' : '비밀번호 설정 완료'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
