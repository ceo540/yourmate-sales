'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type ChatMode = 'new-sale' | 'new-lead' | 'update' | 'chat' | null

interface SaleData {
  name: string
  client_org: string | null
  service_type: string | null
  revenue: number | null
  memo: string | null
}

interface LeadData {
  client_org: string
  contact_name: string | null
  phone: string | null
  email: string | null
  service_type: string | null
  initial_content: string | null
  channel: string | null
  inflow_source: string | null
  remind_date: string | null
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  saleData?: SaleData | null
  leadData?: LeadData | null
  notionUrl?: string | null
}

const INIT_MSG = '뭐 할 거야?'

const MODES = [
  { id: 'new-sale' as ChatMode, label: '📝 새 계약건',       reply: '상담 중이야? 아니면 메모 정리해서 넣을 거야?' },
  { id: 'new-lead' as ChatMode, label: '🎯 새 리드',         reply: '상담 중이야? 아니면 내용 정리해서 넣을 거야?' },
  { id: 'update' as ChatMode,   label: '🔄 기존 건 업데이트', reply: '어떤 건이야? 건명이나 발주처 알려줘.' },
  { id: 'chat' as ChatMode,     label: '💬 질문하기',         reply: '물어봐.' },
]

const MODE_LABEL: Record<string, string> = {
  'new-sale': '📝 새 계약건',
  'new-lead': '🎯 새 리드',
  'update':   '🔄 기존 건 업데이트',
  'chat':     '💬 질문하기',
}

const MODE_PLACEHOLDER: Record<string, string> = {
  'new-sale':  '미팅 메모나 전사록 붙여넣기...',
  'new-lead':  '문의 내용이나 전사록 붙여넣기...',
  'update':    '건명, 발주처, 또는 추가 내용 입력...',
  'consult':   '서비스 유형이나 상황 입력... (예: SOS 견적 문의 전화 왔어)',
  'chat':      '질문 입력... (Enter 전송)',
}

