'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── 목업 데이터 ────────────────────────────────────────────────────
const PROJECT = {
  id: '2',
  name: '260312 용인 공유학교 (첼로 구매건)',
  client: '용인교육지원청 지역교육과',
  service: '납품설치',
  dept: '학교상점',
  revenue: 1200000,
  stage: '계약',
  assignee: '조민현',
  dropbox: 'https://www.dropbox.com/...',
}

const STAGES = ['견적', '계약', '납품', '완료']

const TASKS = [
  { id: 1, title: '견적서 발송', status: '완료', assignee: '조민현', due: '03/12' },
  { id: 2, title: '계약서 작성 및 서명', status: '완료', assignee: '임지영', due: '03/14' },
  { id: 3, title: '납품 일정 확정', status: '진행중', assignee: '조민현', due: '04/07' },
  { id: 4, title: '물품 발주 (첼로 4/4 × 2)', status: '할 일', assignee: '조민현', due: '04/10' },
  { id: 5, title: '배송 및 설치 완료 확인', status: '할 일', assignee: '임지영', due: '04/18' },
  { id: 6, title: '세금계산서 발행', status: '할 일', assignee: '임지영', due: '04/20' },
]

const COMMS = [
  { id: 1, date: '2026-03-28', content: '첼로 사이즈 4/4 2개로 확정. 렌탈 계약이지만 실제로는 구매로 진행.', author: '조민현', type: '통화' },
  { id: 2, date: '2026-03-25', content: '예산 확인 중. 4월 첫째 주 납품 희망.', author: '조민현', type: '이메일' },
  { id: 3, date: '2026-03-20', content: '용인교육지원청 박 주무관 미팅 — 견적 검토 완료, 계약서 요청함.', author: '임지영', type: '방문' },
]

const STATUS_STYLE: Record<string, string> = {
  '완료':   'line-through text-gray-300',
  '진행중': 'text-gray-900 font-medium',
  '할 일':  'text-gray-600',
}
const STATUS_DOT: Record<string, string> = {
  '완료':   'bg-green-400',
  '진행중': 'bg-blue-400',
  '할 일':  'bg-gray-200',
}
const COMM_TYPE_COLORS: Record<string, string> = {
  통화: 'bg-blue-50 text-blue-600',
  이메일: 'bg-purple-50 text-purple-600',
  방문: 'bg-green-50 text-green-600',
}

