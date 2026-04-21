'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const MEMO_KEY = 'ym-dashboard-memo'

export default function DashboardMemo() {
  const [memo, setMemo] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setMemo(localStorage.getItem(MEMO_KEY) ?? '')
  }, [])

  function save(val: string) {
    localStorage.setItem(MEMO_KEY, val)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">📝 빠른 메모</h3>
        {saved && <span className="text-xs text-green-500 font-medium">저장됨</span>}
      </div>
      <textarea
        value={memo}
        onChange={e => setMemo(e.target.value)}
        onBlur={e => save(e.target.value)}
        placeholder="오늘의 메모, 할 일, 아이디어..."
        rows={5}
        className="w-full text-sm border border-gray-100 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-300 text-gray-700 placeholder-gray-300"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-300">브라우저에 자동 저장됨</span>
        <Link href="/calendar" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
          캘린더 보기 →
        </Link>
      </div>
    </div>
  )
}