export default function AiChat() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [mode, setMode] = useState<ChatMode>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [creatingId, setCreatingId] = useState<number | null>(null)
  const [creatingLeadId, setCreatingLeadId] = useState<number | null>(null)
  const [reminders, setReminders] = useState<{ id: string; lead_id: string; client_org: string | null; remind_date: string; status: string }[]>([])
  const [remindersChecked, setRemindersChecked] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bbangbbangi-messages')
      const savedMode = localStorage.getItem('bbangbbangi-mode') as ChatMode
      if (saved) {
        const parsed = JSON.parse(saved) as Message[]
        if (parsed.length > 0) {
          setMessages(parsed)
          setMode(savedMode || null)
          return
        }
      }
    } catch { /* ignore */ }
    setMessages([{ role: 'assistant', content: INIT_MSG }])
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    try {
      localStorage.setItem('bbangbbangi-messages', JSON.stringify(messages))
    } catch { /* ignore */ }
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
    if (open && !remindersChecked) {
      setRemindersChecked(true)
      fetch('/api/leads/reminders')
        .then(r => r.json())
        .then(data => { if (data.leads?.length > 0) setReminders(data.leads) })
        .catch(() => {})
    }
  }, [open, remindersChecked])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function selectMode(m: ChatMode) {
    const found = MODES.find(x => x.id === m)
    if (!found) return
    setMode(m)
    localStorage.setItem('bbangbbangi-mode', m || '')
    setMessages(prev => [...prev, { role: 'assistant', content: found.reply }])
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function reset() {
    localStorage.removeItem('bbangbbangi-messages')
    localStorage.removeItem('bbangbbangi-mode')
    setMode(null)
    setMessages([{ role: 'assistant', content: INIT_MSG }])
  }

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)

    // 첫 메시지 전송 시 모드 미선택이면 chat으로 기본 설정
    const activeMode = mode ?? 'chat'
    if (!mode) {
      setMode('chat')
      localStorage.setItem('bbangbbangi-mode', 'chat')
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          mode: activeMode,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.text || data.error || '오류가 발생했어요.',
        saleData: data.saleData ?? null,
        leadData: data.leadData ?? null,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '네트워크 오류가 발생했어요.' }])
    }
    setLoading(false)
  }

  const handleCreateSale = async (msgIdx: number, saleData: SaleData) => {
    setCreatingId(msgIdx)
    try {
      const res = await fetch('/api/chat/create-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, saleData: null } : m))
      const notionError = data.notionError ? `\nNotion 오류: ${data.notionError}` : ''
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ 완료!\n• 계약 목록에 "${saleData.name}" 생성\n• Notion 프로젝트 생성${notionError}`,
        notionUrl: data.notionUrl ?? null,
      }])
      router.refresh()
    } catch (e) {
      alert('생성 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
    setCreatingId(null)
  }

  const handleCreateLead = async (msgIdx: number, leadData: LeadData) => {
    setCreatingLeadId(msgIdx)
    try {
      const res = await fetch('/api/chat/create-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      })
      const data = await res.json()

      if (data.duplicate) {
        setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, leadData: null } : m))
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ ${data.message}\n기존 건 업데이트할게?`,
        }])
        return
      }
      if (data.error) throw new Error(data.error)

      setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, leadData: null } : m))
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ 리드 등록 완료!\n• "${leadData.client_org}" (${data.lead_id})\n• /leads 페이지에서 확인해봐`,
      }])
      router.refresh()
    } catch (e) {
      alert('생성 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
    setCreatingLeadId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const showModeButtons = mode === null && messages.length <= 1 && !loading

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        style={{ backgroundColor: '#FFCE00' }}
        title="AI 어시스턴트"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="#121212" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="#121212" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* 채팅 패널 */}
      {open && (
        <div className={`fixed bottom-[88px] right-4 md:right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden transition-all duration-200 ${
          expanded ? 'w-[calc(100vw-32px)] md:w-[680px] max-h-[80vh]' : 'w-[calc(100vw-32px)] md:w-[420px] max-h-[85vh] md:max-h-[85vh]'
        }`}>
          {/* 헤더 */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0" style={{ backgroundColor: '#FFCE00' }}>
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-semibold text-gray-900">빵빵이 😎</span>
            {mode && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 text-gray-800 font-medium">
                {MODE_LABEL[mode]}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {mode && (
                <button
                  onClick={() => { setMode(null); localStorage.removeItem('bbangbbangi-mode') }}
                  className="text-xs text-gray-600 hover:text-gray-900"
                  title="모드 변경"
                >
                  모드 변경
                </button>
              )}
              <button onClick={reset} className="text-xs text-gray-600 hover:text-gray-900">초기화</button>
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                {expanded ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25M9 15H4.5M9 15v4.5M9 15l-5.25 5.25" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* 리마인드 알림 배너 */}
          {reminders.length > 0 && (
            <div className="px-3 pt-2.5 pb-2 border-b border-orange-100 bg-orange-50 flex-shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-orange-700">🔔 리마인드 {reminders.length}건</span>
                <button onClick={() => setReminders([])} className="text-xs text-orange-400 hover:text-orange-600">닫기</button>
              </div>
              <div className="space-y-1">
                {reminders.slice(0, 3).map(r => {
                  const today = new Date(); today.setHours(0,0,0,0)
                  const target = new Date(r.remind_date); target.setHours(0,0,0,0)
                  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
                  const dday = diff === 0 ? 'D-day' : diff < 0 ? `D${diff}` : `D-${diff}`
                  const ddayColor = diff <= 0 ? 'text-red-600 font-bold' : 'text-orange-600'
                  return (
                    <div key={r.id} className="flex items-center gap-2 text-xs">
                      <span className={`w-10 shrink-0 ${ddayColor}`}>{dday}</span>
                      <span className="text-gray-700 truncate">{r.client_org || '-'}</span>
                      <span className="text-gray-400 shrink-0">{r.status}</span>
                    </div>
                  )
                })}
                {reminders.length > 3 && <p className="text-xs text-orange-400">+{reminders.length - 3}건 더</p>}
              </div>
            </div>
          )}

          {/* 모드 선택 버튼 */}
          {showModeButtons && (
            <div className="px-3 pt-3 pb-2 flex flex-col gap-2 flex-shrink-0 border-b border-gray-100">
              <p className="text-xs text-gray-400 font-medium">뭐 할 거야?</p>
              <div className="grid grid-cols-2 gap-1.5">
                {MODES.map((m, idx) => (
                  <button
                    key={m.id}
                    onClick={() => selectMode(m.id)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-gray-50 text-gray-700 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-900 transition-colors text-left ${
                      idx === MODES.length - 1 && MODES.length % 2 !== 0 ? 'col-span-2' : ''
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 메시지 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-br-sm text-gray-900'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: '#FFCE00' } : {}}
                >
                  {msg.content}
                </div>

                {/* Notion 바로가기 */}
                {msg.notionUrl && (
                  <a
                    href={msg.notionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
                    </svg>
                    Notion에서 열기
                  </a>
                )}

                {/* 계약건 추가 카드 */}
                {msg.saleData && (
                  <div className="mt-2 w-full max-w-[85%] bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-2 font-medium">계약 목록에 추가할까요?</p>
                    <div className="text-xs text-gray-700 space-y-0.5 mb-3">
                      <div><span className="text-gray-400">건명</span> {msg.saleData.name}</div>
                      {msg.saleData.client_org && <div><span className="text-gray-400">발주처</span> {msg.saleData.client_org}</div>}
                      {msg.saleData.service_type && <div><span className="text-gray-400">서비스</span> {msg.saleData.service_type}</div>}
                      {msg.saleData.revenue && <div><span className="text-gray-400">매출</span> {msg.saleData.revenue.toLocaleString()}원</div>}
                    </div>
                    <button
                      onClick={() => handleCreateSale(i, msg.saleData!)}
                      disabled={creatingId === i}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all hover:opacity-80"
                      style={{ backgroundColor: '#FFCE00', color: '#121212' }}
                    >
                      {creatingId === i ? '생성 중...' : '✚ 계약 목록에 추가'}
                    </button>
                  </div>
                )}

                {/* 리드 추가 카드 */}
                {msg.leadData && (
                  <div className="mt-2 w-full max-w-[85%] bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-2 font-medium">리드 목록에 추가할까요?</p>
                    <div className="text-xs text-gray-700 space-y-0.5 mb-3">
                      <div><span className="text-gray-400">기관</span> {msg.leadData.client_org}</div>
                      {msg.leadData.contact_name && <div><span className="text-gray-400">담당자</span> {msg.leadData.contact_name}</div>}
                      {msg.leadData.service_type && <div><span className="text-gray-400">서비스</span> {msg.leadData.service_type}</div>}
                      {msg.leadData.channel && <div><span className="text-gray-400">경로</span> {msg.leadData.channel}</div>}
                      {msg.leadData.initial_content && (
                        <div className="mt-1 text-gray-500 leading-relaxed">{msg.leadData.initial_content}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleCreateLead(i, msg.leadData!)}
                      disabled={creatingLeadId === i}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-all hover:opacity-80 bg-blue-500"
                    >
                      {creatingLeadId === i ? '등록 중...' : '🎯 리드 목록에 추가'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력 */}
          <div className="px-3 py-3 border-t border-gray-100 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode ? MODE_PLACEHOLDER[mode] : '뭐 할지 선택하거나 바로 입력해...'}
              rows={1}
              className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 max-h-32 overflow-y-auto"
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 128) + 'px'
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all hover:opacity-80"
              style={{ backgroundColor: '#FFCE00' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="#121212" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
