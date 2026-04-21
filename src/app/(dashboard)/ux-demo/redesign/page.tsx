'use client'
import { useState } from 'react'

const YELLOW = '#FFCE00'
const DARK = '#121212'

const ME = { name: '방준영', role: 'admin' }

const DEPT_MAP: Record<string, string> = {
  'SOS': 'SOS/행사',
  '행사운영': 'SOS/행사',
  '교육프로그램': '교육',
  '교구대여': '대여',
  '행사대여': '대여',
  '납품설치': '제작/납품',
  '콘텐츠제작': '제작/납품',
  '제작인쇄': '제작/납품',
  '유지보수': '제작/납품',
  '002ENT': '002ENT',
}

const DEPTS = ['전체', 'SOS/행사', '교육', '대여', '제작/납품', '002ENT']
const DEPT_ICONS: Record<string, string> = {
  '전체': '◈', 'SOS/행사': '🎵', '교육': '📚', '대여': '📦', '제작/납품': '🔧', '002ENT': '🎤',
}

const PROJECTS = [
  { id: '26-001', name: '이화여대 SOS 공연', client: '이화여자대학교', service: 'SOS', status: '진행중', assignee: '조민현', dday: 12, revenue: 2500000, stage: '착수' },
  { id: '26-002', name: '광교청소년수련관 납품설치', client: '광교청소년수련관', service: '납품설치', status: '계약', assignee: '유제민', dday: 28, revenue: 4800000, stage: '계약' },
  { id: '26-003', name: '경기도교육청 특수교육원 연수', client: '경기도교육청 특수교육원', service: '교육프로그램', status: '진행중', assignee: '방준영', dday: 5, revenue: 20000000, stage: '선금' },
  { id: '26-004', name: '서울중학교 교구대여', client: '서울중학교', service: '교구대여', status: '진행중', assignee: '조민현', dday: -2, revenue: 380000, stage: '완수' },
  { id: '26-005', name: '용인교육지원청 홍보영상', client: '용인교육지원청', service: '콘텐츠제작', status: '리드', assignee: '유제민', dday: null, revenue: null, stage: null },
  { id: '26-006', name: '강남구청 행사운영', client: '강남구청', service: '행사운영', status: '계약', assignee: '조민현', dday: 45, revenue: 8000000, stage: '계약' },
  { id: '26-007', name: '홍길동 아티스트 음원유통', client: '홍길동', service: '002ENT', status: '진행중', assignee: '정태영', dday: null, revenue: 1200000, stage: '중도금' },
  { id: '26-008', name: '인천해양고 방송장비 유지보수', client: '인천해양고등학교', service: '유지보수', status: '완료', assignee: '유제민', dday: null, revenue: 650000, stage: '잔금' },
]

const TASKS = [
  { id: 1, title: '계약서 초안 발송', project: '26-003', assignee: '방준영', due: '2026-04-22', status: '진행중', priority: '높음' },
  { id: 2, title: '음향장비 재고 확인', project: '26-001', assignee: '조민현', due: '2026-04-23', status: '할 일', priority: '보통' },
  { id: 3, title: '견적서 수정 발송', project: '26-002', assignee: '유제민', due: '2026-04-21', status: '할 일', priority: '높음' },
  { id: 4, title: '반납 검수 완료 처리', project: '26-004', assignee: '조민현', due: '2026-04-21', status: '할 일', priority: '높음' },
  { id: 5, title: '레퍼런스 영상 수집', project: '26-005', assignee: '유제민', due: '2026-04-25', status: '할 일', priority: '낮음' },
]

const CUSTOMERS = [
  { id: 1, name: '이화여자대학교', type: '학교', region: '서울', contacts: [{ name: '김담당', role: '교육팀장', phone: '010-1234-5678', email: 'kim@ewha.ac.kr' }], deals: 5 },
  { id: 2, name: '경기도교육청 특수교육원', type: '공공기관', region: '경기', contacts: [{ name: '이노현', role: '장학사', phone: '031-000-0000', email: 'lee@goe.go.kr' }, { name: '박팀장', role: '팀장', phone: '031-000-0001', email: 'park@goe.go.kr' }], deals: 3 },
  { id: 3, name: '광교청소년수련관', type: '공공기관', region: '경기', contacts: [{ name: '최운영', role: '운영팀', phone: '031-111-2222', email: 'choi@center.or.kr' }], deals: 2 },
  { id: 4, name: '강남구청', type: '공공기관', region: '서울', contacts: [{ name: '정문화', role: '문화과', phone: '02-3423-5678', email: 'jung@gangnam.go.kr' }], deals: 4 },
  { id: 5, name: '용인교육지원청', type: '공공기관', region: '경기', contacts: [{ name: '한장학', role: '장학사', phone: '031-222-3333', email: 'han@yongin.go.kr' }, { name: '오과장', role: '과장', phone: '031-222-3334', email: 'oh@yongin.go.kr' }], deals: 6 },
  { id: 6, name: '인천해양고등학교', type: '학교', region: '인천', contacts: [{ name: '신방송', role: '방송부장', phone: '032-444-5555', email: 'shin@school.kr' }], deals: 3 },
]

const CALENDAR_EVENTS = [
  { id: 1, title: '경기도교육청 연수 (26-003)', date: '2026-05-16', color: '#4CAF50', project: '26-003' },
  { id: 2, title: '이화여대 SOS 공연 (26-001)', date: '2026-05-03', color: '#2196F3', project: '26-001' },
  { id: 3, title: '강남구청 행사 (26-006)', date: '2026-06-05', color: '#FF9800', project: '26-006' },
  { id: 4, title: '서울중학교 반납일 (26-004)', date: '2026-04-23', color: '#F44336', project: '26-004' },
]

const RENTALS = [
  { id: 'R-001', project: '26-004', client: '서울중학교', items: '아이패드 20대', pickup: '2026-04-15', returnDate: '2026-04-23', dday: -2, status: '반납예정', assignee: '조민현' },
  { id: 'R-002', project: '26-009', client: '분당중학교', items: '아이패드 10대, 앱 포함', pickup: '2026-04-28', returnDate: '2026-05-05', dday: 7, status: '발송준비', assignee: '조민현' },
  { id: 'R-003', project: '26-010', client: '수원여고', items: 'VR기기 15대', pickup: '2026-05-10', returnDate: '2026-05-17', dday: 19, status: '예약확정', assignee: '유제민' },
  { id: 'R-004', project: '26-011', client: '안양예술고', items: '마이크세트 + 스피커', pickup: '2026-04-25', returnDate: '2026-04-27', dday: 4, status: '발송완료', assignee: '조민현' },
]
const RENTAL_STATUS_COLOR: Record<string, string> = { '예약확정': '#8B5CF6', '발송준비': '#F59E0B', '발송완료': '#2563EB', '반납예정': '#EF4444', '반납완료': '#059669' }
const RENTAL_STATUS_BG: Record<string, string> = { '예약확정': '#F5F3FF', '발송준비': '#FFFBEB', '발송완료': '#EFF6FF', '반납예정': '#FEF2F2', '반납완료': '#F0FDF4' }

const SOS_PROJECTS = [
  { id: '26-001', name: '이화여대 SOS 공연', client: '이화여자대학교', date: '2026-05-03', dday: 12, size: 800, venue: '이화여대 대강당', assignee: '조민현', stage: '섭외완료', checklist: { '아티스트 섭외': true, '계약서 수령': true, '기획서 작성': true, '음향장비 확인': false, '현장 리허설': false, '정산 완료': false } },
  { id: '26-012', name: '한국예술종합학교 공연', client: '한국예술종합학교', date: '2026-05-10', dday: 19, size: 500, venue: '예술극장', assignee: '조민현', stage: '계약협의', checklist: { '아티스트 섭외': true, '계약서 수령': false, '기획서 작성': false, '음향장비 확인': false, '현장 리허설': false, '정산 완료': false } },
  { id: '26-006', name: '강남구청 행사운영', client: '강남구청', date: '2026-06-05', dday: 45, size: 300, venue: '강남구민회관', assignee: '조민현', stage: '초기단계', checklist: { '아티스트 섭외': false, '계약서 수령': false, '기획서 작성': false, '음향장비 확인': false, '현장 리허설': false, '정산 완료': false } },
]

