'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateMyProfile } from './actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  emergency_name: string | null
  emergency_phone: string | null
  bank_name: string | null
  account_number: string | null
  birth_date: string | null
  join_date: string | null
}

type Tab = 'info' | 'account' | 'password'

const ROLE_LABEL: Record<string, string> = {
  admin: '관리자',
  manager: '팀장',
  member: '팀원',
}

export default function ProfileClient({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<Tab>('info')

  // 내 정보 탭
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [emergencyName, setEmergencyName] = useState(profile.emergency_name ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(profile.emergency_phone ?? '')
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? '')
  const [infoMsg, setInfoMsg] = useState<{ ok: boolean; msg: string } | null>(null)
  const [isInfoPending, startInfoTransition] = useTransition()

  // 계좌 탭
  const [bankName, setBankName] = useState(profile.bank_name ?? '')
  const [accountNumber, setAccountNumber] = useState(profile.account_number ?? '')
  const [showAccount, setShowAccount] = useState(false)
  const [accountMsg, setAccountMsg] = useState<{ ok: boolean; msg: string } | null>(null)
  const [isAccountPending, startAccountTransition] = useTransition()

  // 비밀번호 탭
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  function handleInfoSave() {
    setInfoMsg(null)
    startInfoTransition(async () => {
      await updateMyProfile({ phone, emergency_name: emergencyName, emergency_phone: emergencyPhone, birth_date: birthDate })
      setInfoMsg({ ok: true, msg: '저장되었습니다.' })
    })
  }

  function handleAccountSave() {
    setAccountMsg(null)
    startAccountTransition(async () => {
      await updateMyProfile({ bank_name: bankName, account_number: accountNumber })
      setAccountMsg({ ok: true, msg: '저장되었습니다.' })
    })
  }

  async function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (newPw.length < 8) { setPwMsg({ ok: false, msg: '새 비밀번호는 8자 이상이어야 합니다.' }); return }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, msg: '새 비밀번호가 일치하지 않습니다.' }); return }

    setPwSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setPwMsg({ ok: false, msg: '사용자 정보를 불러올 수 없습니다.' }); setPwSaving(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw })
    if (signInError) { setPwMsg({ ok: false, msg: '현재 비밀번호가 올바르지 않습니다.' }); setPwSaving(false); return }

    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwMsg({ ok: false, msg: '변경 실패: ' + error.message })
    } else {
      setPwMsg({ ok: true, msg: '비밀번호가 변경되었습니다.' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setPwSaving(false)
  }

  const maskAccount = (v: string) => {
    if (!v || v.length <= 4) return v
    return v.slice(0, 2) + '*'.repeat(v.length - 4) + v.slice(-2)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'info', label: '내 정보' },
    { id: 'account', label: '계좌 정보' },
    { id: 'password', label: '비밀번호' },
  ]

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">프로필</h1>
        <p className="text-gray-500 text-sm mt-1">내 정보를 확인하고 수정하세요.</p>
      </div>

      {/* 프로필 헤더 카드 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center text-xl font-bold text-yellow-700 flex-shrink-0">
          {profile.name?.charAt(0) ?? '?'}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-base">{profile.name}</p>
          <p className="text-sm text-gray-400">{profile.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
              {ROLE_LABEL[profile.role] ?? profile.role}
            </span>
            {profile.join_date && (
              <span className="text-xs text-gray-400">입사 {profile.join_date}</span>
            )}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 내 정보 탭 */}
      {tab === 'info' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <Field label="연락처" value={phone} onChange={setPhone} placeholder="010-0000-0000" />
          <Field label="비상연락 이름" value={emergencyName} onChange={setEmergencyName} placeholder="홍길동" />
          <Field label="비상연락 번호" value={emergencyPhone} onChange={setEmergencyPhone} placeholder="010-0000-0000" />
          <Field label="생년월일" value={birthDate} onChange={setBirthDate} placeholder="1990-01-01" type="date" />

          {infoMsg && (
            <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
              infoMsg.ok ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
            }`}>{infoMsg.msg}</div>
          )}
          <SaveButton loading={isInfoPending} onClick={handleInfoSave} />
        </div>
      )}

      {/* 계좌 정보 탭 */}
      {tab === 'account' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
            급여 지급 시 사용되는 계좌 정보입니다. 정확하게 입력해주세요.
          </p>
          <Field label="은행명" value={bankName} onChange={setBankName} placeholder="국민은행" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">계좌번호</label>
            <div className="relative">
              <input
                type={showAccount ? 'text' : 'password'}
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                placeholder="계좌번호 입력"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-yellow-400 pr-16"
              />
              <button type="button" onClick={() => setShowAccount(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {showAccount ? '숨기기' : '보기'}
              </button>
            </div>
          </div>

          {accountMsg && (
            <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
              accountMsg.ok ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
            }`}>{accountMsg.msg}</div>
          )}
          <SaveButton loading={isAccountPending} onClick={handleAccountSave} />
        </div>
      )}

      {/* 비밀번호 탭 */}
      {tab === 'password' && (
        <form onSubmit={handlePwSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <Field label="현재 비밀번호" value={currentPw} onChange={setCurrentPw} type="password" placeholder="현재 비밀번호 입력" required />
          <Field label="새 비밀번호" value={newPw} onChange={setNewPw} type="password" placeholder="8자 이상" required />
          <Field label="새 비밀번호 확인" value={confirmPw} onChange={setConfirmPw} type="password" placeholder="새 비밀번호 재입력" required />

          {pwMsg && (
            <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
              pwMsg.ok ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
            }`}>{pwMsg.msg}</div>
          )}
          <button type="submit" disabled={pwSaving}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            {pwSaving ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-yellow-400"
      />
    </div>
  )
}

function SaveButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
      style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
      {loading ? '저장 중...' : '저장'}
    </button>
  )
}
