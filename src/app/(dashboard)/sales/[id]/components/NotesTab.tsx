'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { saveNotes, chatInNotes } from '../notes-action'

const TiptapEditor = dynamic(() => import('../TiptapEditor'), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-50 rounded-lg animate-pulse" />,
})

interface Task { id: string; title: string; status: string }
interface Log { id: string; content: string; created_at: string }

interface Props {
  saleId: string
  saleName: string
  initialNotes: string
  tasks: Task[]
  logs: Log[]
}

export default function NotesTab({ saleId, saleName, initialNotes, tasks, logs }: Props) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  async function handleSave() {
    setSaving(true)
    await saveNotes(saleId, notes)
    setSaving(false)
    setSavedMsg('저장됨')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  async function handleChat() {
    if (!chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatHistory(prev => [...prev, { role: 'user', text: msg }])
    setChatLoading(true)
    try {
      const reply = await chatInNotes({
        message: msg,
        notes,
        saleName,
        tasks: tasks.map(t => ({ title: t.title, status: t.status })),
        logs: logs.map(l => ({ content: l.content, created_at: l.created_at })),
      })
      setChatHistory(prev => [...prev, { role: 'ai', text: reply }])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* 에디터 */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-600">자유 노트</p>
          <div className="flex items-center gap-2">
            {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
            <button onClick={handleSave} disabled={saving}
              className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40 px-2 py-1 rounded hover:bg-gray-100">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
        <div className="px-2 py-2">
          <TiptapEditor
            content={notes || '<p></p>'}
            onChange={setNotes}
            placeholder="자유롭게 기록하세요. 디자인 항목, 스펙, 수집한 자료, PM 고민 등..."
          />
        </div>
      </div>

      {/* AI 대화 */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">AI와 대화</span>
          <span className="text-[11px] text-gray-400">노트 내용을 기반으로 정리·분석 도움</span>
        </div>

        {chatHistory.length > 0 && (
          <div className="px-4 py-3 space-y-3 max-h-[300px] overflow-y-auto">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'text-gray-900 text-right'
                    : 'bg-gray-50 border border-gray-100 text-gray-700'
                }`} style={msg.role === 'user' ? { backgroundColor: '#FFCE00' } : {}}>
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-3 flex gap-2 border-t border-gray-100">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
            placeholder="예: 이 내용으로 프리랜서 브리핑 정리해줘 / 리스크가 뭐야?"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400"
            disabled={chatLoading}
          />
          <button onClick={handleChat} disabled={chatLoading || !chatInput.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-80 disabled:opacity-40 flex-shrink-0"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            전송
          </button>
        </div>
      </div>
    </div>
  )
}
