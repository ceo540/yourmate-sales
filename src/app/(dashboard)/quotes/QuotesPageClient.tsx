'use client'

import { useState } from 'react'
import QuoteCreateModal from './QuoteCreateModal'
import QuoteListPanel from './QuoteListPanel'

interface EntityOption { id: string; name: string; short_name: string | null }
interface CustomerOption { id: string; name: string }
interface SaleOption { id: string; name: string; client_org: string | null }
interface ProjectOption { id: string; name: string; client_org: string | null }
interface LeadOption { id: string; client_org: string | null }

interface Props {
  quotes: React.ComponentProps<typeof QuoteListPanel>['quotes']
  entities: EntityOption[]
  customers: CustomerOption[]
  sales: SaleOption[]
  projects: ProjectOption[]
  leads: LeadOption[]
}

export default function QuotesPageClient({ quotes, entities, customers, sales, projects, leads }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">견적</h1>
          <p className="text-xs text-gray-500 mt-0.5">사업자별 견적서 발행 + Dropbox 자동 저장. PDF 출력은 Step 4 예정.</p>
        </div>
        <button onClick={() => setOpen(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          + 새 견적
        </button>
      </div>

      <QuoteListPanel quotes={quotes} />

      <QuoteCreateModal
        open={open}
        onClose={() => setOpen(false)}
        entities={entities}
        customers={customers}
        sales={sales}
        projects={projects}
        leads={leads}
      />
    </>
  )
}
