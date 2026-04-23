'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addOnboardingItem,
  toggleOnboardingItem,
  deleteOnboardingItem,
  importOnboardingFromNotion,
  updateNotionTemplateUrl,
} from '../actions'

interface OnboardingItem {
  id: string
  member_id: string
  title: string
  completed: boolean
  completed_at: string | null
  source: string
  notion_block_id: string | null
  sort_order: number
}

interface Props {
  userId: string
  items: OnboardingItem[]
  setItems: React.Dispatch<React.SetStateAction<OnboardingItem[]>>
  initialNotionUrl: string
}

export default function OnboardingSection({ userId, items, setItems, initialNotionUrl }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [newItemTitle, setNewItemTitle] = useState('')
  const [showNewItemInput, setShowNewItemInput] = useState(false)
  const [notionUrlInput, setNotionUrlInput] = useState(initialNotionUrl)
  const [showNotionInput, setShowNotionInput] = useState(false)
  const [notionImporting, setNotionImporting] = useState(false)

  const userItems = items.filter(o => o.member_id === userId).sort((a, b) => a.sort_order - b.sort_order)
  const completedCount = userItems.filter(o => o.completed).length

  const handleAdd = async () => {
    if (!newItemTitle.trim()) { setShowNewItemInput(false); return }
    const sortOrder = userItems.length
    const optimistic: OnboardingItem = {
      id: Date.now().toString(), member_id: userId, title: newItemTitle.trim(),
      completed: false, completed_at: null, source: 'manual', notion_block_id: null, sort_order: sortOrder,
    }
    setItems(prev => [...prev, optimistic])
    setNewItemTitle('')
    setShowNewItemInput(false)
    await addOnboardingItem(userId, optimistic.title, sortOrder)
  }

  const handleNotionImport = async () => {
    if (!notionUrlInput) return
    setNotionImporting(true)
    try {
      await updateNotionTemplateUrl(notionUrlInput)
      const count = await importOnboardingFromNotion(userId, notionUrlInput)
      startTransition(() => router.refresh())
      setShowNotionInput(false)
      alert(`${count}개 항목을 가져왔어요.`)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '가져오기 실패')
    } finally {
      setNotionImporting(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* 진행 현황 바 */}
      {userItems.length > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>온보딩 진행</span>
            <span className="font-medium">{completedCount} / {userItems.length}</span>
          </div>
          <div className="bg-gray-100 rounded-full h-2">
            <div className="bg-green-400 h-2 rounded-full transition-all"
              style={{ width: `${Math.round(completedCount / userItems.length * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Notion 가져오기 */}
      <div>
        <button onClick={() => setShowNotionInput(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors">
          <span>Notion에서 가져오기</span>
        </button>
        {showNotionInput && (
          <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-2">
            <input type="text" value={notionUrlInput} onChange={e => setNotionUrlInput(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white"
              placeholder="Notion 페이지 URL 붙여넣기..." />
            <div className="flex gap-2">
              <button disabled={notionImporting} onClick={handleNotionImport}
                className="flex-1 py-1.5 bg-gray-900 text-white text-xs rounded-lg disabled:opacity-50">
                {notionImporting ? '가져오는 중...' : '가져오기'}
              </button>
              <button onClick={() => setShowNotionInput(false)} className="flex-1 py-1.5 border text-xs rounded-lg text-gray-400">취소</button>
            </div>
          </div>
        )}
      </div>

      {/* 체크리스트 */}
      {userItems.length === 0 && !showNotionInput && (
        <p className="text-center text-sm text-gray-400 py-4">온보딩 항목이 없어요.</p>
      )}
      <div className="space-y-1">
        {userItems.map(item => (
          <div key={item.id} className="flex items-center gap-2.5 group py-1.5">
            <input type="checkbox" checked={item.completed}
              onChange={async e => {
                const val = e.target.checked
                setItems(prev => prev.map(o => o.id === item.id ? {...o, completed: val} : o))
                await toggleOnboardingItem(item.id, val)
              }}
              className="w-4 h-4 rounded border-gray-300 accent-gray-800 shrink-0" />
            <span className={`flex-1 text-sm ${item.completed ? 'line-through text-gray-300' : 'text-gray-700'}`}>{item.title}</span>
            {item.source === 'notion' && <span className="text-[10px] text-gray-300 shrink-0">N</span>}
            <button onClick={async () => {
              setItems(prev => prev.filter(o => o.id !== item.id))
              await deleteOnboardingItem(item.id)
            }} className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs shrink-0">×</button>
          </div>
        ))}
      </div>

      {/* 항목 추가 */}
      {showNewItemInput ? (
        <div className="flex gap-2 mt-1">
          <input type="text" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)}
            onKeyDown={async e => {
              if (e.key === 'Enter' && newItemTitle.trim()) {
                await handleAdd()
              }
            }}
            autoFocus
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="항목 이름..." />
          <button onClick={handleAdd} className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg">추가</button>
          <button onClick={() => { setShowNewItemInput(false); setNewItemTitle('') }} className="px-2 py-1.5 border text-xs rounded-lg text-gray-400">✕</button>
        </div>
      ) : (
        <button onClick={() => setShowNewItemInput(true)}
          className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
          + 항목 추가
        </button>
      )}
    </div>
  )
}
