'use client'
import { useState } from 'react'

// ✅ 실제 운영 시: 구글 캘린더 설정 > 캘린더 공유 > "삽입 코드" 에서 src= 값을 아래로 교체
const GOOGLE_CAL_SRC = 'ko.south_korea%23holiday%40group.v.calendar.google.com' // 데모: 한국 공휴일 공개 캘린더

const EMBED_URL = `https://calendar.google.com/calendar/embed?src=${GOOGLE_CAL_SRC}&ctz=Asia%2FSeoul&wkst=1&bgcolor=%23ffffff&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&hl=ko`

export default function CalendarDemoPage() {
  const [view, setView] = useState<'구글 캘린더' | '설정 안내'>('구글 캘린더')

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">캘린더</h1>
          <p className="text-gray-500 text-sm mt-1">구글 캘린더 연동</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">데모</span>
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            구글 캘린더 열기 ↗
          </a>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4">
        {(['구글 캘린더', '설정 안내'] as const).map(t => (
          <button key={t} onClick={() => setView(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {view === '구글 캘린더' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <iframe
            src={EMBED_URL}
            style={{ border: 0 }}
            width="100%"
            height="680"
            scrolling="no"
            title="Google Calendar"
          />
        </div>
      )}

      {view === '설정 안내' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <h2 className="font-bold text-gray-900">팀 캘린더 연결 방법</h2>

          <div className="space-y-4">
            {[
              { step: '1', title: '구글 캘린더 접속', desc: 'calendar.google.com → 좌측 "내 캘린더" 에서 팀 공유 캘린더 선택' },
              { step: '2', title: '설정 열기', desc: '캘린더 이름 오른쪽 ⋮ → "설정 및 공유" 클릭' },
              { step: '3', title: '삽입 코드 복사', desc: '"캘린더 통합" 섹션 → "삽입 코드" 안의 src= 값 복사\n예: abc123%40group.calendar.google.com' },
              { step: '4', title: '코드 교체', desc: 'calendar-demo/page.tsx 상단 GOOGLE_CAL_SRC 값을 복사한 값으로 교체 후 배포' },
            ].map(s => (
              <div key={s.step} className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {s.step}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{s.title}</p>
                  <p className="text-sm text-gray-500 whitespace-pre-line mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">나중에 추가할 수 있는 것</p>
            <ul className="space-y-1 text-blue-600 text-xs list-disc list-inside">
              <li>연차 승인 시 → 구글 캘린더에 자동 일정 추가 (Google Calendar API)</li>
              <li>프로젝트 마감일 → 캘린더 자동 등록</li>
              <li>여러 팀 캘린더 합쳐서 보기</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
