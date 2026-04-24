'use client'

import { updateDocumentStatus } from '../actions'

interface DocRequest {
  id: string; member_id: string; doc_type: string
  purpose: string | null; status: string; created_at: string; processed_at: string | null
}

interface Props {
  userId: string
  records: DocRequest[]
  setRecords: React.Dispatch<React.SetStateAction<DocRequest[]>>
}

const DOC_TYPES = ['재직증명서', '경력증명서', '근로소득원천징수영수증', '급여명세서', '기타']
const DOC_STATUS: Record<string, string> = {
  요청: 'bg-yellow-100 text-yellow-700',
  처리중: 'bg-blue-100 text-blue-700',
  발급완료: 'bg-green-100 text-green-700',
}

export default function DocsSection({ userId, records, setRecords }: Props) {
  const userDocs = records.filter(d => d.member_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">직접 발급 등록</p>
        <div className="flex gap-2">
          <select id="doc-type-select" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white">
            {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <button onClick={async () => {
            const sel = document.getElementById('doc-type-select') as HTMLSelectElement
            const docType = sel.value
            const admin = await import('@/lib/supabase/admin').then(m => m.createAdminClient())
            const { data } = await admin.from('document_requests').insert({ member_id: userId, doc_type: docType, status: '발급완료', processed_at: new Date().toISOString() }).select().single()
            if (data) setRecords(prev => [data as DocRequest, ...prev])
          }} className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap">발급완료 처리</button>
        </div>
      </div>
      {userDocs.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-6">서류 발급 이력이 없어요.</p>
      ) : userDocs.map(d => (
        <div key={d.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
          <div>
            <p className="text-sm font-medium text-gray-800">{d.doc_type}</p>
            <p className="text-xs text-gray-400">{d.created_at.slice(0,10)}{d.purpose ? ` · ${d.purpose}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${DOC_STATUS[d.status] ?? 'bg-gray-100 text-gray-500'}`}>{d.status}</span>
            {d.status === '요청' && (
              <button onClick={async () => { await updateDocumentStatus(d.id, '발급완료'); setRecords(prev => prev.map(x => x.id === d.id ? {...x, status:'발급완료'} : x)) }}
                className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200">처리</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
