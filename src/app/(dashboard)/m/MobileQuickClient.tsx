'use client'

// 모바일 빠른 입력 — 한 손 조작 + 하단 고정 액션 바.
// 사진·메모·음성·GPS·영수증 빠르게 → 선택 프로젝트에 자동 첨부.

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'

type ProjectOption = {
  id: string
  name: string
  project_number: string | null
  customer_id: string | null
  service_type: string | null
}

type Action = 'photo' | 'voice' | 'memo' | 'location' | 'receipt'

export default function MobileQuickClient({ projects, currentUserId }: {
  projects: ProjectOption[]
  currentUserId: string
}) {
  void currentUserId
  const router = useRouter()
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id ?? '')
  const [activeAction, setActiveAction] = useState<Action | null>(null)
  const [memo, setMemo] = useState('')
  const [pending, startTransition] = useTransition()
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  const handleLocationCheck = () => {
    setStatusMsg('위치 확인 중…')
    if (!navigator.geolocation) {
      setStatusMsg('이 기기에서 위치 정보를 받을 수 없습니다')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        setStatusMsg(`📍 ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (정확도 ±${Math.round(pos.coords.accuracy)}m)`)
      },
      (err) => setStatusMsg(`위치 오류: ${err.message}`),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handleSaveMemo = () => {
    if (!selectedProjectId) { alert('프로젝트 선택 필요'); return }
    if (!memo.trim()) { alert('메모 내용 입력'); return }
    startTransition(async () => {
      const body = {
        project_id: selectedProjectId,
        title: '현장 메모',
        content: memo + (coords ? `\n\n📍 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : ''),
      }
      const res = await fetch('/api/admin/m-quick-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(`저장 실패: ${err?.error ?? res.status}`)
        return
      }
      setMemo('')
      setActiveAction(null)
      setStatusMsg('✅ 메모 저장됨')
      router.refresh()
    })
  }

  const handlePhotoUpload = () => {
    fileRef.current?.click()
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStatusMsg(`📷 ${file.name} (${(file.size / 1024).toFixed(0)}KB) 선택됨 — 업로드 기능은 다음 라운드`)
    // TODO: 실제 Dropbox 업로드 구현 (다음 라운드)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 상단: 활성 프로젝트 선택 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-3">
        <p className="text-[11px] text-gray-500 mb-1">📍 현재 프로젝트</p>
        {projects.length === 0 ? (
          <p className="text-sm text-gray-400">진행 중 프로젝트 없음</p>
        ) : (
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="w-full px-2 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_number ? `[${p.project_number}] ` : ''}{p.name}
              </option>
            ))}
          </select>
        )}
        {selectedProject?.service_type && (
          <span className="inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700">
            {selectedProject.service_type}
          </span>
        )}
      </header>

      {/* 메인 — 활성 액션 화면 */}
      <main className="px-4 py-4">
        {!activeAction && (
          <div className="text-center text-gray-400 py-8">
            <p className="text-sm">아래 액션 선택</p>
          </div>
        )}

        {statusMsg && (
          <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
            {statusMsg}
          </div>
        )}

        {activeAction === 'memo' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">📝 빠른 메모</h2>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="현장에서 본 것·들은 것·결정 사항·할 일 등 자유롭게…"
              rows={6}
              className="w-full p-2 border border-gray-200 rounded text-sm"
              autoFocus
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleSaveMemo}
                disabled={pending || !memo.trim()}
                className="flex-1 py-2 bg-yellow-400 hover:bg-yellow-500 text-white font-semibold rounded-lg disabled:opacity-50"
              >저장</button>
              <button
                onClick={() => { setActiveAction(null); setMemo('') }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
              >취소</button>
            </div>
            {coords && (
              <p className="mt-2 text-[10px] text-gray-500">📍 위치 자동 첨부됨</p>
            )}
          </div>
        )}

        {activeAction === 'photo' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">📷 사진 업로드</h2>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              onClick={handlePhotoUpload}
              className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
            >📸 카메라 또는 갤러리에서</button>
            <p className="mt-2 text-[10px] text-gray-400">
              ⚠️ Dropbox 업로드는 다음 라운드. 지금은 파일 선택만 동작.
            </p>
          </div>
        )}

        {activeAction === 'voice' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">🎙 음성 메모</h2>
            <p className="text-xs text-gray-500">
              음성 입력은 다음 라운드. 임시: 기본 빵빵이 채팅에 음성 입력 사용.
            </p>
            <button
              onClick={() => setActiveAction(null)}
              className="mt-3 px-4 py-2 bg-gray-100 rounded-lg text-sm"
            >닫기</button>
          </div>
        )}

        {activeAction === 'receipt' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">🧾 영수증 처리</h2>
            <p className="text-xs text-gray-500">
              영수증 OCR + 경비 처리는 다음 라운드 (yourmate-spec.md §4.7.4).
            </p>
            <button
              onClick={() => setActiveAction(null)}
              className="mt-3 px-4 py-2 bg-gray-100 rounded-lg text-sm"
            >닫기</button>
          </div>
        )}

        {activeAction === 'location' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">📍 위치 기록</h2>
            <button
              onClick={handleLocationCheck}
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg"
            >현재 위치 확인</button>
            {coords && (
              <div className="mt-3 text-xs space-y-1 bg-gray-50 rounded p-2">
                <p>위도: {coords.lat.toFixed(6)}</p>
                <p>경도: {coords.lng.toFixed(6)}</p>
                <p>정확도: ±{Math.round(coords.accuracy)}m</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-500 hover:underline"
                >🗺 구글 지도에서 확인 →</a>
              </div>
            )}
            <p className="mt-2 text-[10px] text-gray-400">
              ⚠️ DB 자동 저장(location_logs)은 다음 라운드. 지금은 확인만.
            </p>
          </div>
        )}
      </main>

      {/* 하단 고정 액션 바 — 한 손 조작 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-20">
        <div className="grid grid-cols-5 gap-1">
          {([
            { id: 'photo' as Action, label: '📷', name: '사진' },
            { id: 'voice' as Action, label: '🎙', name: '음성' },
            { id: 'memo' as Action, label: '📝', name: '메모' },
            { id: 'location' as Action, label: '📍', name: '위치' },
            { id: 'receipt' as Action, label: '🧾', name: '영수증' },
          ]).map(b => (
            <button
              key={b.id}
              onClick={() => setActiveAction(activeAction === b.id ? null : b.id)}
              className={`py-3 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeAction === b.id
                  ? 'bg-yellow-400 text-white'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{b.label}</span>
              <span className="text-[9px]">{b.name}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
