'use client'

import Link from 'next/link'

interface Rental {
  id: string
  sale_id: string | null
  customer_name: string
  status: string
  rental_start: string | null
  rental_end: string | null
}

interface Props {
  serviceType: string | null
  rentals: Rental[]
}

const STATUS_BADGE: Record<string, string> = {
  유입: 'bg-gray-100 text-gray-500',
  견적발송: 'bg-purple-100 text-purple-700',
  렌탈확정: 'bg-yellow-100 text-yellow-700',
  진행중: 'bg-green-100 text-green-700',
  수거완료: 'bg-teal-100 text-teal-700',
  검수중: 'bg-blue-100 text-blue-700',
  완료: 'bg-gray-100 text-gray-400',
  취소: 'bg-red-100 text-red-400',
}

function fmtRange(start: string | null, end: string | null) {
  if (!start && !end) return ''
  const s = start ? start.slice(5).replace('-', '/') : ''
  const e = end ? end.slice(5).replace('-', '/') : ''
  if (s && e) return `${s}~${e}`
  return s || e
}

export default function RelatedServices({ serviceType, rentals }: Props) {
  const isRentalService = serviceType === '교구대여' || serviceType === '행사대여'
  const hasRentals = rentals.length > 0

  if (!isRentalService && !hasRentals) return null

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700">관련 서비스 페이지</p>
        <Link href="/rentals" className="text-xs text-gray-400 hover:text-gray-700">
          렌탈 전체 보기 →
        </Link>
      </div>
      {hasRentals ? (
        <div className="space-y-1.5">
          {rentals.map(r => (
            <Link
              key={r.id}
              href={`/rentals/${r.id}`}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <span className="text-sm">🛠</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate group-hover:text-blue-600">
                  {r.customer_name || '(이름 없음)'}
                </p>
                {(r.rental_start || r.rental_end) && (
                  <p className="text-xs text-gray-400">{fmtRange(r.rental_start, r.rental_end)}</p>
                )}
              </div>
              {r.status && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-400'}`}>
                  {r.status}
                </span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">렌탈 서비스 프로젝트지만 등록된 렌탈 건이 없어요.</p>
      )}
    </div>
  )
}
