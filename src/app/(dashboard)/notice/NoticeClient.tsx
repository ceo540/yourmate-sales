'use client'
import { useState, useTransition } from 'react'
import { createNotice, deleteNotice, togglePin, incrementViews } from './actions'

type Category = '전체' | '공지' | '업무' | '복지' | '기타'

const CAT_STYLE: Record<string, string> = {
  공지: 'bg-red-100 text-red-600',
  업무: 'bg-blue-100 text-blue-600',
  복지: 'bg-green-100 text-green-600',
  기타: 'bg-gray-100 text-gray-500',
}

interface Notice {
  id: string
  category: string
  title: string
  content: string
  author_id: string
  author_name: string
  pinned: boolean
  views: number
  created_at: string
}

interface Props {
  notices: Notice[]
  isAdmin: boolean
  currentUserId: string
}

export default function NoticeClient({ notices, isAdmin, currentUserId }: Props) {
  const [category, setCategory] = useState<Category>('전체')
  const [selected, setSelected] = useState<Notice | null>(notices[0] ?? null)
  const [showWrite, setShowWrite] = useState(false)
  const [isPending, startTransition] = useTransition()

  const filtered = notices.filter(p => category === '전체' || p.category === category)
  const pinned = filtered.filter(p => p.pinned)
  const normal = filtered.filter(p => !p.pinned)

  function handleSelect(notice: Notice) {
    setSelected(notice)
    startTransition(() => { incrementViews(notice.id) })
  }

  async function handleWrite(formData: FormData) {
    const result = await createNotice(formData)
    if (!result?.error) setShowWrite(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    startTransition(() => { deleteNotice(id) })
    if (selected?.id === id) setSelected(notices.find(n => n.id !== id) ?? null)
  }

  async function handlePin(id: string, current: boolean) {
    startTransition(() => { togglePin(id, !current) })
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">공지사항</h1>
          <p className="text-gray-500 text-sm mt-1">팀 공지 · 업무 안내 · 복지 정보</p>
        </div>
        <button onClick={() => setShowWrite(true)}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          + 글쓰기
        </button>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 mb-4">
        {(['전체', '공지', '업무', '복지', '기타'] as Category[]).map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${category === c ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="flex gap-4 min-h-[500px]">
        {/* 목록 */}
        <div className="w-80 shrink-0 bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {pinned.length > 0 && (
            <div className="border-b border-gray-100">
              {pinned.map(p => (
                <button key={p.id} onClick={() => handleSelect(p)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors ${selected?.id === p.id ? 'bg-yellow-50' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs">📌</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_STYLE[p.category]}`}>{p.category}</span>
                  </div>
                  <p className={`text-sm font-medium ${selected?.id === p.id ? 'text-yellow-700' : 'text-gray-800'} line-clamp-1`}>{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.author_name} · {p.created_at.slice(5, 10)}</p>
                </button>
              ))}
            </div>
          )}
          <div>
            {normal.map(p => (
              <button key={p.id} onClick={() => handleSelect(p)}
                className={`w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.id === p.id ? 'bg-blue-50' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_STYLE[p.category]}`}>{p.category}</span>
                </div>
                <p className={`text-sm font-medium ${selected?.id === p.id ? 'text-blue-700' : 'text-gray-800'} line-clamp-1`}>{p.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.author_name} · {p.created_at.slice(5, 10)}</p>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-10">공지사항이 없습니다.</p>
            )}
          </div>
        </div>

        {/* 상세 */}
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-6">
          {selected ? (
            <>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {selected.pinned && <span className="text-sm">📌</span>}
                    <span className={`text-xs px-2 py-0.5 rounded ${CAT_STYLE[selected.category]}`}>{selected.category}</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{selected.title}</h2>
                  <p className="text-sm text-gray-400">{selected.author_name} · {selected.created_at.slice(0, 10)} · 조회 {selected.views}</p>
                </div>
                {(isAdmin || selected.author_id === currentUserId) && (
                  <div className="flex gap-2 ml-4">
                    {isAdmin && (
                      <button onClick={() => handlePin(selected.id, selected.pinned)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${selected.pinned ? 'border-yellow-300 text-yellow-600 hover:bg-yellow-50' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                        {selected.pinned ? '고정 해제' : '고정'}
                      </button>
                    )}
                    <button onClick={() => handleDelete(selected.id)}
                      className="text-xs px-2 py-1 rounded border border-red-200 text-red-400 hover:bg-red-50 transition-colors">
                      삭제
                    </button>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 pt-5">
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{selected.content}</p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              공지를 선택해주세요.
            </div>
          )}
        </div>
      </div>

      {/* 글쓰기 모달 */}
      {showWrite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">새 공지 작성</h3>
              <button onClick={() => setShowWrite(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form action={handleWrite} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
                <select name="category" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option>공지</option><option>업무</option><option>복지</option><option>기타</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
                <input name="title" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="제목을 입력하세요" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">내용</label>
                <textarea name="content" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={6} placeholder="내용을 입력하세요" />
              </div>
              {isAdmin && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" name="pinned" className="rounded" />
                  상단 고정
                </label>
              )}
              <div className="flex gap-2 mt-5">
                <button type="button" onClick={() => setShowWrite(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-800 disabled:opacity-50">등록</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