const EDU_PROGRAMS = [
  { id: '26-003', name: '경기도교육청 특수교육원 가족지원 연수', client: '경기도교육청 특수교육원', date: '2026-05-16', dday: 25, venue: 'YBM연수원 분당', count: 86, instructors: ['김강사', '이강사', '박강사'], status: '강사확정', budget: 20000000, checklist: { '강사 계약 완료': true, '커리큘럼 확정': true, '장소 예약': true, '교재 발송': false, '사전 설문': false, '수료증 준비': false } },
  { id: '26-013', name: '용인교육지원청 음악치료 연수', client: '용인교육지원청', date: '2026-07-10', dday: 80, venue: '미정', count: 40, instructors: ['최치료사'], status: '초기단계', budget: 22510000, checklist: { '강사 계약 완료': false, '커리큘럼 확정': false, '장소 예약': false, '교재 발송': false, '사전 설문': false, '수료증 준비': false } },
]

const INSTALL_PROJECTS = [
  { id: '26-002', name: '광교청소년수련관 납품설치', client: '광교청소년수련관', date: '2026-05-20', dday: 29, status: '설치준비', items: [{ name: '85인치 TV', qty: 3, status: '입고완료' }, { name: '사운드바', qty: 3, status: '발주중' }, { name: '브래킷', qty: 3, status: '입고완료' }, { name: 'HDMI 케이블', qty: 10, status: '입고완료' }], checklist: { '견적서 확정': true, '계약서 서명': true, '자재 발주': true, '자재 입고 완료': false, '설치 일정 확정': false, '설치 완료': false, 'A/S 점검': false } },
]

const CHANNELTALK_ALERTS = [
  { id: 1, from: '김교육 (이화여대)', content: '공연 날짜 확인 부탁드립니다', time: '10분 전', type: '문의', urgent: true },
  { id: 2, from: '이과장 (성남시청)', content: '견적서 검토 완료, 계약 진행 가능합니다', time: '1시간 전', type: '계약', urgent: true },
  { id: 3, from: '박선생 (분당중)', content: '아이패드 배송 언제 출발하나요?', time: '2시간 전', type: '문의', urgent: false },
  { id: 4, from: '채널톡 빵빵이', content: '한국예술종합학교 리드 신규 접수됨', time: '3시간 전', type: '알림', urgent: false },
]

const SERVICES_CATALOG = [
  { id: 'rental', name: '교구/장비 대여', icon: '📦', color: '#D97706', desc: '아이패드, VR, 음향 장비 대여 관리', count: RENTALS.length, alert: RENTALS.filter(r => r.dday <= 0).length },
  { id: 'sos', name: 'SOS 공연', icon: '🎵', color: '#7C3AED', desc: '공연 기획·아티스트·현장 운영 관리', count: SOS_PROJECTS.length, alert: SOS_PROJECTS.filter(s => s.dday <= 14).length },
  { id: 'edu', name: '교육프로그램', icon: '📚', color: '#059669', desc: '연수·교육 일정, 강사, 커리큘럼 관리', count: EDU_PROGRAMS.length, alert: EDU_PROGRAMS.filter(e => e.dday <= 30).length },
  { id: 'install', name: '납품설치', icon: '🔧', color: '#2563EB', desc: '납품·설치 일정, 자재, A/S 관리', count: INSTALL_PROJECTS.length, alert: 0 },
  { id: 'content', name: '콘텐츠제작', icon: '🎬', color: '#EC4899', desc: '영상·인쇄·디자인 제작 관리', count: 1, alert: 0 },
  { id: 'ent', name: '002ENT', icon: '🎤', color: '#EF4444', desc: '아티스트 음원유통 및 계약 관리', count: 1, alert: 0 },
]

