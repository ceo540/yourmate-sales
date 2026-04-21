import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const TILES = [
  {
    key: 'rental',
    name: '교구/장비 대여',
    icon: '📦',
    color: '#D97706',
    desc: '아이패드, VR, 음향 장비 대여 관리',
    href: '/rentals',
    specialized: true,
    deptKey: null,
  },
  {
    key: 'sos',
    name: 'SOS 공연',
    icon: '🎵',
    color: '#7C3AED',
    desc: '공연 기획 · 아티스트 · 현장 운영 관리',
    href: '/sos',
    specialized: true,
    deptKey: null,
  },
  {
    key: 'edu',
    name: '교육프로그램',
    icon: '📚',
    color: '#059669',
    desc: '연수 · 교육 일정, 강사, 커리큘럼 관리',
    href: '/departments/artkiwoom',
    specialized: false,
    deptKey: 'artkiwoom',
  },
  {
    key: 'install',
    name: '납품설치',
    icon: '🔧',
    color: '#2563EB',
    desc: '납품 · 설치 일정, 자재, A/S 관리',
    href: '/departments/school_store',
    specialized: false,
    deptKey: 'school_store',
  },
  {
    key: 'content',
    name: '콘텐츠제작',
    icon: '🎬',
    color: '#EC4899',
    desc: '영상 · 인쇄 · 디자인 제작 관리',
    href: '/departments/002_creative',
    specialized: false,
    deptKey: '002_creative',
  },
  {
    key: 'ent',
    name: '002ENT',
    icon: '🎤',
    color: '#EF4444',
    desc: '아티스트 음원유통 및 계약 관리',
    href: '/departments/002_entertainment',
    specialized: false,
    deptKey: '002_entertainment',
  },
]

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [
    { count: rentalCount },
    { count: sosCount },
    { data: salesData },
  ] = await Promise.all([
    supabase.from('rentals').select('id', { count: 'exact', head: true })
      .not('status', 'in', '(완료,취소)'),
    admin.from('sos_concerts').select('id', { count: 'exact', head: true })
      .gte('year', new Date().getFullYear()),
    supabase.from('sales').select('department, contract_stage')
      .not('department', 'is', null),
  ])

  const deptCounts: Record<string, number> = {}
  for (const s of salesData ?? []) {
    if (s.contract_stage === '잔금') continue
    const d = s.department as string
    deptCounts[d] = (deptCounts[d] ?? 0) + 1
  }

  function getCount(tile: typeof TILES[0]) {
    if (tile.key === 'rental') return rentalCount ?? 0
    if (tile.key === 'sos') return sosCount ?? 0
    if (tile.deptKey) return deptCounts[tile.deptKey] ?? 0
    return 0
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">서비스 관리</h1>
        <p className="text-gray-500 text-sm mt-1">서비스별 전용 트래킹 보드 — 각 서비스마다 특화된 관리 도구</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map(tile => {
          const count = getCount(tile)
          return (
            <Link
              key={tile.key}
              href={tile.href}
              className="block bg-white rounded-2xl p-6 relative group transition-all hover:scale-[1.01]"
              style={{
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                borderTop: `4px solid ${tile.color}`,
              }}
            >
              {tile.specialized && (
                <span className="absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: tile.color + '18', color: tile.color }}>
                  전용 보드
                </span>
              )}
              <div className="text-3xl mb-3">{tile.icon}</div>
              <div className="font-bold text-gray-900 text-base mb-1">{tile.name}</div>
              <div className="text-xs text-gray-400 mb-5">{tile.desc}</div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: tile.color }}>
                  진행중 {count}건
                </span>
                <span className="text-gray-300 group-hover:text-gray-400 transition-colors text-lg">→</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
