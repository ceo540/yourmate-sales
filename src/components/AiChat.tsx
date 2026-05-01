'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import MarkdownText from './MarkdownText'

type ChatMode = 'new-sale' | 'new-lead' | 'update' | 'chat' | null

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

interface ToolTraceItem {
  name: string
  ok: boolean
  error?: string | null
  inputSummary?: Record<string, unknown>
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  imagePreview?: string | null   // 썸네일용 (localStorage 저장용)
  leadData?: LeadData | null
  toolTrace?: ToolTraceItem[]    // 디버그 — 빵빵이가 호출한 도구 trace
}

const INIT_MSG = '뭐 할 거야?'
const PROJECT_INIT_MSG = '이 프로젝트 뭐 도와줄까?'

const EXAMPLES: Record<string, string[]> = {
  'new-sale':  ['OO학교 행사운영 2천만원 계약 체결했어', 'OO기관 납품설치 1500만원, 수금 50% 완료'],
  'new-lead':  ['OO중학교 납품설치 문의 전화 왔어, 4/15 리마인드 걸어줘', '채널톡으로 악기 대여 문의 들어왔어'],
  'update':    ['포천시청소년재단 견적 보냈어', '경기도교육청 상태 진행중으로 바꿔줘'],
  'chat':      ['이번달 매출 얼마야?', '리마인드 임박한 리드 있어?', '미수금 현황 알려줘'],
}

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
  const [creatingLeadId, setCreatingLeadId] = useState<number | null>(null)
  const [savingBriefId, setSavingBriefId] = useState<number | null>(null)
  const [savedBriefIds, setSavedBriefIds] = useState<Set<number>>(new Set())
  const [imageAttachment, setImageAttachment] = useState<{ base64: string; mediaType: string; preview: string } | null>(null)
  const [reminders, setReminders] = useState<{ id: string; lead_id: string; client_org: string | null; remind_date: string; status: string }[]>([])
  const [remindersChecked, setRemindersChecked] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  const pathParts = pathname.split('/')
  const projectsIdx = pathParts.indexOf('projects')
  const projectId = projectsIdx !== -1 && pathParts[projectsIdx + 1] ? pathParts[projectsIdx + 1] : null
  const isLeadsPage = pathname.startsWith('/leads')

  const storageKey = projectId ? `bbangbbangi-msg-project-${projectId}` : 'bbangbbangi-messages'
  const storageModeKey = projectId ? `bbangbbangi-mode-project-${projectId}` : 'bbangbbangi-mode'

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      const savedMode = localStorage.getItem(storageModeKey) as ChatMode
      if (saved) {
        const parsed = JSON.parse(saved) as Message[]
        if (parsed.length > 0) {
          setMessages(parsed)
          setMode(savedMode || null)
          return
        }
      }
    } catch { /* ignore */ }
    const initMsg = projectId ? PROJECT_INIT_MSG : INIT_MSG
    setMessages([{ role: 'assistant', content: initMsg }])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (messages.length === 0) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch { /* ignore */ }
  }, [messages, storageKey])

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
    localStorage.setItem(storageModeKey, m || '')
    setMessages(prev => [...prev, { role: 'assistant', content: found.reply }])
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function reset() {
    localStorage.removeItem(storageKey)
    localStorage.removeItem(storageModeKey)
    setMode(null)
    const initMsg = projectId ? PROJECT_INIT_MSG : INIT_MSG
    setMessages([{ role: 'assistant', content: initMsg }])
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      const mediaType = file.type || 'image/jpeg'
      setImageAttachment({ base64, mediaType, preview: dataUrl })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    const hasImage = !!imageAttachment
    if (!text && !hasImage || loading) return
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const userMsg: Message = {
      role: 'user',
      content: text || '이 이미지 분석해줘.',
      imagePreview: imageAttachment?.preview ?? null,
    }
    const capturedImage = imageAttachment
    setImageAttachment(null)

    const newMessages: Message[] = [...messages, userMsg]
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
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m === userMsg && capturedImage ? {
              imageData: { base64: capturedImage.base64, mediaType: capturedImage.mediaType }
            } : {}),
          })),
          mode: activeMode,
          projectId: projectId ?? undefined,
        }),
      })
      const data = await res.json()
      const content = data.text || data.error || (data.leadData ? '리드 정보 추출 완료!' : '오류가 발생했어요.')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content,
        leadData: data.leadData ?? null,
        toolTrace: Array.isArray(data.toolTrace) ? data.toolTrace : undefined,
      }])
      // 빵빵이 도구가 데이터를 변경했으면 페이지 SC 재로딩
      if (data.mutated) router.refresh()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '네트워크 오류가 발생했어요.' }])
    }
    setLoading(false)
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
      if (data.error) throw new Error(data.error)

      setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, leadData: null } : m))
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ 리드 등록 완료!\n• "${leadData.client_org}" (${data.lead_id})${data.note || ''}\n• /leads 페이지에서 확인해봐`,
      }])
      router.refresh()
    } catch (e) {
      alert('생성 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
    setCreatingLeadId(null)
  }

  const handleSaveToBrief = async (msgIdx: number, content: string) => {
    if (!projectId) return
    setSavingBriefId(msgIdx)
    try {
      const res = await fetch('/api/claude/save-to-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, note: content }),
      })
      if (res.ok) setSavedBriefIds(prev => new Set(prev).add(msgIdx))
    } catch { /* ignore */ }
    setSavingBriefId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const showModeButtons = mode === null && messages.length <= 1 && !loading
  const showExamples = mode !== null && messages.length <= 2 && !loading

  return (
    <>
      {/* 플로팅 버튼 - 모바일에서는 채팅창 열리면 숨김 */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-50 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${open ? 'hidden md:flex w-12 h-12' : 'flex w-14 h-14 md:w-12 md:h-12'}`}
        style={{ backgroundColor: '#FFCE00', bottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
        title="AI 어시스턴트"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="#121212" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="#121212" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {projectId && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
            )}
          </>
        )}
      </button>

      {/* 채팅 패널 - 모바일: 전체화면, 데스크탑: 플로팅 */}
      {open && (
        <div
          className={`fixed z-50 bg-white flex flex-col overflow-hidden
            inset-0
            md:inset-auto md:bottom-[88px] md:right-4 lg:right-6
            md:rounded-2xl md:shadow-2xl md:border md:border-gray-100
            ${expanded ? 'md:w-[680px] md:max-h-[80vh]' : 'md:w-[420px] md:max-h-[85vh]'}
          `}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* 헤더 */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0" style={{ backgroundColor: '#FFCE00' }}>
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-semibold text-gray-900">빵빵이 😎</span>
            {projectId && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-900 font-medium">
                📁 프로젝트
              </span>
            )}
            {!projectId && isLeadsPage && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-900 font-medium">
                🎯 리드
              </span>
            )}
            {mode && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 text-gray-800 font-medium">
                {MODE_LABEL[mode]}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {mode && (
                <button
                  onClick={() => { setMode(null); localStorage.removeItem(storageModeKey) }}
                  className="text-xs text-gray-600 hover:text-gray-900"
                  title="모드 변경"
                >
                  모드 변경
                </button>
              )}
              <button onClick={reset} className="text-xs text-gray-600 hover:text-gray-900">초기화</button>
              {/* 모바일에서는 X 버튼, 데스크탑에서는 확장 버튼 */}
              <button
                onClick={() => setOpen(false)}
                className="md:hidden text-gray-700 hover:text-gray-900 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={() => setExpanded(e => !e)}
                className="hidden md:block text-gray-600 hover:text-gray-900 transition-colors"
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

          {/* 예시 칩 */}
          {showExamples && mode && EXAMPLES[mode] && (
            <div className="px-3 pb-2 pt-1.5 flex flex-wrap gap-1.5 border-b border-gray-100 flex-shrink-0">
              <p className="w-full text-[10px] text-gray-400 mb-0.5">예시 👇</p>
              {EXAMPLES[mode].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => send(ex)}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-900 transition-colors text-left"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {/* 메시지 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.imagePreview && (
                  <img
                    src={msg.imagePreview}
                    alt="첨부 이미지"
                    className="max-w-[200px] max-h-[160px] rounded-xl mb-1 object-cover border border-gray-200"
                  />
                )}
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-br-sm text-gray-900 whitespace-pre-wrap'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: '#FFCE00' } : {}}
                >
                  {msg.role === 'assistant'
                    ? <MarkdownText>{msg.content}</MarkdownText>
                    : msg.content}
                </div>

                {/* 도구 호출 trace — 빵빵이가 진짜 어떤 도구 호출했는지 진단용 */}
                {msg.role === 'assistant' && msg.toolTrace && msg.toolTrace.length > 0 && (
                  <details className="mt-1 text-[10px] text-gray-400">
                    <summary className="cursor-pointer hover:text-gray-600">
                      🔧 호출한 도구 {msg.toolTrace.length}개
                    </summary>
                    <div className="mt-1 space-y-0.5 pl-2">
                      {msg.toolTrace.map((t, ti) => (
                        <div key={ti} className={`font-mono ${t.ok ? 'text-gray-500' : 'text-red-500'}`}>
                          {t.ok ? '✓' : '✗'} <b>{t.name}</b>
                          {t.inputSummary && Object.keys(t.inputSummary).length > 0 && (
                            <span className="text-gray-400">
                              ({Object.entries(t.inputSummary).slice(0, 3).map(([k, v]) =>
                                `${k}=${typeof v === 'string' ? `"${v}"` : v}`
                              ).join(', ')})
                            </span>
                          )}
                          {t.error && <span className="text-red-400"> — {t.error}</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Brief 저장 버튼 (프로젝트 페이지 + 어시스턴트 메시지) */}
                {msg.role === 'assistant' && projectId && i > 0 && (
                  <button
                    onClick={() => handleSaveToBrief(i, msg.content)}
                    disabled={savingBriefId === i || savedBriefIds.has(i)}
                    className="mt-1 text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 disabled:opacity-60 transition-colors"
                  >
                    {savedBriefIds.has(i) ? '✓ 저장됨' : savingBriefId === i ? '저장 중...' : '📝 Brief'}
                  </button>
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
          <div className="px-3 py-3 border-t border-gray-100 flex flex-col gap-2 flex-shrink-0">
            {/* 이미지 미리보기 */}
            {imageAttachment && (
              <div className="relative w-fit">
                <img
                  src={imageAttachment.preview}
                  alt="첨부 이미지"
                  className="h-20 rounded-xl object-cover border border-gray-200"
                />
                <button
                  onClick={() => setImageAttachment(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-600 text-white text-xs flex items-center justify-center hover:bg-gray-800"
                >×</button>
              </div>
            )}
            <p className="text-[10px] text-gray-400 text-right -mb-1">Shift+Enter 줄바꿈</p>
            <div className="flex gap-2 items-end">
              {/* 숨겨진 파일 입력 — 모바일에서 카메라/갤러리 선택 가능 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 md:w-8 md:h-8 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                title="이미지 첨부"
              >
                <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode ? MODE_PLACEHOLDER[mode] : projectId ? '이 프로젝트 관련해서 뭐든...' : '뭐 할지 선택하거나 바로 입력해...'}
                rows={1}
                className="flex-1 resize-none px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 max-h-32 overflow-y-auto"
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 128) + 'px'
                }}
              />
              <button
                onClick={() => send()}
                disabled={(!input.trim() && !imageAttachment) || loading}
                className="w-10 h-10 md:w-8 md:h-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all hover:opacity-80"
                style={{ backgroundColor: '#FFCE00' }}
              >
                <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="#121212" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
