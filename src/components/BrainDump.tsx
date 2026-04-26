'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import MarkdownText from './MarkdownText'

type Msg = { role: 'user' | 'assistant'; content: string }

const STORAGE_KEY = 'bbang-braindump-messages'

// 대시보드 빠른 빵빵이 — 사용자가 자유롭게 쏟아내는 메모/고민/할일을
// 빵빵이가 분석하고 매칭되는 리드/프로젝트로 안내하거나 직접 도구 실행.
export default function BrainDump() {
  const router = useRouter()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // localStorage 복원 (mount 시 한 번)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setMessages(JSON.parse(saved))
    } catch {}
  }, [])

  // 변경 시 저장
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))) } catch {}
  }, [messages])

  // 새 메시지 추가 시 챗 박스 내부만 스크롤
  useEffect(() => {
    if (bottomRef.current) {
      const container = bottomRef.current.parentElement
      if (container) container.scrollTop = container.scrollHeight
    }
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const newMsgs: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(newMsgs)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs,
          mode: 'brain-dump',
        }),
      })
      const data = await res.json()
      const content = data.text || data.error || '답변 없음'
      setMessages(prev => [...prev, { role: 'assistant', content }])
      if (data.mutated) router.refresh()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '네트워크 오류' }])
    }
    setLoading(false)
  }

  function clearChat() {
    if (!confirm('대화 내역을 지울까?')) return
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <div className="bg-white rounded-xl flex flex-col" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minHeight: 400 }}>
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">🤖 빵빵이에게 쏟아내기</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">고민·할일·미팅 정리·소통 메모 등 자유롭게. 빵빵이가 매칭해서 처리.</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-[11px] text-gray-400 hover:text-red-500">대화 지우기</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 500 }}>
        {messages.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400">
            <p>예시:</p>
            <p className="mt-1">&ldquo;평택교육지원청 강사 김덕진 5/15까지 답변 준대&rdquo;</p>
            <p>&ldquo;봉일천 견적 내일까지 보내야함&rdquo;</p>
            <p>&ldquo;오늘 미팅 정리해줘: ...&rdquo;</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                m.role === 'user' ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
              }`}>
                {m.role === 'user' ? (
                  <p className="text-sm text-gray-800 whitespace-pre-line">{m.content}</p>
                ) : (
                  <MarkdownText className="text-sm">{m.content}</MarkdownText>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-400">
              빵빵이가 생각 중...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 p-3">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
          placeholder="여기에 자유롭게 쓰세요. ⌘+Enter로 전송."
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[11px] text-gray-400">⌘+Enter 또는 보내기 클릭</span>
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}
          >
            보내기
          </button>
        </div>
      </div>
    </div>
  )
}