export default function DemoB() {
  const [tab, setTab] = useState<'memo' | 'tasks' | 'comms' | 'files'>('tasks')
  const [memo, setMemo] = useState('첼로 납품건인데, 행정은 렌탈로 결제 진행\n→ 3월 말 계약서 발송 완료\n→ 4월 납품 확정')
  const [newComm, setNewComm] = useState('')
  const [commList, setCommList] = useState(COMMS)

  const stageIdx = STAGES.indexOf(PROJECT.stage)
  const pendingCount = TASKS.filter(t => t.status !== '완료').length

  return (
    <div className="max-w-3xl mx-auto">
      {/* 데모 배너 */}
      <div className="mb-4 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
        <p className="text-xs text-purple-700 font-medium">🎨 안 B 데모 — 프로젝트 허브 방식 (계약 건 = 미니 프로젝트 공간)</p>
        <Link href="/ux-demo/dept-service" className="text-xs text-purple-600 underline">안 A 데모 보기 →</Link>
      </div>

      {/* 프로젝트 헤더 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">{PROJECT.dept}</span>
              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{PROJECT.service}</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">{PROJECT.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{PROJECT.client}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-gray-900">{(PROJECT.revenue / 10000).toFixed(0)}만원</p>
            <p className="text-xs text-gray-400 mt-0.5">담당: {PROJECT.assignee}</p>
          </div>
        </div>

        {/* 납품 단계 파이프라인 */}
        <div className="mt-4 flex items-center gap-0">
          {STAGES.map((s, i) => {
            const done = i < stageIdx
            const current = i === stageIdx
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex flex-col items-center flex-1 ${i === 0 ? '' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    done ? 'bg-green-500 text-white' : current ? 'text-gray-900 border-2 border-yellow-400' : 'bg-gray-100 text-gray-400'
                  }`} style={current ? { backgroundColor: '#FFCE00' } : {}}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[11px] mt-1 font-medium ${current ? 'text-gray-900' : done ? 'text-green-600' : 'text-gray-400'}`}>{s}</span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`h-0.5 flex-1 -mt-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {[
          { key: 'tasks', label: `업무 (${pendingCount}개 남음)` },
          { key: 'comms', label: `소통 내역 (${commList.length})` },
          { key: 'memo',  label: '메모' },
          { key: 'files', label: '파일' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              tab === t.key ? 'border-yellow-400 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 업무 탭 ── */}
      {tab === 'tasks' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {TASKS.map((t, idx) => (
            <div key={t.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${idx !== TASKS.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[t.status]}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${STATUS_STYLE[t.status]}`}>{t.title}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-xs text-gray-400">
                <span>{t.assignee}</span>
                <span className={`${t.status === '완료' ? 'text-gray-300' : t.due <= '04/07' ? 'text-orange-500 font-medium' : ''}`}>{t.due}</span>
                {t.status !== '완료' && (
                  <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                    t.status === '진행중' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>{t.status}</span>
                )}
              </div>
            </div>
          ))}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <button className="text-sm text-gray-400 hover:text-gray-700 transition-colors">+ 업무 추가</button>
          </div>
        </div>
      )}

      {/* ── 소통 내역 탭 ── */}
      {tab === 'comms' && (
        <div>
          {/* 새 소통 내역 추가 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <textarea
              value={newComm}
              onChange={e => setNewComm(e.target.value)}
              placeholder="오늘의 소통 내용을 기록하세요 (통화, 이메일, 방문 등)"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-yellow-400 mb-2"
            />
            <div className="flex gap-2">
              {['통화', '이메일', '방문', '기타'].map(type => (
                <button
                  key={type}
                  onClick={() => {
                    if (!newComm.trim()) return
                    setCommList([{ id: Date.now(), date: '2026-04-04', content: newComm, author: '방준영', type }, ...commList])
                    setNewComm('')
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:border-yellow-400 hover:bg-yellow-50 transition-all"
                >
                  {type}로 저장
                </button>
              ))}
            </div>
          </div>

          {/* 소통 내역 목록 */}
          <div className="space-y-2">
            {commList.map(c => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${COMM_TYPE_COLORS[c.type] ?? 'bg-gray-100 text-gray-500'}`}>{c.type}</span>
                  <span className="text-xs text-gray-400">{c.date}</span>
                  <span className="text-xs text-gray-400 ml-auto">{c.author}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{c.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 메모 탭 ── */}
      {tab === 'memo' && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-2">자유 형식 메모 — 진행 상황, 특이사항, 다음 할 일 등</p>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            rows={8}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-yellow-400"
          />
          <button className="mt-3 px-4 py-2 text-sm font-semibold rounded-lg w-full hover:opacity-80 transition-all" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            저장
          </button>
        </div>
      )}

      {/* ── 파일/문서 탭 ── */}
      {tab === 'files' && (
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">드롭박스 폴더</p>
              <a href="#" className="text-xs text-blue-500 hover:underline">폴더 열기 →</a>
            </div>
            <div className="space-y-2">
              {['견적서_260312_용인공유학교.pdf', '계약서_서명완료.pdf', '첼로사양서.jpg'].map(f => (
                <div key={f} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-sm">📄</span>
                  <span className="text-sm text-gray-700 flex-1">{f}</span>
                  <button className="text-xs text-blue-500 hover:underline">열기</button>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center py-6 bg-white border border-dashed border-gray-200 rounded-xl text-sm text-gray-400">
            + 파일 링크 추가
          </div>
        </div>
      )}
    </div>
  )
}
