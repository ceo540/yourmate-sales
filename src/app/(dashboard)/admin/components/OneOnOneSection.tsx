'use client'

import { useState } from 'react'
import { createOneOnOne, deleteOneOnOne } from '../actions'

interface OneOnOne {
  id: string; member_id: string; date: string
  content: string | null; action_items: string | null; created_at: string
}

interface Props {
  userId: string
  records: OneOnOne[]
  setRecords: React.Dispatch<React.SetStateAction<OneOnOne[]>>
}

export default function OneOnOneSection({ userId, records, setRecords }: Props) {
  const [showOoForm, setShowOoForm] = useState(false)
  const [ooForm, setOoForm] = useState({ date: '', content: '', action_items: '' })

  const userOOs = records.filter(o => o.member_id === userId).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-3">
      <button onClick={() => setShowOoForm(v => !v)}
        className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
        + 새 미팅 기록 추가
      </button>

      {showOoForm && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">날짜</label>
            <input type="date" value={ooForm.date} onChange={e => setOoForm(f => ({...f, date: e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">주요 내용</label>
            <textarea value={ooForm.content} onChange={e => setOoForm(f => ({...f, content: e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-none" rows={3}
              placeholder="미팅에서 나눈 내용..." />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">액션 아이템</label>
            <textarea value={ooForm.action_items} onChange={e => setOoForm(f => ({...f, action_items: e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-none" rows={2}
              placeholder="- 할 일 1&#10;- 할 일 2" />
          </div>
          <div className="flex gap-2">
            <button onClick={async () => {
              if (!ooForm.date) return
              await createOneOnOne(userId, ooForm.date, ooForm.content, ooForm.action_items)
              setRecords(prev => [{ id: Date.now().toString(), member_id: userId, date: ooForm.date, content: ooForm.content, action_items: ooForm.action_items, created_at: new Date().toISOString() }, ...prev])
              setOoForm({ date: '', content: '', action_items: '' })
              setShowOoForm(false)
            }} className="flex-1 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">저장</button>
            <button onClick={() => setShowOoForm(false)} className="flex-1 py-2 border border-gray-200 text-sm rounded-lg text-gray-500">취소</button>
          </div>
        </div>
      )}

      {userOOs.length === 0 && !showOoForm && (
        <p className="text-center text-sm text-gray-400 py-6">원온원 기록이 없어요.</p>
      )}

      {userOOs.map(o => (
        <div key={o.id} className="border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800">{o.date}</span>
            <button onClick={async () => { await deleteOneOnOne(o.id); setRecords(prev => prev.filter(x => x.id !== o.id)) }}
              className="text-xs text-gray-300 hover:text-red-400">삭제</button>
          </div>
          {o.content && <p className="text-sm text-gray-600 whitespace-pre-line mb-2">{o.content}</p>}
          {o.action_items && (
            <div className="bg-blue-50 rounded-lg p-2.5">
              <p className="text-xs font-semibold text-blue-600 mb-1">액션 아이템</p>
              <p className="text-xs text-blue-700 whitespace-pre-line">{o.action_items}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