const SERVICE_COLOR: Record<string, string> = {
  'SOS': '#7C3AED', '교육프로그램': '#059669', '납품설치': '#2563EB',
  '교구대여': '#D97706', '유지보수': '#6B7280', '콘텐츠제작': '#EC4899',
  '행사운영': '#F59E0B', '제작인쇄': '#10B981', '002ENT': '#EF4444', '행사대여': '#8B5CF6',
}
const STATUS_COLOR: Record<string, string> = { '리드': '#3B82F6', '계약': '#8B5CF6', '진행중': '#F59E0B', '완료': '#6B7280' }
const STATUS_BG: Record<string, string> = { '리드': '#EFF6FF', '계약': '#F5F3FF', '진행중': '#FFFBEB', '완료': '#F9FAFB' }

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ color, background: bg, fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{label}</span>
}
function DdayBadge({ dday }: { dday: number | null }) {
  if (dday === null) return null
  const color = dday < 0 ? '#EF4444' : dday <= 7 ? '#F97316' : dday <= 14 ? '#F59E0B' : '#9CA3AF'
  const bg = dday < 0 ? '#FEF2F2' : dday <= 7 ? '#FFF7ED' : dday <= 14 ? '#FFFBEB' : '#F9FAFB'
  return <span style={{ color, background: bg, fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{dday < 0 ? `D+${Math.abs(dday)}` : dday === 0 ? 'D-DAY' : `D-${dday}`}</span>
}

const LEADS = [
  {
    id: 'L-001', name: '한국예술종합학교 SOS 공연', client: '한국예술종합학교', service: 'SOS',
    source: '채널톡', assignee: '조민현', date: '2026-04-20', status: '검토중', dday: 3,
    contact: '김담당 (교육팀)', phone: '010-1111-2222', email: 'kim@karts.ac.kr',
    eventDate: '2026-05-10', budget: '300만 내외', note: '5월 중 공연 희망, 재학생 대상',
    comms: [
      { date: '2026-04-20', author: '조민현', content: '채널톡 문의 접수. 5월 공연 가능 여부 확인 요청함.', channel: '채널톡' },
      { date: '2026-04-21', author: '조민현', content: '유선 상담 완료. 예산 300만, 재학생 500명 대상.', channel: '전화' },
    ]
  },
  {
    id: 'L-002', name: '성남시청 행사 운영', client: '성남시청', service: '행사운영',
    source: '이메일', assignee: '유제민', date: '2026-04-18', status: '견적발송', dday: 7,
    contact: '이과장 (문화과)', phone: '031-729-0000', email: 'lee@seongnam.go.kr',
    eventDate: '2026-05-25', budget: '800만', note: '야외 행사, 무대 + 음향 + 진행',
    comms: [
      { date: '2026-04-18', author: '유제민', content: '이메일 문의 접수. 5월 25일 야외 행사 운영 의뢰.', channel: '이메일' },
      { date: '2026-04-19', author: '유제민', content: '견적서 800만원 발송 완료.', channel: '이메일' },
      { date: '2026-04-21', author: '유제민', content: '검토 중이라 함. 이번 주 내 회신 예정.', channel: '전화' },
    ]
  },
  {
    id: 'L-003', name: '용인교육지원청 홍보영상', client: '용인교육지원청', service: '콘텐츠제작',
    source: '소개', assignee: '유제민', date: '2026-04-15', status: '미응답', dday: -3,
    contact: '한장학 (장학사)', phone: '031-000-1111', email: 'han@yongin.go.kr',
    eventDate: null, budget: '미정', note: '3월 소개로 연결. 유선 2회 미응답 상태.',
    comms: [
      { date: '2026-04-15', author: '유제민', content: '소개로 연락처 받음. 문자 발송.', channel: '문자' },
      { date: '2026-04-17', author: '유제민', content: '전화 미응답.', channel: '전화' },
      { date: '2026-04-20', author: '유제민', content: '재전화 미응답. 문자 재발송.', channel: '전화' },
    ]
  },
  {
    id: 'L-004', name: '분당중학교 교구대여', client: '분당중학교', service: '교구대여',
    source: '채널톡', assignee: '조민현', date: '2026-04-21', status: '상담중', dday: 1,
    contact: '박선생 (과학부)', phone: '010-3333-4444', email: 'park@bundang.ms.kr',
    eventDate: '2026-04-28', budget: '30만 내외', note: '아이패드 10대 + 앱 포함 1주 대여',
    comms: [
      { date: '2026-04-21', author: '조민현', content: '채널톡 문의. 아이패드 10대 1주 대여 가능 여부 확인 요청.', channel: '채널톡' },
    ]
  },
  {
    id: 'L-005', name: '경기아트센터 음향설치', client: '경기아트센터', service: '납품설치',
    source: '재거래', assignee: '방준영', date: '2026-04-19', status: '검토중', dday: 10,
    contact: '최운영 (운영팀장)', phone: '031-555-6666', email: 'choi@gart.or.kr',
    eventDate: null, budget: '1,500만 예상', note: '2023년 거래처. 리뉴얼 공사 후 음향 재설치 검토 중.',
    comms: [
      { date: '2026-04-19', author: '방준영', content: '재거래 의뢰 전화 접수. 현장 방문 일정 조율 중.', channel: '전화' },
    ]
  },
]

const LEAD_STATUS_COLOR: Record<string, string> = { '상담중': '#2563EB', '검토중': '#F59E0B', '견적발송': '#7C3AED', '미응답': '#EF4444', '계약전환': '#059669' }
const LEAD_STATUS_BG: Record<string, string> = { '상담중': '#EFF6FF', '검토중': '#FFFBEB', '견적발송': '#F5F3FF', '미응답': '#FEF2F2', '계약전환': '#F0FDF4' }

export default function RedesignDemo() {
  const [page, setPage] = useState('home')
  const [selectedProject, setSelectedProject] = useState<typeof PROJECTS[0] | null>(null)
  const [selectedLead, setSelectedLead] = useState<typeof LEADS[0] | null>(LEADS[3])
  const [selectedCustomer, setSelectedCustomer] = useState<typeof CUSTOMERS[0] | null>(null)
  const [selectedRental, setSelectedRental] = useState<typeof RENTALS[0] | null>(null)
  const [selectedSos, setSelectedSos] = useState<typeof SOS_PROJECTS[0] | null>(SOS_PROJECTS[0])
  const [selectedEdu, setSelectedEdu] = useState<typeof EDU_PROGRAMS[0] | null>(EDU_PROGRAMS[0])
  const [selectedInstall, setSelectedInstall] = useState<typeof INSTALL_PROJECTS[0] | null>(INSTALL_PROJECTS[0])
  const [servicePage, setServicePage] = useState<string | null>(null)
  const [projectTab, setProjectTab] = useState('overview')
  const [deptFilter, setDeptFilter] = useState('전체')
  const [filterStatus, setFilterStatus] = useState('전체')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [claudeInput, setClaudeInput] = useState('')
  const [claudeMessages, setClaudeMessages] = useState([{ role: 'assistant', text: '안녕. 프로젝트 맥락이 자동 주입됐어. 뭐 도와줄까?' }])
  const [memo, setMemo] = useState('- 경기도교육청 연수 계약서 확인 필요\n- 이화여대 공연 아티스트 섭외 3팀 컨펌 대기\n- 5월 견적 마감 전 재무팀 공유')

  const nav = [
    { id: 'home', icon: '⌂', label: '홈' },
    { id: 'leads', icon: '◎', label: '리드' },
    { id: 'projects', icon: '◈', label: '프로젝트' },
    { id: 'services', icon: '⬡', label: '서비스' },
    { id: 'customers', icon: '♟', label: '고객' },
    { id: 'calendar', icon: '◷', label: '캘린더' },
    { id: 'finance', icon: '▤', label: '재무' },
    { id: 'team', icon: '◉', label: '팀' },
  ]

  const sendClaude = () => {
    if (!claudeInput.trim()) return
    const userMsg = claudeInput
    setClaudeInput('')
    setClaudeMessages(prev => [...prev, { role: 'user', text: userMsg }, { role: 'assistant', text: `"${userMsg}"에 대해 분석할게요. 현재 프로젝트 상태와 소통 내역을 기반으로 답변 중...` }])
  }

  const filtered = PROJECTS.filter(p => {
    const deptMatch = deptFilter === '전체' || DEPT_MAP[p.service] === deptFilter
    const statusMatch = filterStatus === '전체' || p.status === filterStatus
    return deptMatch && statusMatch
  })

  const openProject = (p: typeof PROJECTS[0]) => {
    setSelectedProject(p)
    setProjectTab('overview')
    setPage('project-detail')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F4F5F7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 14, color: DARK }}>

      {/* Sidebar */}
      <div style={{ width: sidebarOpen ? 220 : 60, background: DARK, display: 'flex', flexDirection: 'column', transition: 'width 0.2s', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: YELLOW, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: DARK, flexShrink: 0 }}>Y</div>
          {sidebarOpen && <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>유어메이트</span>}
        </div>
        <nav style={{ flex: 1, padding: '8px 8px' }}>
          {nav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: page === n.id || (page === 'project-detail' && n.id === 'projects') || (page === 'services' && n.id === 'services') ? 'rgba(255,206,0,0.15)' : 'transparent', color: page === n.id || (page === 'project-detail' && n.id === 'projects') || (page === 'services' && n.id === 'services') ? YELLOW : '#9CA3AF', fontWeight: page === n.id ? 600 : 400, fontSize: 14, marginBottom: 2, textAlign: 'left' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{n.icon}</span>
              {sidebarOpen && <span>{n.label}</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {sidebarOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: YELLOW, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: DARK }}>{ME.name[0]}</div>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{ME.name}</div>
                <div style={{ color: '#6B7280', fontSize: 11 }}>대표</div>
              </div>
            </div>
          ) : (
            <div style={{ width: 32, height: 32, background: YELLOW, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: DARK }}>{ME.name[0]}</div>
          )}
        </div>
        <button onClick={() => setSidebarOpen(o => !o)} style={{ padding: '8px', background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 16 }}>
          {sidebarOpen ? '←' : '→'}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* HOME */}
        {page === 'home' && (
          <div style={{ padding: 28, maxWidth: 1100, width: '100%' }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>좋은 아침이에요, {ME.name} 대표님 👋</h1>
              <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: 13 }}>2026년 4월 21일 월요일</p>
            </div>

            {/* 요약 카드 4개 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: '이번 달 매출', value: '3,780만', sub: '목표 5,000만', color: '#059669' },
                { label: '진행중인 건', value: '5건', sub: '내 담당 3건', color: '#2563EB' },
                { label: '오늘 할 일', value: '4개', sub: '기한 초과 2개', color: '#EF4444' },
                { label: '미수금', value: '2,088만', sub: '3건 미정산', color: '#F59E0B' },
              ].map(c => (
                <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                  <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              {/* 리마인드 임박 */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>🔔 리마인드 임박</h3>
                {PROJECTS.filter(p => p.dday !== null && p.dday <= 14).sort((a, b) => (a.dday ?? 99) - (b.dday ?? 99)).map(p => (
                  <div key={p.id} onClick={() => openProject(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}>
                    <DdayBadge dday={p.dday} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      <div style={{ color: '#9CA3AF', fontSize: 11 }}>{p.id} · {p.assignee}</div>
                    </div>
                    <Badge label={p.service} color={SERVICE_COLOR[p.service] || '#6B7280'} bg={`${SERVICE_COLOR[p.service]}18`} />
                  </div>
                ))}
              </div>

              {/* 오늘 할 일 */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>✅ 오늘 할 일</h3>
                {TASKS.filter(t => t.status !== '완료').map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <input type="checkbox" style={{ marginTop: 2, accentColor: YELLOW }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                      <div style={{ color: '#9CA3AF', fontSize: 11 }}>{t.project} · {t.due} · {t.assignee}</div>
                    </div>
                    <span style={{ fontSize: 11, color: t.priority === '높음' ? '#EF4444' : '#9CA3AF', fontWeight: 600 }}>{t.priority}</span>
                  </div>
                ))}
              </div>

              {/* 진행중인 프로젝트 */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>◈ 진행중인 내 프로젝트</h3>
                {PROJECTS.filter(p => p.status === '진행중').map(p => (
                  <div key={p.id} onClick={() => openProject(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}>
                    <div style={{ width: 4, height: 36, background: SERVICE_COLOR[p.service] || '#E5E7EB', borderRadius: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      <div style={{ color: '#9CA3AF', fontSize: 11 }}>{p.id} · {p.client}</div>
                    </div>
                    <DdayBadge dday={p.dday} />
                  </div>
                ))}
              </div>

              {/* 다가오는 일정 */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>◷ 다가오는 일정</h3>
                {CALENDAR_EVENTS.sort((a, b) => a.date.localeCompare(b.date)).map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{e.title}</div>
                      <div style={{ color: '#9CA3AF', fontSize: 11 }}>{e.date}</div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>📅 구글 캘린더 연동됨</span>
                </div>
              </div>
            </div>

            {/* 채널톡 알림 + 메모 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>💬 채널톡 알림</h3>
                  <span style={{ background: '#EF4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>2</span>
                </div>
                {CHANNELTALK_ALERTS.map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.urgent ? '#EF4444' : '#D1D5DB', marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{a.from}</div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>{a.content}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{a.time}</div>
                  </div>
                ))}
                <button style={{ width: '100%', marginTop: 10, padding: '8px', background: '#F9FAFB', border: 'none', borderRadius: 8, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>채널톡 열기 →</button>
              </div>

              <div style={{ background: '#FEFCE8', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #FEF08A' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#854D0E' }}>📝 메모</h3>
                  <span style={{ fontSize: 11, color: '#A16207', marginLeft: 'auto' }}>나만 보임</span>
                </div>
                <textarea value={memo} onChange={e => setMemo(e.target.value)}
                  style={{ width: '100%', minHeight: 100, border: 'none', background: 'transparent', resize: 'none', fontSize: 13, color: '#374151', outline: 'none', lineHeight: 1.7, fontFamily: 'inherit', boxSizing: 'border-box' }}
                  placeholder="메모를 입력하세요..." />
              </div>
            </div>

          </div>
        )}

        {/* LEADS — 좌측 목록 + 우측 상세 패널 */}
        {page === 'leads' && (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

            {/* 좌측: 리드 목록 (D-day 순) */}
            <div style={{ width: 340, borderRight: '1px solid #E5E7EB', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>리드 관리</h2>
                  <button style={{ background: YELLOW, color: DARK, border: 'none', borderRadius: 7, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ 등록</button>
                </div>
                <input placeholder="검색..." style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* 상태 필터 */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', gap: 4, overflowX: 'auto' }}>
                {['전체', '상담중', '견적발송', '검토중', '미응답'].map(s => (
                  <button key={s}
                    style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${LEAD_STATUS_COLOR[s] || '#E5E7EB'}`, background: '#fff', color: LEAD_STATUS_COLOR[s] || '#6B7280', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {s}
                  </button>
                ))}
              </div>

              {/* D-day 순 목록 */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {[...LEADS].sort((a, b) => a.dday - b.dday).map(l => (
                  <div key={l.id} onClick={() => setSelectedLead(l)}
                    style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: selectedLead?.id === l.id ? `${YELLOW}18` : 'transparent', borderLeft: selectedLead?.id === l.id ? `3px solid ${YELLOW}` : '3px solid transparent' }}
                    onMouseEnter={e => { if (selectedLead?.id !== l.id) e.currentTarget.style.background = '#F9FAFB' }}
                    onMouseLeave={e => { if (selectedLead?.id !== l.id) e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <DdayBadge dday={l.dday} />
                      <Badge label={l.status} color={LEAD_STATUS_COLOR[l.status]} bg={LEAD_STATUS_BG[l.status]} />
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>{l.assignee}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{l.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{l.client}</span>
                      <Badge label={l.service} color={SERVICE_COLOR[l.service] || '#6B7280'} bg={`${SERVICE_COLOR[l.service]}18`} />
                      <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>유입: {l.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 우측: 상세 패널 */}
            {selectedLead ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                {/* 상세 헤더 */}
                <div style={{ background: '#fff', borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <DdayBadge dday={selectedLead.dday} />
                        <Badge label={selectedLead.status} color={LEAD_STATUS_COLOR[selectedLead.status]} bg={LEAD_STATUS_BG[selectedLead.status]} />
                        <Badge label={selectedLead.service} color={SERVICE_COLOR[selectedLead.service] || '#6B7280'} bg={`${SERVICE_COLOR[selectedLead.service]}18`} />
                      </div>
                      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>{selectedLead.name}</h2>
                      <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', gap: 14 }}>
                        <span>🏢 {selectedLead.client}</span>
                        <span>👤 {selectedLead.assignee}</span>
                        <span>유입: {selectedLead.source}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, cursor: 'pointer' }}>
                        {['상담중', '견적발송', '검토중', '미응답'].map(s => (
                          <option key={s} selected={selectedLead.status === s}>{s}</option>
                        ))}
                      </select>
                      <button style={{ background: YELLOW, border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>계약 전환 →</button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {/* 고객/담당자 */}
                  <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>담당자 정보</h3>
                    {[['이름', selectedLead.contact], ['전화', selectedLead.phone], ['이메일', selectedLead.email]].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                        <span style={{ color: '#9CA3AF', width: 40, flexShrink: 0 }}>{k}</span>
                        <span style={{ fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* 프로젝트 정보 */}
                  <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>프로젝트 정보</h3>
                    {[['일정', selectedLead.eventDate || '미정'], ['예산', selectedLead.budget], ['등록일', selectedLead.date]].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                        <span style={{ color: '#9CA3AF', width: 40, flexShrink: 0 }}>{k}</span>
                        <span style={{ fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 10, padding: 10, background: '#F9FAFB', borderRadius: 8, fontSize: 12, color: '#374151' }}>
                      📝 {selectedLead.note}
                    </div>
                  </div>
                </div>

                {/* 소통 내역 */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700 }}>소통 내역</h3>
                  {selectedLead.comms.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 28, height: 28, background: YELLOW, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.author[0]}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{c.author}</span>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.date}</span>
                          <span style={{ fontSize: 11, padding: '1px 6px', background: '#F3F4F6', borderRadius: 10, color: '#6B7280' }}>{c.channel}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#374151', background: '#F9FAFB', padding: '8px 12px', borderRadius: 8 }}>{c.content}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input placeholder="소통 내용 입력..." style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none' }} />
                    <button style={{ background: YELLOW, border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>저장</button>
                  </div>
                </div>

                {/* Claude 협업 */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 24, height: 24, background: DARK, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: YELLOW, fontSize: 11 }}>✦</div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Claude 협업</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>리드 맥락 자동 주입됨</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input placeholder="이 리드에 대해 물어보세요..." style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none' }} />
                    <button style={{ background: DARK, color: YELLOW, border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>전송</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14 }}>
                리드를 선택하세요
              </div>
            )}
          </div>
        )}

        {/* SERVICES HUB */}
        {page === 'services' && !servicePage && (
          <div style={{ padding: 28 }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>서비스 관리</h1>
              <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: 13 }}>서비스별 전용 트래킹 보드 — 각 서비스마다 특화된 관리 도구</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {SERVICES_CATALOG.map(s => (
                <div key={s.id} onClick={() => setServicePage(s.id)}
                  style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', borderTop: `4px solid ${s.color}`, position: 'relative' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}>
                  {s.alert > 0 && (
                    <div style={{ position: 'absolute', top: 14, right: 14, background: '#EF4444', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{s.alert}</div>
                  )}
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{s.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>{s.desc}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: s.color, fontWeight: 700 }}>진행중 {s.count}건</span>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RENTAL BOARD */}
        {page === 'services' && servicePage === 'rental' && (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            <div style={{ width: 340, borderRight: '1px solid #E5E7EB', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F3F4F6' }}>
                <button onClick={() => setServicePage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 12, padding: 0, marginBottom: 10 }}>← 서비스 목록</button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>📦</span>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>교구/장비 대여</h2>
                  </div>
                  <button style={{ background: YELLOW, color: DARK, border: 'none', borderRadius: 7, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ 등록</button>
                </div>
              </div>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', gap: 4 }}>
                {['전체', '발송준비', '발송완료', '반납예정', '반납완료'].map(s => (
                  <button key={s} style={{ padding: '3px 8px', borderRadius: 12, border: `1px solid ${RENTAL_STATUS_COLOR[s] || '#E5E7EB'}`, background: '#fff', color: RENTAL_STATUS_COLOR[s] || '#6B7280', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>{s}</button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {[...RENTALS].sort((a, b) => a.dday - b.dday).map(r => (
                  <div key={r.id} onClick={() => setSelectedRental(r)}
                    style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: selectedRental?.id === r.id ? `${YELLOW}18` : 'transparent', borderLeft: selectedRental?.id === r.id ? `3px solid ${YELLOW}` : '3px solid transparent' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <DdayBadge dday={r.dday} />
                      <Badge label={r.status} color={RENTAL_STATUS_COLOR[r.status]} bg={RENTAL_STATUS_BG[r.status]} />
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>{r.assignee}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{r.client}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{r.items}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>반납 {r.returnDate}</div>
                  </div>
                ))}
              </div>
            </div>
            {selectedRental ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <DdayBadge dday={selectedRental.dday} />
                        <Badge label={selectedRental.status} color={RENTAL_STATUS_COLOR[selectedRental.status]} bg={RENTAL_STATUS_BG[selectedRental.status]} />
                      </div>
                      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{selectedRental.client}</h2>
                      <div style={{ fontSize: 13, color: '#6B7280' }}>{selectedRental.project} · 담당 {selectedRental.assignee}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ padding: '7px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer' }}>📁 드롭박스</button>
                      <button style={{ background: YELLOW, border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>반납 확인</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['대여 품목', selectedRental.items], ['수령일', selectedRental.pickup], ['반납일', selectedRental.returnDate], ['반납 방법', '택배 착불']].map(([k, v]) => (
                      <div key={k}><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{k}</div><div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div></div>
                    ))}
                  </div>
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700 }}>반납 체크리스트</h3>
                  {['수량 확인', '파손 여부 확인', '충전 상태 확인', '악세서리 확인', '반납 처리 완료'].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F3F4F6' }}>
                      <input type="checkbox" defaultChecked={i < 2} style={{ accentColor: YELLOW }} />
                      <span style={{ fontSize: 13 }}>{item}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 22, height: 22, background: DARK, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: YELLOW, fontSize: 10 }}>✦</div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Claude 협업</span>
                  </div>
                  <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 13, color: '#374151' }}>
                    {selectedRental.client} 대여건 확인했어. 반납일 {selectedRental.returnDate}, 현재 {selectedRental.status} 상태. 뭐 도와줄까?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input placeholder="이 대여건에 대해 물어보세요..." style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none' }} />
                    <button style={{ background: DARK, color: YELLOW, border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>전송</button>
                  </div>
                </div>
              </div>
            ) : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>대여건을 선택하세요</div>}
          </div>
        )}

        {/* SOS BOARD */}
        {page === 'services' && servicePage === 'sos' && (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            <div style={{ width: 300, borderRight: '1px solid #E5E7EB', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F3F4F6' }}>
                <button onClick={() => setServicePage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 12, padding: 0, marginBottom: 10 }}>← 서비스 목록</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🎵</span>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>SOS 공연</h2>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {[...SOS_PROJECTS].sort((a, b) => a.dday - b.dday).map(s => (
                  <div key={s.id} onClick={() => setSelectedSos(s)}
                    style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: selectedSos?.id === s.id ? `${YELLOW}18` : 'transparent', borderLeft: selectedSos?.id === s.id ? `3px solid ${YELLOW}` : '3px solid transparent' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <DdayBadge dday={s.dday} />
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F5F3FF', color: '#7C3AED', fontWeight: 600 }}>{s.stage}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{s.date} · {s.size}명 · {s.venue}</div>
                  </div>
                ))}
              </div>
            </div>
            {selectedSos ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <DdayBadge dday={selectedSos.dday} />
                        <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: '#F5F3FF', color: '#7C3AED', fontWeight: 600 }}>{selectedSos.stage}</span>
                      </div>
                      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>{selectedSos.name}</h2>
                      <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', gap: 14 }}>
                        <span>📅 {selectedSos.date}</span>
                        <span>👥 {selectedSos.size}명</span>
                        <span>📍 {selectedSos.venue}</span>
                        <span>👤 {selectedSos.assignee}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ padding: '7px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer' }}>📁 드롭박스</button>
                      <button style={{ padding: '7px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer' }}>📅 캘린더</button>
                    </div>
                  </div>
                  {/* 진행 단계 */}
                  <div style={{ display: 'flex', gap: 0, marginTop: 16 }}>
                    {['섭외단계', '계약협의', '섭외완료', '리허설', '공연완료'].map((st, i, arr) => {
                      const idx = arr.indexOf(selectedSos.stage)
                      const done = i <= (idx === -1 ? 0 : idx)
                      return (
                        <div key={st} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : 'none' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? '#7C3AED' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: done ? '#fff' : '#9CA3AF' }}>{done ? '✓' : i + 1}</div>
                            <span style={{ fontSize: 10, color: done ? '#7C3AED' : '#9CA3AF', fontWeight: done ? 700 : 400, whiteSpace: 'nowrap' }}>{st}</span>
                          </div>
                          {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: i < (idx === -1 ? 0 : idx) ? '#7C3AED' : '#E5E7EB', margin: '0 4px', marginBottom: 16 }} />}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700 }}>공연 준비 체크리스트</h3>
                  {Object.entries(selectedSos.checklist).map(([item, done]) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F3F4F6' }}>
                      <input type="checkbox" defaultChecked={done} style={{ accentColor: '#7C3AED' }} />
                      <span style={{ fontSize: 13, textDecoration: done ? 'line-through' : 'none', color: done ? '#9CA3AF' : '#374151' }}>{item}</span>
                      {!done && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#EF4444', fontWeight: 600 }}>미완료</span>}
                    </div>
                  ))}
                </div>

                <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 22, height: 22, background: DARK, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: YELLOW, fontSize: 10 }}>✦</div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Claude 협업</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>공연 맥락 자동 주입됨</span>
                  </div>
                  <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 13, color: '#374151' }}>
                    {selectedSos.name} 공연이야. D-{selectedSos.dday}, {selectedSos.stage} 단계. 체크리스트 {Object.values(selectedSos.checklist).filter(Boolean).length}/{Object.values(selectedSos.checklist).length} 완료. 뭐 도와줄까?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input placeholder="공연 준비에 대해 물어보세요..." style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none' }} />
                    <button style={{ background: DARK, color: YELLOW, border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>전송</button>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    {['아티스트 컨펌 이메일 써줘', '공연 기획서 초안 작성', '체크리스트 요약'].map(q => (
                      <button key={q} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: '#6B7280' }}>{q}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>공연을 선택하세요</div>}
          </div>
        )}

        {/* EDU BOARD */}
        {page === 'services' && servicePage === 'edu' && (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            <div style={{ width: 300, borderRight: '1px solid #E5E7EB', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F3F4F6' }}>
                <button onClick={() => setServicePage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 12, padding: 0, marginBottom: 10 }}>← 서비스 목록</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📚</span>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>교육프로그램</h2>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {[...EDU_PROGRAMS].sort((a, b) => a.dday - b.dday).map(e => (
                  <div key={e.id} onClick={() => setSelectedEdu(e)}
                    style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: selectedEdu?.id === e.id ? `${YELLOW}18` : 'transparent', borderLeft: selectedEdu?.id === e.id ? `3px solid ${YELLOW}` : '3px solid transparent' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <DdayBadge dday={e.dday} />
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F0FDF4', color: '#059669', fontWeight: 600 }}>{e.status}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{e.name}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{e.date} · {e.count}명 · {e.venue}</div>
                  </div>
                ))}
              </div>
            </div>
            {selectedEdu && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}><DdayBadge dday={selectedEdu.dday} /><Badge label={selectedEdu.status} color="#059669" bg="#F0FDF4" /></div>
                      <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>{selectedEdu.name}</h2>
                      <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', gap: 14 }}>
                        <span>📅 {selectedEdu.date}</span><span>👥 {selectedEdu.count}명</span><span>📍 {selectedEdu.venue}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ padding: '7px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer' }}>📁 드롭박스</button>
                      <button style={{ padding: '7px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer' }}>📅 캘린더</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['예산', (selectedEdu.budget / 10000) + '만원'], ['강사 수', selectedEdu.instructors.length + '명'], ['수강인원', selectedEdu.count + '명']].map(([k, v]) => (
                      <div key={k}><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{k}</div><div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div></div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>강사 배치</h3>
                    {selectedEdu.instructors.map((inst, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ width: 28, height: 28, background: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#059669' }}>{inst[0]}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{inst}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>계약 완료</div>
                        </div>
                        <Badge label="확정" color="#059669" bg="#F0FDF4" />
                      </div>
                    ))}
                    <button style={{ width: '100%', marginTop: 10, padding: '7px', background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 8, fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }}>+ 강사 추가</button>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>준비 체크리스트</h3>
                    {Object.entries(selectedEdu.checklist).map(([item, done]) => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <input type="checkbox" defaultChecked={done} style={{ accentColor: '#059669' }} />
                        <span style={{ fontSize: 13, textDecoration: done ? 'line-through' : 'none', color: done ? '#9CA3AF' : '#374151' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 22, height: 22, background: DARK, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: YELLOW, fontSize: 10 }}>✦</div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Claude 협업</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input placeholder="교육 준비에 대해 물어보세요..." style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none' }} />
                    <button style={{ background: DARK, color: YELLOW, border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>전송</button>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['강사 계약서 초안 작성', '공문 발송 문구 써줘', '수강생 안내문 작성'].map(q => (
                      <button key={q} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: `1px solid ${YELLOW}`, background: `${YELLOW}20`, cursor: 'pointer', color: DARK, fontWeight: 600 }}>{q}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* INSTALL BOARD */}
        {page === 'services' && servicePage === 'install' && (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            <div style={{ width: 300, borderRight: '1px solid #E5E7EB', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F3F4F6' }}>
                <button onClick={() => setServicePage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 12, padding: 0, marginBottom: 10 }}>← 서비스 목록</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🔧</span>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>납품설치</h2>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {INSTALL_PROJECTS.map(p => (
                  <div key={p.id} onClick={() => setSelectedInstall(p)}
                    style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: selectedInstall?.id === p.id ? `${YELLOW}18` : 'transparent', borderLeft: selectedInstall?.id === p.id ? `3px solid ${YELLOW}` : '3px solid transparent' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}><DdayBadge dday={p.dday} /><Badge label={p.status} color="#2563EB" bg="#EFF6FF" /></div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{p.date} · {p.client}</div>
                  </div>
                ))}
              </div>
            </div>
            {selectedInstall && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}><DdayBadge dday={selectedInstall.dday} /><Badge label={selectedInstall.status} color="#2563EB" bg="#EFF6FF" /></div>
                      <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>{selectedInstall.name}</h2>
                      <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', gap: 14 }}>
                        <span>📅 설치일 {selectedInstall.date}</span><span>🏢 {selectedInstall.client}</span>
                      </div>
                    </div>
                    <button style={{ padding: '7px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer' }}>📁 드롭박스</button>
                  </div>
                  <div style={{ display: 'flex', gap: 0, marginTop: 16 }}>
                    {['견적확정', '계약완료', '자재발주', '자재입고', '설치완료', 'A/S점검'].map((st, i, arr) => {
                      const done = i <= 2
                      return (
                        <div key={st} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : 'none' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? '#2563EB' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: done ? '#fff' : '#9CA3AF' }}>{done ? '✓' : i + 1}</div>
                            <span style={{ fontSize: 10, color: done ? '#2563EB' : '#9CA3AF', fontWeight: done ? 700 : 400, whiteSpace: 'nowrap' }}>{st}</span>
                          </div>
                          {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: done ? '#2563EB' : '#E5E7EB', margin: '0 4px', marginBottom: 16 }} />}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>자재 현황</h3>
                    {selectedInstall.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>수량 {item.qty}개</div>
                        </div>
                        <Badge label={item.status} color={item.status === '입고완료' ? '#059669' : '#F59E0B'} bg={item.status === '입고완료' ? '#F0FDF4' : '#FFFBEB'} />
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>설치 체크리스트</h3>
                    {Object.entries(selectedInstall.checklist).map(([item, done]) => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <input type="checkbox" defaultChecked={done} style={{ accentColor: '#2563EB' }} />
                        <span style={{ fontSize: 13, textDecoration: done ? 'line-through' : 'none', color: done ? '#9CA3AF' : '#374151' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OTHER SERVICE BOARDS (content, ent) */}
        {page === 'services' && servicePage && !['rental', 'sos', 'edu', 'install'].includes(servicePage) && (
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <button onClick={() => setServicePage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 13, marginBottom: 24 }}>← 서비스 목록</button>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{SERVICES_CATALOG.find(s => s.id === servicePage)?.icon}</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{SERVICES_CATALOG.find(s => s.id === servicePage)?.name} 관리판</h2>
            <p style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>서비스 특성에 맞는 전용 트래킹 보드가 구현됩니다.<br />렌탈/SOS/교육/납품 보드를 참고해 확장 설계 예정.</p>
          </div>
        )}

        {/* PROJECTS — flat list */}
        {page === 'projects' && (
          <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>프로젝트</h1>
                <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: 13 }}>
                  총 {PROJECTS.length}건 · 진행중 {PROJECTS.filter(p => p.status === '진행중').length}건
                </p>
              </div>
              <button style={{ background: YELLOW, color: DARK, border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ 새 프로젝트</button>
            </div>

            {/* 검색 + 상태 필터만 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <input placeholder="프로젝트명, 고객, 번호, 서비스 검색..." style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, width: 300, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {['전체', '계약', '진행중', '완료'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    style={{ padding: '7px 16px', borderRadius: 20, border: `1px solid ${filterStatus === s ? YELLOW : '#E5E7EB'}`, background: filterStatus === s ? YELLOW : '#fff', fontWeight: filterStatus === s ? 700 : 400, fontSize: 12, cursor: 'pointer', color: DARK }}>
                    {s}
                    {s !== '전체' && <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>{PROJECTS.filter(p => p.status === s).length}</span>}
                  </button>
                ))}
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' }}>D-day 임박순</span>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
                    {['번호', '프로젝트명', '고객', '서비스', '상태', '단계', '담당자', 'D-day', '매출'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...PROJECTS]
                    .filter(p => filterStatus === '전체' || p.status === filterStatus)
                    .sort((a, b) => {
                      // D-day 있는 것 먼저, 없으면 뒤로
                      if (a.dday === null && b.dday === null) return 0
                      if (a.dday === null) return 1
                      if (b.dday === null) return -1
                      return a.dday - b.dday
                    })
                    .map(p => (
                    <tr key={p.id} onClick={() => openProject(p)}
                      style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '13px 16px', fontWeight: 700, color: '#9CA3AF', fontSize: 12 }}>{p.id}</td>
                      <td style={{ padding: '13px 16px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 3, height: 22, background: SERVICE_COLOR[p.service] || '#E5E7EB', borderRadius: 2, flexShrink: 0 }} />
                          {p.name}
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px', color: '#6B7280', fontSize: 13 }}>{p.client}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <Badge label={p.service} color={SERVICE_COLOR[p.service] || '#6B7280'} bg={`${SERVICE_COLOR[p.service]}18`} />
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <Badge label={p.status} color={STATUS_COLOR[p.status]} bg={STATUS_BG[p.status]} />
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 12, color: '#6B7280' }}>{p.stage || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13 }}>{p.assignee}</td>
                      <td style={{ padding: '13px 16px' }}><DdayBadge dday={p.dday} /></td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: p.revenue ? '#374151' : '#D1D5DB' }}>
                        {p.revenue ? (p.revenue / 10000).toFixed(0) + '만' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PROJECT DETAIL */}
        {page === 'project-detail' && selectedProject && (
          <div style={{ padding: 28 }}>
            <button onClick={() => setPage('projects')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13, padding: 0, marginBottom: 16 }}>
              ← 프로젝트 목록
            </button>

            {/* Header */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', background: '#F3F4F6', padding: '3px 10px', borderRadius: 6 }}>{selectedProject.id}</span>
                    <Badge label={selectedProject.service} color={SERVICE_COLOR[selectedProject.service] || '#6B7280'} bg={`${SERVICE_COLOR[selectedProject.service]}18`} />
                    <Badge label={selectedProject.status} color={STATUS_COLOR[selectedProject.status]} bg={STATUS_BG[selectedProject.status]} />
                    {selectedProject.dday !== null && <DdayBadge dday={selectedProject.dday} />}
                  </div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>{selectedProject.name}</h1>
                  <div style={{ color: '#6B7280', fontSize: 13, display: 'flex', gap: 16 }}>
                    <span>👤 {selectedProject.assignee}</span>
                    <span>🏢 {selectedProject.client}</span>
                    {selectedProject.revenue && <span style={{ fontWeight: 700, color: '#059669' }}>￦ {selectedProject.revenue.toLocaleString()}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer' }}>📁 드롭박스</button>
                  <button style={{ padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer' }}>📅 캘린더</button>
                  <button style={{ padding: '8px 14px', background: YELLOW, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>계약 전환</button>
                </div>
              </div>
              {selectedProject.stage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 16 }}>
                  {['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금'].map((s, i, arr) => {
                    const stages = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']
                    const cur = stages.indexOf(selectedProject.stage!)
                    const idx = stages.indexOf(s)
                    const done = idx <= cur
                    return (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : 'none' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: done ? YELLOW : '#F3F4F6', border: `2px solid ${done ? YELLOW : '#E5E7EB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: done ? DARK : '#9CA3AF' }}>
                            {done && idx < cur ? '✓' : idx + 1}
                          </div>
                          <span style={{ fontSize: 10, color: done ? DARK : '#9CA3AF', fontWeight: done ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
                        </div>
                        {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: idx < cur ? YELLOW : '#E5E7EB', margin: '0 4px', marginBottom: 16 }} />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Tabs — 5개로 통합 */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#fff', borderRadius: 10, padding: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 'fit-content' }}>
              {[
                { id: 'overview', label: '개요' },
                { id: 'tasks', label: '업무' },
                { id: 'files', label: '파일' },
                { id: 'finance', label: '재무 🔒' },
                { id: 'claude', label: '✦ Claude' },
              ].map(t => (
                <button key={t.id} onClick={() => setProjectTab(t.id)}
                  style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: projectTab === t.id ? YELLOW : 'transparent', fontWeight: projectTab === t.id ? 700 : 400, fontSize: 13, cursor: 'pointer', color: projectTab === t.id ? DARK : '#6B7280' }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
              <div>
                {/* OVERVIEW — 고객정보 + 서비스 패널 + 소통내역 통합 */}
                {projectTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>고객 정보</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[['기관', selectedProject.client], ['담당자', '김교육 (교육지원팀장)'], ['연락처', '010-1234-5678'], ['이메일', 'kim@edu.go.kr']].map(([k, v]) => (
                          <div key={k}>
                            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{k}</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedProject.service === 'SOS' && (
                      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${SERVICE_COLOR['SOS']}` }}>
                        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: SERVICE_COLOR['SOS'] }}>🎵 SOS 공연 정보</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {[['공연일', '2026-05-03 (토)'], ['장소', '이화여대 대강당'], ['대상', '전교생 800명'], ['공연 시간', '90분'], ['아티스트', '3팀 섭외 완료'], ['특이사항', '장기자랑 10분']].map(([k, v]) => (
                            <div key={k}><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{k}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div></div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedProject.service === '교구대여' && (
                      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${SERVICE_COLOR['교구대여']}` }}>
                        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: SERVICE_COLOR['교구대여'] }}>📦 교구대여 정보</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {[['대여 기간', '2026-04-15 ~ 2026-04-23'], ['반납 방법', '택배 착불'], ['품목', '아이패드 20대'], ['결제 상태', '완료']].map(([k, v]) => (
                            <div key={k}><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{k}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div></div>
                          ))}
                        </div>
                        <div style={{ marginTop: 14, background: '#FFF7ED', borderRadius: 8, padding: 12, fontSize: 12, color: '#92400E', fontWeight: 600 }}>⚠️ 반납 D-2 — 수거 준비 필요</div>
                      </div>
                    )}
                    {selectedProject.service === '교육프로그램' && (
                      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${SERVICE_COLOR['교육프로그램']}` }}>
                        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: SERVICE_COLOR['교육프로그램'] }}>📚 교육프로그램 정보</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {[['프로그램', '가족지원 연수'], ['교육 일자', '2026-05-16'], ['장소', 'YBM연수원 (분당)'], ['인원', '86명'], ['차시', '1일 6차시'], ['강사', '3명 배치 예정']].map(([k, v]) => (
                            <div key={k}><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{k}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div></div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!['SOS', '교구대여', '교육프로그램'].includes(selectedProject.service) && (
                      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${SERVICE_COLOR[selectedProject.service] || '#E5E7EB'}` }}>
                        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>🔧 {selectedProject.service} 정보</h3>
                        <div style={{ color: '#9CA3AF', fontSize: 13 }}>서비스별 상세 정보가 표시됩니다.</div>
                      </div>
                    )}

                    {/* 소통 내역 — 개요에 통합 */}
                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>소통 내역</h3>
                      {[
                        { date: '2026-04-21', author: '조민현', content: '담당자 통화 완료. 공연 날짜 5월 3일 확정. 아티스트 3팀 요청함.', channel: '전화' },
                        { date: '2026-04-18', author: '방준영', content: '견적서 발송 완료. 250만원 부가세 포함 기준.', channel: '이메일' },
                        { date: '2026-04-15', author: '조민현', content: '최초 문의 접수. 채널톡으로 유입. 5월 공연 희망.', channel: '채널톡' },
                      ].map((c, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                          <div style={{ width: 28, height: 28, background: YELLOW, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.author[0]}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, fontSize: 13 }}>{c.author}</span>
                              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.date}</span>
                              <span style={{ fontSize: 11, padding: '1px 6px', background: '#F3F4F6', borderRadius: 10, color: '#6B7280' }}>{c.channel}</span>
                            </div>
                            <div style={{ fontSize: 13, color: '#374151', background: '#F9FAFB', padding: '8px 12px', borderRadius: 8 }}>{c.content}</div>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input placeholder="소통 내용 입력..." style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none' }} />
                        <button style={{ background: YELLOW, border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>저장</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TASKS */}
                {projectTab === 'tasks' && (
                  <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>업무 목록</h3>
                      <button style={{ background: YELLOW, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ 업무 추가</button>
                    </div>
                    {TASKS.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <input type="checkbox" style={{ accentColor: YELLOW }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                          <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>{t.assignee} · 마감 {t.due}</div>
                        </div>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: t.priority === '높음' ? '#FEF2F2' : '#F9FAFB', color: t.priority === '높음' ? '#EF4444' : '#9CA3AF', fontWeight: 600 }}>{t.priority}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* FILES */}
                {projectTab === 'files' && (
                  <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>드롭박스 파일</h3>
                    {[
                      { name: '견적서_이화여대_SOS공연.pdf', size: '245KB', date: '2026-04-18', type: 'pdf' },
                      { name: '계약서_서명완료.pdf', size: '1.2MB', date: '2026-04-20', type: 'pdf' },
                      { name: '공연기획서.docx', size: '380KB', date: '2026-04-17', type: 'doc' },
                      { name: '현장사진/', size: '폴더', date: '2026-04-21', type: 'folder' },
                    ].map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ fontSize: 20 }}>{f.type === 'folder' ? '📁' : f.type === 'pdf' ? '📄' : '📝'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</div>
                          <div style={{ color: '#9CA3AF', fontSize: 11 }}>{f.size} · {f.date}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#F9FAFB', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>📦</span>
                      <span style={{ fontSize: 12, color: '#6B7280' }}>드롭박스 폴더 연결됨</span>
                      <button style={{ marginLeft: 'auto', fontSize: 11, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>폴더 열기 →</button>
                    </div>
                  </div>
                )}

                {/* FINANCE — 권한 분리 표시 */}
                {projectTab === 'finance' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>수금 일정</h3>
                        <span style={{ fontSize: 11, color: '#6B7280', background: '#F3F4F6', padding: '3px 10px', borderRadius: 20 }}>전체 공개</span>
                      </div>
                      {[
                        { label: '계약금 (30%)', amount: 750000, due: '2026-04-15', done: true },
                        { label: '잔금 (70%)', amount: 1750000, due: '2026-05-10', done: false },
                      ].map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                          <input type="checkbox" defaultChecked={s.done} style={{ accentColor: YELLOW }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</div>
                            <div style={{ color: '#9CA3AF', fontSize: 11 }}>예정일 {s.due}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: s.done ? '#059669' : '#374151' }}>{s.amount.toLocaleString()}원</div>
                          {s.done && <span style={{ fontSize: 11, color: '#059669', background: '#F0FDF4', padding: '2px 8px', borderRadius: 10 }}>수령완료</span>}
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px dashed #D1D5DB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>계약 정보 / 원가</h3>
                        <span style={{ fontSize: 11, color: '#D97706', background: '#FEF3C7', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>🔒 관리자 권한</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        {[
                          { label: '매출액', value: '250만', color: '#059669' },
                          { label: '원가', value: '110만', color: '#EF4444' },
                          { label: '수익 (56%)', value: '140만', color: '#2563EB' },
                        ].map(f => (
                          <div key={f.label} style={{ textAlign: 'center', padding: 16, background: '#F9FAFB', borderRadius: 8 }}>
                            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{f.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: f.color }}>{f.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* CLAUDE */}
                {projectTab === 'claude' && (
                  <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, background: DARK, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: YELLOW, fontWeight: 700, fontSize: 14 }}>✦</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Claude 협업</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{selectedProject.id} 맥락 주입됨 · 서비스: {selectedProject.service} · 단계: {selectedProject.stage}</div>
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: '#6B7280' }}>☁️ Dropbox 저장</button>
                      </div>
                    </div>
                    {/* 빠른 질문 버튼 */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                      {['이메일 회신 초안 써줘', '현재 상태 요약해줘', '다음 할 일 정리해줘', '견적서 문구 도와줘'].map(q => (
                        <button key={q} onClick={() => setClaudeMessages(prev => [...prev, { role: 'user', text: q }, { role: 'assistant', text: `"${q}" 요청 처리 중... ${selectedProject.name} 프로젝트 맥락과 소통 내역을 기반으로 분석하고 있어.` }])}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: `1px solid ${YELLOW}`, background: `${YELLOW}20`, cursor: 'pointer', color: DARK, fontWeight: 600 }}>{q}</button>
                      ))}
                    </div>
                    {/* 메시지 영역 */}
                    <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 14, marginBottom: 12, minHeight: 180, maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {claudeMessages.map((m, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: m.role === 'user' ? YELLOW : DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: m.role === 'user' ? DARK : YELLOW, fontWeight: 700, flexShrink: 0 }}>{m.role === 'user' ? ME.name[0] : '✦'}</div>
                          <div style={{ background: '#fff', borderRadius: 10, padding: '9px 13px', fontSize: 13, maxWidth: '80%', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', lineHeight: 1.6 }}>{m.text}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={claudeInput} onChange={e => setClaudeInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendClaude()}
                        placeholder="이 프로젝트에 대해 물어보세요..." style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, outline: 'none' }} />
                      <button onClick={sendClaude} style={{ background: DARK, color: YELLOW, border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>전송</button>
                    </div>
                  </div>
                )}
              </div>

              {/* 우측 사이드 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 10 }}>프로젝트 정보</div>
                  {[['고유번호', selectedProject.id], ['상태', selectedProject.status], ['서비스', selectedProject.service], ['담당자', selectedProject.assignee], ['단계', selectedProject.stage || '—']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                      <span style={{ color: '#6B7280' }}>{k}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 10 }}>연결된 채널</div>
                  {[
                    { icon: '💬', label: '채널톡 대화', sub: '최근 3건' },
                    { icon: '📧', label: '이메일 스레드', sub: '2개 연결됨' },
                    { icon: '📅', label: '구글 캘린더', sub: '일정 2개' },
                  ].map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                      <span style={{ fontSize: 18 }}>{c.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMERS */}
        {page === 'customers' && !selectedCustomer && (
          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>고객 DB</h1>
              <button style={{ background: YELLOW, color: DARK, border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ 기관 등록</button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input placeholder="기관명, 담당자명 검색..." style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, width: 260, outline: 'none' }} />
              {['전체', '학교', '공공기관', '기업', '개인'].map(t => (
                <button key={t} style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151' }}>{t}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {CUSTOMERS.map(c => (
                <div key={c.id} onClick={() => setSelectedCustomer(c)} style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, background: '#F3F4F6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏢</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.type} · {c.region}</div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10, marginTop: 2 }}>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>담당자</div>
                    {c.contacts.slice(0, 2).map((ct, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{ct.name}</span>
                        <span style={{ color: '#9CA3AF' }}>{ct.role}</span>
                        <span style={{ color: '#6B7280', marginLeft: 'auto' }}>{ct.phone}</span>
                      </div>
                    ))}
                    {c.contacts.length > 2 && <div style={{ fontSize: 11, color: '#9CA3AF' }}>+{c.contacts.length - 2}명 더</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, marginTop: 10 }}>
                    <span style={{ color: '#6B7280' }}>거래 <strong>{c.deals}건</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CUSTOMER DETAIL */}
        {page === 'customers' && selectedCustomer && (
          <div style={{ padding: 28, maxWidth: 800 }}>
            <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13, padding: 0, marginBottom: 16 }}>← 고객 목록</button>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, background: '#F3F4F6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🏢</div>
                <div>
                  <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{selectedCustomer.name}</h1>
                  <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>{selectedCustomer.type} · {selectedCustomer.region} · 거래 {selectedCustomer.deals}건</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[['유형', selectedCustomer.type], ['지역', selectedCustomer.region], ['총 거래건', `${selectedCustomer.deals}건`]].map(([k, v]) => (
                  <div key={k}><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{k}</div><div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div></div>
                ))}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>담당자</h3>
                <button style={{ background: YELLOW, border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ 담당자 추가</button>
              </div>
              {selectedCustomer.contacts.map((ct, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 0', borderBottom: '1px solid #F3F4F6', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>이름</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{ct.name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>직책/부서</div>
                    <div style={{ fontSize: 13 }}>{ct.role}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>휴대폰</div>
                    <div style={{ fontSize: 13 }}>{ct.phone}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>이메일</div>
                    <div style={{ fontSize: 12, color: '#2563EB' }}>{ct.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer' }}>수정</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CALENDAR */}
        {page === 'calendar' && (
          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>캘린더</h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#059669', background: '#F0FDF4', padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>📅 구글 캘린더 연동됨</span>
                <button style={{ background: YELLOW, color: DARK, border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ 일정 추가</button>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7280' }}>←</button>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>2026년 5월</h2>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7280' }}>→</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
                {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', fontWeight: 600, padding: '4px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {Array.from({ length: 35 }, (_, i) => {
                  const day = i - 3
                  const hasEvent = CALENDAR_EVENTS.find(e => parseInt(e.date.split('-')[2]) === day && e.date.startsWith('2026-05'))
                  return (
                    <div key={i} style={{ minHeight: 60, padding: 6, borderRadius: 8, background: day === 21 ? `${YELLOW}20` : '#F9FAFB', border: day === 21 ? `1px solid ${YELLOW}` : '1px solid transparent' }}>
                      {day > 0 && day <= 31 && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: day === 21 ? 800 : 400, color: '#374151', marginBottom: 4 }}>{day}</div>
                          {hasEvent && (
                            <div style={{ fontSize: 10, background: hasEvent.color, color: '#fff', borderRadius: 4, padding: '1px 4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {hasEvent.title.split(' (')[0]}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>다가오는 일정</h3>
              {CALENDAR_EVENTS.sort((a, b) => a.date.localeCompare(b.date)).map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{e.title}</div>
                    <div style={{ color: '#9CA3AF', fontSize: 11 }}>{e.date}</div>
                  </div>
                  <button onClick={() => { const p = PROJECTS.find(pr => pr.id === e.project); if (p) openProject(p) }}
                    style={{ fontSize: 11, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>프로젝트 →</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FINANCE */}
        {page === 'finance' && (
          <div style={{ padding: 28 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px' }}>재무</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: '이번 달 매출', value: '3,780만', color: '#059669', sub: '전월比 +12%' },
                { label: '이번 달 원가', value: '1,690만', color: '#EF4444', sub: '마진율 55%' },
                { label: '이번 달 수익', value: '2,090만', color: '#2563EB', sub: '순이익' },
                { label: '미수금', value: '2,088만', color: '#F59E0B', sub: '3건 미정산' },
              ].map(c => (
                <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ color: '#6B7280', fontSize: 12, marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                  <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>{c.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>월별 매출 현황 (2026)</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                  {[{ month: '1월', val: 45 }, { month: '2월', val: 30 }, { month: '3월', val: 65 }, { month: '4월', val: 75 }, { month: '5월', val: 0 }, { month: '6월', val: 0 }].map(m => (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: '70%', background: m.val ? YELLOW : '#F3F4F6', borderRadius: '4px 4px 0 0', height: m.val ? `${m.val}%` : '4px' }} />
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{m.month}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>사업부별 매출</h3>
                {[
                  { name: '교육프로그램', val: 2000, max: 3780, color: '#059669' },
                  { name: 'SOS/행사', val: 1030, max: 3780, color: '#7C3AED' },
                  { name: '교구대여', val: 380, max: 3780, color: '#D97706' },
                  { name: '납품설치', val: 280, max: 3780, color: '#2563EB' },
                  { name: '002ENT', val: 90, max: 3780, color: '#EF4444' },
                ].map(d => (
                  <div key={d.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: '#374151' }}>{d.name}</span>
                      <span style={{ fontWeight: 700 }}>{d.val}만</span>
                    </div>
                    <div style={{ background: '#F3F4F6', borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${(d.val / d.max) * 100}%`, background: d.color, borderRadius: 4, height: '100%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 수의계약 한도 현황 */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>수의계약 한도 현황</h3>
                <span style={{ fontSize: 11, color: '#6B7280', background: '#F3F4F6', padding: '2px 10px', borderRadius: 20 }}>공공기관 계약 기준 2,000만원</span>
              </div>
              {PROJECTS.filter(p => p.revenue && p.client).map(p => {
                const limit = 20000000
                const pct = p.revenue ? Math.min((p.revenue / limit) * 100, 100) : 0
                const over = p.revenue ? p.revenue >= limit : false
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ width: 52, fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>{p.id}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <span style={{ color: over ? '#EF4444' : '#374151', fontWeight: 700 }}>{p.revenue ? (p.revenue / 10000).toFixed(0) + '만' : '—'}</span>
                      </div>
                      <div style={{ background: '#F3F4F6', borderRadius: 4, height: 6 }}>
                        <div style={{ width: `${pct}%`, background: over ? '#EF4444' : pct > 80 ? '#F59E0B' : '#059669', borderRadius: 4, height: '100%' }} />
                      </div>
                    </div>
                    {over ? (
                      <span style={{ fontSize: 11, color: '#EF4444', background: '#FEF2F2', padding: '2px 8px', borderRadius: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>한도초과 ⚠️</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#059669', background: '#F0FDF4', padding: '2px 8px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>수의 가능</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TEAM */}
        {page === 'team' && (
          <div style={{ padding: 28 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px' }}>팀</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { name: '조민현', role: '매니저', tasks: 8, projects: 3, avatar: '민' },
                { name: '유제민', role: '매니저', tasks: 6, projects: 4, avatar: '제' },
                { name: '임지영', role: '팀원', tasks: 3, projects: 2, avatar: '지' },
                { name: '정태영', role: '팀원', tasks: 2, projects: 1, avatar: '태' },
                { name: '김수아', role: '팀원', tasks: 1, projects: 1, avatar: '수' },
              ].map(m => (
                <div key={m.name} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, background: YELLOW, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: DARK }}>{m.avatar}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                      <div style={{ color: '#9CA3AF', fontSize: 12 }}>{m.role}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 20 }}>{m.tasks}</div>
                      <div style={{ color: '#9CA3AF', fontSize: 11 }}>진행 업무</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 20 }}>{m.projects}</div>
                      <div style={{ color: '#9CA3AF', fontSize: 11 }}>담당 프로젝트</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
