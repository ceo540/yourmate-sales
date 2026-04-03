'use client'
import { useState } from 'react'

const MEMBERS = ['방준영', '조민현', '유제민', '임지영']
const WEEKS = ['2026-03-30 ~ 04-05', '2026-03-23 ~ 03-29', '2026-03-16 ~ 03-22']

interface Report {
  member: string; week: string
  done: string; todo: string; issue: string
  submitted: boolean
}

const REPORTS: Report[] = [
  { member: '방준영', week: WEEKS[0], submitted: true,
    done: '- 경기도특수교육원 견적서 발송\n- 사내 시스템 업무관리 모듈 개발\n- 4월 세금계산서 발행 확인',
    todo: '- 경기도특수교육원 e페스티벌 견적 협의\n- 채널톡 AI 매니저 기획',
    issue: '없음' },
  { member: '조민현', week: WEEKS[0], submitted: true,
    done: '- SOS 서울 A초 사전 안내문 발송\n- 아티스트 컨택 완료\n- 큐시트 초안 작성',
    todo: '- 큐시트 최종본 클라이언트 전달\n- 4/25 공연 준비물 체크',
    issue: '- 아티스트 이동비 예산 초과 우려 → 대표 확인 필요' },
  { member: '유제민', week: WEEKS[0], submitted: true,
    done: '- 용인교육지원청 홍보 촬영 사전답사\n- 학교상점 납품 물품 수령',
    todo: '- 4/11 촬영 진행\n- 납품 설치 일정 확인',
    issue: '없음' },
  { member: '임지영', week: WEEKS[0], submitted: false,
    done: '', todo: '', issue: '' },
  { member: '방준영', week: WEEKS[1], submitted: true,
    done: '- 시스템 리드관리 모듈 완성\n- 기존 리드 18건 고객 DB 마이그레이션\n- 분기 매출 보고서 확인',
    todo: '- 업무관리 모듈 개발\n- 네비게이션 개편',
    issue: '없음' },
  { member: '조민현', week: WEEKS[1], submitted: true,
    done: '- SOS 견적서 2건 발송\n- 기존 고객 팔로업 콜 3건',
    todo: '- SOS 서울 A초 계약 확정',
    issue: '없음' },
]

export default function WeeklyReportDemoPage() {
  const [view, setView] = useState<'내 보고서' | '전체 보고서'>('전체 보고서')
  const [selectedWeek, setSelectedWeek] = useState(WEEKS[0])
  const [myDone, setMyDone] = useState('')
  const [myTodo, setMyTodo] = useState('')
  const [myIssue, setMyIssue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const weekReports = REPORTS.filter(r => r.week === selectedWeek)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">주간 보고</h1>
          <p className="text-gray-500 text-sm mt-1">이번 주 한 일 · 다음 주 할 일 · 이슈</p>
        </div>
        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">데모</span>
      </div>

      {/* 탭 + 주차 선택 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2">
          {(['내 보고서', '전체 보고서'] as const).map(t => (
            <button key={t} onClick={() => setView(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t}
            </button>
          ))}
        </div>
        <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white">
          {WEEKS.map(w => <option key={w}>{w}</option>)}
        </select>
      </div>

      {view === '내 보고서' && (
        <div className="space-y-4">
          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
              <p className="text-green-700 font-semibold text-lg mb-1">제출 완료 ✓</p>
              <p className="text-green-600 text-sm">{selectedWeek} 주간 보고가 등록되었습니다.</p>
              <button onClick={() => setSubmitted(false)} className="mt-3 text-xs text-green-600 underline">수정하기</button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  ✅ 이번 주 한 일
                  <span className="ml-2 text-xs font-normal text-gray-400">완료된 업무, 성과, 처리 건</span>
                </label>
                <textarea value={myDone} onChange={e => setMyDone(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  rows={4} placeholder="- 항목 1&#10;- 항목 2" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  📋 다음 주 할 일
                  <span className="ml-2 text-xs font-normal text-gray-400">예정 업무, 목표</span>
                </label>
                <textarea value={myTodo} onChange={e => setMyTodo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  rows={4} placeholder="- 항목 1&#10;- 항목 2" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  ⚠️ 이슈 / 건의
                  <span className="ml-2 text-xs font-normal text-gray-400">문제, 도움 필요, 건의사항</span>
                </label>
                <textarea value={myIssue} onChange={e => setMyIssue(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  rows={3} placeholder="없음" />
              </div>
              <button onClick={() => setSubmitted(true)}
                className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">
                제출하기
              </button>
            </div>
          )}
        </div>
      )}

      {view === '전체 보고서' && (
        <div className="space-y-3">
          {/* 제출 현황 */}
          <div className="flex gap-2 mb-2">
            {MEMBERS.map(name => {
              const r = weekReports.find(r => r.member === name)
              const ok = r?.submitted
              return (
                <div key={name} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                  <span>{ok ? '✓' : '○'}</span> {name}
                </div>
              )
            })}
          </div>

          {MEMBERS.map(name => {
            const r = weekReports.find(r => r.member === name)
            if (!r?.submitted) return (
              <div key={name} className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-500">{name[0]}</div>
                  <p className="font-semibold text-gray-500 text-sm">{name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">미제출</span>
                </div>
              </div>
            )
            return (
              <div key={name} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center text-sm font-semibold text-yellow-700">{name[0]}</div>
                  <p className="font-semibold text-gray-800">{name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">제출완료</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">✅ 이번 주 한 일</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{r.done || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">📋 다음 주 할 일</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{r.todo || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">⚠️ 이슈</p>
                    <p className={`text-sm whitespace-pre-line leading-relaxed ${r.issue && r.issue !== '없음' ? 'text-red-600' : 'text-gray-400'}`}>{r.issue || '없음'}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
