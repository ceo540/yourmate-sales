import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin as checkIsAdmin } from '@/lib/permissions'

const FEATURE_GROUPS = [
  {
    category: '개인',
    items: [
      {
        icon: '🏠',
        title: '개인 홈',
        href: '/dashboard',
        description: '내 담당 업무·계약·렌탈·리마인드를 한눈에 확인합니다. 이번 주 주간보고 작성 여부도 바로 확인할 수 있습니다.',
      },
      {
        icon: '📋',
        title: '일일업무표',
        href: '/daily-report',
        description: '매일 오늘 한 일 / 이슈·메모 / 내일 할 일을 기록합니다. 관리자는 팀 전체 제출 현황을 한눈에 확인합니다.',
      },
      {
        icon: '📝',
        title: '주간보고',
        href: '/weekly-report',
        description: '주차별 업무 보고서를 작성하고 제출합니다. 관리자는 전 팀원 제출 현황과 피드백을 남길 수 있습니다.',
      },
    ],
  },
  {
    category: '영업',
    items: [
      {
        icon: '💰',
        title: '매출 현황',
        href: '/sales',
        description: '연도·분기·사업부별 매출 통계와 이익률을 확인합니다.',
      },
      {
        icon: '📄',
        title: '계약 목록',
        href: '/sales/report',
        description: '전체 계약 건 목록, 원가 입력, 수금 상태 관리, 소통 내역 기록을 처리합니다.',
      },
      {
        icon: '📥',
        title: '리드 관리',
        href: '/leads',
        description: '문의·잠재 고객을 등록하고 D-day 리마인드로 팔로업을 관리합니다. 통화·이메일·방문·내부회의 등 소통 내역을 날짜·유형별로 무제한 기록할 수 있습니다. 계약 성사 시 매출건으로 전환합니다.',
      },
      {
        icon: '🎸',
        title: '렌탈 관리',
        href: '/rentals',
        description: '교구 대여 일정과 배송·수거 체크리스트를 관리합니다. 드롭박스 폴더 자동 생성 연동.',
      },
      {
        icon: '✅',
        title: '업무 관리',
        href: '/tasks',
        description: '계약 건별 업무 태스크를 생성하고 담당자·진행 상태를 추적합니다.',
      },
    ],
  },
  {
    category: '재무',
    items: [
      {
        icon: '🔔',
        title: '미수금 현황',
        href: '/receivables',
        description: '아직 완납되지 않은 계약 건을 수금 상태별로 필터링하고 추적합니다.',
      },
      {
        icon: '📋',
        title: '지급 관리',
        href: '/payments',
        description: '외주비·협력사 비용 등 지급 내역을 기록하고 처리 상태를 관리합니다.',
        adminOnly: true,
      },
      {
        icon: '📈',
        title: '재무 현황',
        href: '/finance',
        description: '월별 손익계산서, 매출·비용·이익 추이를 한눈에 확인합니다.',
        adminOnly: true,
      },
      {
        icon: '💼',
        title: '인건비 관리',
        href: '/payroll',
        description: '직원 카드 기반 월 급여 생성, 4대보험 자동 계산, 상여 세부내역 관리. 그랜터 CSV를 업로드하면 직원·프리랜서 지급 여부를 자동으로 매칭합니다. 프리랜서 원천징수 세금 리포트(3.3%) CSV 다운로드 지원.',
        adminOnly: true,
      },
      {
        icon: '🔒',
        title: '고정비 관리',
        href: '/fixed-costs',
        description: '임대료·통신비·구독료 등 매달 발생하는 고정 지출을 등록하고 연간 총액을 파악합니다.',
        adminOnly: true,
      },
      {
        icon: '📊',
        title: '자금일보',
        href: '/cashflow',
        description: '일별 자금 흐름을 기록하고 잔액을 모니터링합니다.',
        adminOnly: true,
      },
    ],
  },
  {
    category: '관리',
    items: [
      {
        icon: '🗂️',
        title: '고객 DB',
        href: '/customers',
        description: '기관·담당자 연락처를 통합 관리합니다. 리드 등록 시 자동 연동됩니다.',
      },
      {
        icon: '🏢',
        title: '거래처 DB',
        href: '/vendors',
        description: '협력사·프리랜서 등 거래처 정보를 관리하고 거래 원장을 확인합니다.',
      },
      {
        icon: '⚙️',
        title: '팀원 관리',
        href: '/admin',
        description: '팀원 계정 초대, 권한(관리자·팀장·팀원) 설정, 사업부 배정을 처리합니다.',
        adminOnly: true,
      },
    ],
  },
  {
    category: '팀',
    items: [
      {
        icon: '📢',
        title: '공지사항',
        href: '/notice',
        description: '팀 공지를 등록하고 확인합니다.',
      },
      {
        icon: '⏰',
        title: '근태 관리',
        href: '/attendance',
        description: '기기에서 받은 엑셀 파일을 업로드해 월별 출퇴근 기록을 관리합니다. 공휴일·근무시간 설정 포함.',
      },
      {
        icon: '🏖️',
        title: '연차 관리',
        href: '/hr',
        description: '연차 신청·결재 흐름을 관리합니다. 이사→대표 2단계 결재 구조.',
      },
      {
        icon: '💳',
        title: '경비 처리',
        href: '/expenses',
        description: '업무 경비를 신청하고 영수증을 첨부합니다. 관리자가 승인·반려를 처리합니다.',
      },
    ],
  },
]

