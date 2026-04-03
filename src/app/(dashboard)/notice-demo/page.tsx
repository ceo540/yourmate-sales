'use client'
import { useState } from 'react'

type Category = '전체' | '공지' | '업무' | '복지' | '기타'
const CAT_STYLE: Record<string, string> = {
  공지: 'bg-red-100 text-red-600',
  업무: 'bg-blue-100 text-blue-600',
  복지: 'bg-green-100 text-green-600',
  기타: 'bg-gray-100 text-gray-500',
}

interface Post {
  id: string; category: Exclude<Category,'전체'>; title: string
  author: string; date: string; pinned?: boolean
  content: string; views: number
}

const POSTS: Post[] = [
  { id: '1', category: '공지', title: '2026년 상반기 복무 규정 안내', author: '방준영', date: '2026-04-01', pinned: true, views: 12,
    content: `안녕하세요, 대표 방준영입니다.\n\n2026년 상반기부터 아래와 같이 복무 규정이 변경됩니다.\n\n**근무 시간**\n- 기본 근무: 09:00 ~ 18:00\n- 점심시간: 12:00 ~ 13:00\n- 재택근무: 팀장 사전 승인 후 가능\n\n**외근**\n- 당일 09:00 전 팀 카카오톡 알림 필수\n- 외근 종료 후 근태 앱에 직접 기록\n\n궁금한 점은 언제든지 문의해주세요.` },
  { id: '2', category: '업무', title: '4월 세금계산서 마감일 안내 (4/10)', author: '방준영', date: '2026-04-02', pinned: true, views: 8,
    content: `4월 세금계산서 마감은 **4월 10일(금)** 입니다.\n\n각 사업부별 전월 매출 건에 대해 세금계산서 발행 여부를 확인해주시고, 미발행 건은 4/10 17:00 전까지 완료해주세요.\n\n문의: ceo@yourmate.io` },
  { id: '3', category: '복지', title: '4월 생일자 축하 — 조민현 팀장 🎂', author: '방준영', date: '2026-04-01', views: 15,
    content: `4월의 생일자를 축하합니다!\n\n🎉 조민현 팀장 (4월 8일)\n\n회사에서 소정의 선물과 함께 생일 축하 식사를 준비할 예정입니다.\n일정은 별도 공지 드릴게요.` },
  { id: '4', category: '업무', title: '경기도특수교육원 진드페 사전 미팅 일정 공유', author: '임지영', date: '2026-04-02', views: 6,
    content: `경기도특수교육원 진드페(2026-06-11) 관련 사전 미팅 일정을 공유합니다.\n\n- 일시: 2026-04-14 (화) 14:00\n- 장소: 경기도특수교육원 회의실\n- 참석: 임지영, 유제민\n\n미팅 전 견적서 최종본 확인 부탁드립니다.` },
  { id: '5', category: '복지', title: '5월 워크숍 장소 투표 (4/7까지)', author: '방준영', date: '2026-03-31', views: 20,
    content: `5월 워크숍 장소 후보를 공유합니다. 아래 중 선호하는 곳에 투표해주세요!\n\nA. 가평 펜션 (1박 2일)\nB. 서울 내 세미나실 + 저녁 식사\nC. 제주도 (1박 2일)\n\n투표 마감: 4월 7일 (화) 자정\n팀 카카오톡 채널에서 투표해주세요.` },
  { id: '6', category: '기타', title: '사무실 에어컨 점검 — 4/9 오후 일시 미사용', author: '방준영', date: '2026-03-28', views: 5,
    content: `4월 9일(목) 오후 2시 ~ 4시 사이 에어컨 정기 점검이 진행됩니다.\n해당 시간 동안 에어컨 사용이 불가하오니 참고 바랍니다.` },
]

export default function NoticeDemoPage() {
  const [category, setCategory] = useState<Category>('전체')
  const [selected, setSelected] = useState<Post>(POSTS[0])
  const [showWrite, setShowWrite] = useState(false)

  const filtered = POSTS.filter(p => category === '전체' || p.category === category)
  const pinned = filtered.filter(p => p.pinned)
  const normal = filtered.filter(p => !p.pinned)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">공지사항</h1>
          <p className="text-gray-500 text-sm mt-1">팀 공지 · 업무 안내 · 복지 정보</p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">데모</span>
          <button onClick={() => setShowWrite(true)}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            + 글쓰기
          </button>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 mb-4">
        {(['전체','공지','업무','복지','기타'] as Category[]).map(c => (
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
                <button key={p.id} onClick={() => setSelected(p)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors ${selected.id === p.id ? 'bg-yellow-50' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs">📌</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_STYLE[p.category]}`}>{p.category}</span>
                  </div>
                  <p className={`text-sm font-medium ${selected.id === p.id ? 'text-yellow-700' : 'text-gray-800'} line-clamp-1`}>{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.author} · {p.date.slice(5)}</p>
                </button>
              ))}
            </div>
          )}
          <div>
            {normal.map(p => (
              <button key={p.id} onClick={() => setSelected(p)}
                className={`w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected.id === p.id ? 'bg-blue-50' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_STYLE[p.category]}`}>{p.category}</span>
                </div>
                <p className={`text-sm font-medium ${selected.id === p.id ? 'text-blue-700' : 'text-gray-800'} line-clamp-1`}>{p.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.author} · {p.date.slice(5)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 상세 */}
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {selected.pinned && <span className="text-sm">📌</span>}
                <span className={`text-xs px-2 py-0.5 rounded ${CAT_STYLE[selected.category]}`}>{selected.category}</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{selected.title}</h2>
              <p className="text-sm text-gray-400">{selected.author} · {selected.date} · 조회 {selected.views}</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{selected.content}</p>
          </div>
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
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option>공지</option><option>업무</option><option>복지</option><option>기타</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="제목을 입력하세요" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">내용</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={6} placeholder="내용을 입력하세요" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" className="rounded" />
                상단 고정
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowWrite(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={() => setShowWrite(false)}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-800">등록</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
