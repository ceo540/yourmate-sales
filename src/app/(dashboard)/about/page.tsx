import Link from 'next/link'

const FEATURE_GROUPS = [
  {
    category: '영업',
    items: [
      {
        icon: '🏠',
        title: '대시보드',
        href: '/dashboard',
        description: '이번 달 매출·원가·이익 요약, 미수금 현황, 최근 계약 건을 한눈에 확인합니다.',
      },
      {
        icon: '💰',
        title: '매출 현황',
        href: '/sales',
        description: '연도·분기·사업부별 매출 통계와 사업부별 이익률을 확인합니다.',
      },
      {
        icon: '📄',
        title: '계약 목록',
        href: '/sales/report',
        description: '전체 계약 건 목록, 원가 입력, 수금상태 관리, 일괄 변경을 처리합니다.',
      },
      {
        icon: '📥',
        title: '리드 관리',
        href: '/leads',
        description: '문의·잠재 고객을 등록하고 D-day 리마인드로 팔로업을 관리합니다. 계약 성사 시 매출건으로 전환합니다.',
      },
      {
        icon: '✅',
        title: '업무 관리',
        href: '/tasks',
        description: '계약 건별 업무 태스크를 생성하고 담당자·진행상태를 추적합니다.',
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
        description: '아직 완납되지 않은 계약 건을 수금상태별로 필터링하고 추적합니다.',
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
        description: '직원 카드 기반 월 급여 생성, 4대보험 자동 계산, 프리랜서 원천징수, 상여 세부내역을 관리합니다.',
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
        description: '기관·담당자 연락처를 통합 관리합니다. 리드 등록 시 자동으로 연동됩니다.',
      },
      {
        icon: '🏢',
        title: '거래처 DB',
        href: '/vendors',
        description: '협력사·광고주 등 거래처 정보를 관리하고 거래 원장을 확인합니다.',
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
        description: '팀 공지를 등록하고 확인합니다. 관리자가 작성한 공지를 전 팀원이 조회할 수 있습니다.',
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

export default function AboutPage() {
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
          AI 어시스턴트 빵빵이를 통해 말 한마디로 데이터를 조회·등록할 수 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs px-2.5 py-1 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-100">Next.js</span>
          <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100">Supabase</span>
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">Vercel 배포</span>
          <span className="text-xs px-2.5 py-1 bg-green-50 text-green-600 rounded-full border border-green-100">역할별 접근제어</span>
          <span className="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full border border-purple-100">AI 빵빵이</span>
        </div>
      </div>

      {/* 기능 목록 - 카테고리별 */}
      <div className="space-y-8">
        {FEATURE_GROUPS.map(group => (
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
                    {f.adminOnly && (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded font-medium ml-auto">관리자</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 권한 안내 */}
      <div className="mt-8 bg-gray-50 rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">권한 체계</p>
        <div className="space-y-2">
          {[
            { role: '관리자', color: 'bg-yellow-100 text-yellow-800', desc: '모든 기능 접근 가능. 인건비·고정비·자금일보·팀원 관리 포함.' },
            { role: '팀장', color: 'bg-blue-100 text-blue-700', desc: '매출 통계, 보고서, 미수금, 리드, 고객DB, 거래처, 지급 관리 접근 가능.' },
            { role: '팀원', color: 'bg-gray-100 text-gray-500', desc: '자신이 담당한 매출·리드만 조회 가능. 공지사항·근태·연차·경비는 본인 것만.' },
          ].map(r => (
            <div key={r.role} className="flex items-start gap-3">
              <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${r.color}`}>{r.role}</span>
              <p className="text-xs text-gray-500">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
