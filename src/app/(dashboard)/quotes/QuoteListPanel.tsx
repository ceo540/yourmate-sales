'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteQuote } from './actions'
import type { Quote, QuoteStatus } from '@/types'

interface QuoteRow extends Quote {
  entity_name: string | null
  entity_short_name: string | null
  sale_name: string | null
  project_name_resolved: string | null
  customer_name: string | null
}

interface Props {
  quotes: QuoteRow[]
}

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: '작성 중',
  sent: '발송됨',
  accepted: '수주',
  rejected: '실주',
  cancelled: '취소',
}
const STATUS_COLOR: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-yellow-100 text-yellow-700',
}

export default function QuoteListPanel({ quotes }: Props) {
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function handleDelete(id: string, quoteNumber: string) {
    if (!confirm(`견적 ${quoteNumber} 삭제할까? 항목까지 함께 삭제됨.`)) return
    setBusyId(id)
    startTransition(async () => {
      const res = await deleteQuote(id)
      setBusyId(null)
      if (!res.ok) alert(`삭제 실패: ${res.error}`)
    })
  }

  if (!quotes.length) {
    return <div className="text-center text-sm text-gray-500 py-12">견적이 아직 없어. 우측 상단 [+ 새 견적]으로 만들어줘.</div>
  }

  return (
    <table className="w-full text-sm border">
      <thead className="bg-gray-50">
        <tr>
          <th className="border px-2 py-1.5 text-left">견적번호</th>
          <th className="border px-2 py-1.5 text-left">건명</th>
          <th className="border px-2 py-1.5 text-left">거래처</th>
          <th className="border px-2 py-1.5 text-left">사업자</th>
          <th className="border px-2 py-1.5 text-right">총액</th>
          <th className="border px-2 py-1.5 text-center">상태</th>
          <th className="border px-2 py-1.5 text-center">연결</th>
          <th className="border px-2 py-1.5 text-center">파일</th>
          <th className="border px-2 py-1.5 text-center w-16">작업</th>
        </tr>
      </thead>
      <tbody>
        {quotes.map(q => (
          <tr key={q.id} className="hover:bg-gray-50">
            <td className="border px-2 py-1.5 font-mono">{q.quote_number}</td>
            <td className="border px-2 py-1.5">{q.project_name}</td>
            <td className="border px-2 py-1.5">{q.customer_name ?? '-'}</td>
            <td className="border px-2 py-1.5">{q.entity_short_name ?? q.entity_name ?? '-'}</td>
            <td className="border px-2 py-1.5 text-right">₩{Number(q.total_amount).toLocaleString('ko-KR')}</td>
            <td className="border px-2 py-1.5 text-center">
              <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_COLOR[q.status]}`}>{STATUS_LABEL[q.status]}</span>
            </td>
            <td className="border px-2 py-1.5 text-center text-xs">
              {q.sale_id && <Link href={`/sales/${q.sale_id}`} className="text-blue-600 hover:underline mr-1">계약</Link>}
              {q.project_id && <Link href={`/projects/${q.project_id}`} className="text-blue-600 hover:underline mr-1">프로젝트</Link>}
              {q.lead_id && <Link href={`/leads`} className="text-blue-600 hover:underline">리드</Link>}
              {!q.sale_id && !q.project_id && !q.lead_id && <span className="text-gray-300">-</span>}
            </td>
            <td className="border px-2 py-1.5 text-center text-xs">
              {q.html_path
                ? <span className="text-green-600" title={q.html_path}>📄 저장됨</span>
                : <span className="text-gray-300">DB만</span>
              }
            </td>
            <td className="border px-2 py-1.5 text-center">
              <button
                onClick={() => handleDelete(q.id, q.quote_number)}
                disabled={pending && busyId === q.id}
                className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
              >
                삭제
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
