'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  leadId?: string
  saleId?: string
  serviceType?: string | null
  projectName?: string | null
  dropboxUrl?: string | null
  defaultOpen?: boolean
  onRevalidate?: () => void
}

export default function ProjectClaudeChat({ leadId, saleId, projectName, dropboxUrl, defaultOpen = false, onRevalidate }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingIdx, setSavingIdx] = useState<number | null>(null)
  const [savedIdx, setSavedIdx] = useState<number | null>(null)
  const [savingHtmlIdx, setSavingHtmlIdx] = useState<number | null>(null)
  const [savedHtmlIdx, setSavedHtmlIdx] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // 세션 내 리드/매출별 대화 저장소
  const historyRef = useRef<Record<string, Message[]>>({})

  const chatKey = leadId ?? saleId ?? ''

  // 리드/매출 전환 시 해당 대화 복원
  useEffect(() => {
    setMessages(historyRef.current[chatKey] ?? [])
    setInput('')
  }, [chatKey])

  // 메시지 변경 시 저장소 업데이트
  useEffect(() => {
    if (chatKey) historyRef.current[chatKey] = messages
  }, [messages, chatKey])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', content: text }
    const assistantMsg: Message = { role: 'assistant', content: '' }
    const nextMessages = [...messages, userMsg]

    setMessages([...nextMessages, assistantMsg])

    try {
      const res = await fetch('/api/claude/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, saleId, dropboxUrl, messages: nextMessages }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: '서버 오류가 발생했습니다. 다시 시도해주세요.' }
          return updated
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // 마지막 줄은 아직 완성되지 않았을 수 있으므로 버퍼에 유지
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          if (data === '[REVALIDATE]') { router.refresh(); onRevalidate?.(); continue }
          if (data.startsWith('[ERROR]')) {
            accumulated = '오류가 발생했습니다: ' + data.slice(8)
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: accumulated }
              return updated
            })
            break
          }
          try {
            // 서버에서 JSON.stringify로 인코딩된 텍스트를 파싱
            const chunk = JSON.parse(data) as string
            accumulated += chunk
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: accumulated }
              return updated
            })
          } catch {
            // 파싱 실패한 청크는 무시
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: '네트워크 오류가 발생했습니다. 다시 시도해주세요.' }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  const dropboxReady = dropboxUrl?.startsWith('https://www.dropbox.com/home')

  async function saveToDropbox(idx: number) {
    if (!dropboxReady) {
      alert('Dropbox URL이 올바르지 않습니다. 매출 정보 탭에서 드롭박스 URL을 홈 경로(/home/...) 형식으로 입력해주세요.')
      return
    }
    const msg = messages[idx]
    if (!msg || msg.role !== 'assistant') return
    setSavingIdx(idx)
    try {
      const res = await fetch('/api/claude/save-to-dropbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropboxUrl, content: msg.content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Dropbox 저장 실패: ' + (err.error ?? res.status))
        return
      }
      setSavedIdx(idx)
      setTimeout(() => setSavedIdx(null), 3000)
    } catch {
      alert('Dropbox 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingIdx(null)
    }
  }

  function extractHtml(content: string): string | null {
    const blockMatch = content.match(/```html\s*([\s\S]*?)```/)
    if (blockMatch) return blockMatch[1].trim()
    const rawMatch = content.match(/(<html[\s\S]*?<\/html>)/i)
    if (rawMatch) return rawMatch[1].trim()
    return null
  }

  async function saveHtml(idx: number) {
    if (!dropboxReady) {
      alert('Dropbox URL이 올바르지 않습니다. /home/... 형식으로 입력해주세요.')
      return
    }
    const msg = messages[idx]
    if (!msg || msg.role !== 'assistant') return
    const html = extractHtml(msg.content)
    if (!html) return
    setSavingHtmlIdx(idx)
    try {
      const res = await fetch('/api/claude/save-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropboxUrl, html }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('HTML 저장 실패: ' + (err.error ?? res.status))
        return
      }
      setSavedHtmlIdx(idx)
      setTimeout(() => setSavedHtmlIdx(null), 3000)
    } catch {
      alert('HTML 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingHtmlIdx(null)
    }
  }

  function openPdfPreview(html: string) {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const isStreaming = loading

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
      >
        <span className="flex items-center gap-2">
          Claude 협업
          {messages.length > 0 && (
            <span className="text-xs text-gray-400 font-normal">{messages.length}개 메시지</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); setMessages([]); if (chatKey) historyRef.current[chatKey] = [] }}
              className="text-xs text-gray-400 hover:text-red-400 px-1"
            >
              초기화
            </span>
          )}
          <span className="text-gray-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="flex flex-col" style={{ height: '420px' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            {messages.length === 0 && (
              <p className="text-xs text-gray-400 text-center pt-8">
                {projectName ? `"${projectName}" 프로젝트` : '이 프로젝트'}에 대해 질문하세요.
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.role === 'assistant' && !msg.content && isStreaming ? (
                    <span className="inline-flex gap-1 text-gray-400">
                      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                    </span>
                  ) : (
                    msg.content
                  )}
                  {msg.role === 'assistant' && msg.content && (
                    <div className="mt-2 flex flex-wrap gap-2 border-t border-gray-200 pt-1.5">
                      <button
                        onClick={() => copyToClipboard(msg.content)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-200"
                      >
                        복사
                      </button>
                      {dropboxReady && (
                        <button
                          onClick={() => saveToDropbox(i)}
                          disabled={savingIdx === i}
                          className={`text-xs px-2.5 py-1 rounded font-medium transition-all disabled:opacity-50 ${
                            savedIdx === i
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {savingIdx === i ? '저장 중...' : savedIdx === i ? '✓ 저장됨' : '☁ Dropbox 저장'}
                        </button>
                      )}
                      {extractHtml(msg.content) && (
                        <>
                          {dropboxReady && (
                            <button
                              onClick={() => saveHtml(i)}
                              disabled={savingHtmlIdx === i}
                              className={`text-xs px-2.5 py-1 rounded font-medium transition-all disabled:opacity-50 ${
                                savedHtmlIdx === i
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              }`}
                            >
                              {savingHtmlIdx === i ? '저장 중...' : savedHtmlIdx === i ? '✓ HTML 저장됨' : '📄 HTML 저장'}
                            </button>
                          )}
                          <button
                            onClick={() => openPdfPreview(extractHtml(msg.content)!)}
                            className="text-xs px-2.5 py-1 rounded font-medium bg-orange-100 text-orange-700 hover:bg-orange-200"
                          >
                            🖨️ PDF
                          </button>
                        </>
                      )}
                      {dropboxUrl && !dropboxReady && (
                        <span className="text-[10px] text-orange-400 px-1" title="Dropbox URL이 /home/... 형식이 아닙니다. 매출/리드 정보에서 URL을 수정해주세요.">
                          ⚠ Dropbox
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-200 p-3 bg-white flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="메시지 입력... (Enter 전송, Shift+Enter 줄바꿈)"
              className="flex-1 resize-none border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              rows={2}
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed self-end"
            >
              {loading ? '...' : '전송'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