export default async function AboutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, name').eq('id', user.id).single()
  const isAdmin = checkIsAdmin(profile?.role)

  const visibleGroups = FEATURE_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => isAdmin || !item.adminOnly),
  })).filter(group => group.items.length > 0)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">시스템 소개</h1>
        <p className="text-gray-500 text-sm mt-1">유어메이트 운영 시스템 기능 안내</p>
      </div>

      {/* 소개 카드 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFCE00' }}>
            <span className="text-lg font-black" style={{ color: '#121212' }}>Y</span>
          </div>
          <div>
            <p className="font-bold text-gray-900">유어메이트 운영 시스템</p>
            <p className="text-xs text-gray-400">Yourmate Operations System</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          영업·재무·인사·팀 커뮤니케이션을 하나의 플랫폼에서 관리하는 유어메이트 전용 사내 운영 도구입니다.
          리드 관리부터 계약·매출·미수금·인건비·근태·경비까지 전 과정을 통합하고,
          AI 어시스턴트 <strong>빵빵이</strong>를 통해 말 한마디로 데이터를 조회·등록할 수 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {isAdmin && (
            <span className="text-xs px-2.5 py-1 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-100 font-medium">관리자 모드</span>
          )}
          <span className="text-xs px-2.5 py-1 bg-green-50 text-green-600 rounded-full border border-green-100">역할별 접근제어</span>
          <span className="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full border border-purple-100">AI 빵빵이</span>
          <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100">실시간 DB 연동</span>
        </div>
      </div>

      {/* 기능 목록 */}
      <div className="space-y-8">
        {visibleGroups.map(group => (
          <div key={group.category}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{group.category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.items.map(f => (
                <Link
                  key={f.href}
                  href={f.href}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:border-yellow-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-xl">{f.icon}</span>
                    <span className="font-semibold text-gray-900 group-hover:text-yellow-700 transition-colors">{f.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 빵빵이 안내 */}
      <div className="mt-8 bg-purple-50 rounded-xl border border-purple-100 p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🤖</span>
          <p className="text-sm font-semibold text-purple-800">빵빵이 AI 어시스턴트</p>
        </div>
        <p className="text-xs text-purple-700 leading-relaxed mb-3">
          우측 하단 채팅 버튼 또는 채널톡 그룹 채팅에서 사용할 수 있습니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { q: '"이번 달 매출 알려줘"', desc: '월별 매출 요약' },
            { q: '"홍길동 학교 리드 등록해줘"', desc: '리드 자동 등록' },
            { q: '"미수금 현황 보여줘"', desc: '미수금 목록 조회' },
            { q: '"이번 주 내 업무 정리해줘"', desc: '담당 업무 요약' },
          ].map(ex => (
            <div key={ex.q} className="bg-white rounded-lg px-3 py-2 border border-purple-100">
              <p className="text-xs font-medium text-purple-700">{ex.q}</p>
              <p className="text-xs text-gray-400 mt-0.5">{ex.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 권한 안내 (어드민만 표시) */}
      {isAdmin && (
        <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">권한 체계</p>
          <div className="space-y-2">
            {[
              { role: '관리자', color: 'bg-yellow-100 text-yellow-800', desc: '모든 기능 접근 가능. 인건비·고정비·자금일보·팀원 관리·재무 현황 포함.' },
              { role: '팀장', color: 'bg-blue-100 text-blue-700', desc: '매출 통계, 계약, 미수금, 리드, 고객DB, 거래처 접근 가능. 재무·인건비 제외.' },
              { role: '팀원', color: 'bg-gray-100 text-gray-500', desc: '자신이 담당한 매출·리드만 조회 가능. 공지사항·근태·연차·경비는 본인 것만.' },
            ].map(r => (
              <div key={r.role} className="flex items-start gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${r.color}`}>{r.role}</span>
                <p className="text-xs text-gray-500">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
