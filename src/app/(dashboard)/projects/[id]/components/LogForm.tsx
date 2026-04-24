'use client'

import { useState } from 'react'

export type LogType = '통화' | '이메일' | '방문' | '미팅' | '출장' | '내부회의' | '메모' | '기타'

export const LOG_CATEGORY: Record<LogType, '외부' | '내부'> = {
  통화: '외부', 이메일: '외부', 방문: '외부', 미팅: '외부', 출장: '외부',
  내부회의: '내부', 메모: '내부', 기타: '외부',
}

export const LOG_HAS_LOCATION = new Set(['방문', '미팅', '출장', '내부회의'])
export const LOG_HAS_PARTICIPANTS = new Set(['방문', '미팅', '출장', '내부회의'])
export const LOG_HAS_OUTCOME = new Set(['통화', '이메일', '방문', '미팅', '출장', '내부회의'])

interface ContractOption { id: string; name: string }

interface Props {
  contracts: ContractOption[]
  onSubmit: (type: string, category: string, content: string, contactedAt: string, location: string, participants: string[], outcome: string, saleId: string | null) => void
  isPending: boolean
}

export default function LogForm({ contracts, onSubmit, isPending }: Props) {
  const [type, setType] = useState<LogType>('통화')
  const [content, setContent] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16))
  const [location, setLocation] = useState('')
  const [participants, setParticipants] = useState('')
  const [outcome, setOutcome] = useState('')
  const [saleId, setSaleId] = useState('')

  const category = LOG_CATEGORY[type]
  const showLocation = LOG_HAS_LOCATION.has(type)
  const showParticipants = LOG_HAS_PARTICIPANTS.has(type)
  const showOutcome = LOG_HAS_OUTCOME.has(type)

  function submit() {
    if (!content.trim()) return
    const pList = participants.trim() ? participants.split(',').map(s => s.trim()).filter(Boolean) : []
    onSubmit(type, category, content, date, location, pList, outcome, saleId || null)
    setContent(''); setLocation(''); setParticipants(''); setOutcome('')
    setDate(new Date().toISOString().slice(0, 16))
  }

  return (
    <div className="px-4 pt-3 pb-3 border-b border-gray-50">
      <div className="flex gap-1.5 flex-wrap mb-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-1">외부</span>
          {(['통화', '이메일', '방문', '미팅', '출장', '기타'] as LogType[]).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${type === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="w-px bg-gray-200 mx-0.5" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-1">내부</span>
          {(['내부회의', '메모'] as LogType[]).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${type === t ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 mb-2">
        <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 w-40 flex-shrink-0" />
        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder={category === '내부' ? '회의 내용이나 메모를 입력하세요...' : '소통 내용을 입력하세요...'}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
          rows={2} onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submit() }} />
      </div>
      {(showLocation || showParticipants) && (
        <div className="flex gap-2 mb-2">
          {showLocation && <input value={location} onChange={e => setLocation(e.target.value)} placeholder="📍 장소"
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400" />}
          {showParticipants && <input value={participants} onChange={e => setParticipants(e.target.value)} placeholder="참석자 (쉼표로 구분)"
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400" />}
        </div>
      )}
      {showOutcome && (
        <input value={outcome} onChange={e => setOutcome(e.target.value)}
          placeholder={category === '내부' ? '결정사항 요약 (선택)' : '결과 요약 (선택)'}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400 mb-2" />
      )}
      <div className="flex items-center gap-2">
        {contracts.length > 1 && (
          <select value={saleId} onChange={e => setSaleId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400">
            <option value="">프로젝트 공통</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.name.slice(0, 20)}</option>)}
          </select>
        )}
        <button onClick={submit} disabled={isPending || !content.trim()}
          className="px-4 py-1.5 bg-yellow-400 text-gray-900 text-xs font-medium rounded-lg hover:bg-yellow-300 disabled:opacity-40">저장</button>
      </div>
    </div>
  )
}
