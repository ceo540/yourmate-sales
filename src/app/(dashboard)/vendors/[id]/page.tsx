import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { updateVendor } from '../actions'
import SubmitButton from '@/components/ui/SubmitButton'

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: vendor } = await supabase.from('vendors').select('*').eq('id', id).single()
  if (!vendor) notFound()

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/vendors" className="text-gray-400 hover:text-gray-600 text-sm">← 거래처 DB</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600 font-medium">{vendor.name}</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">거래처 수정</h1>
        <form action={updateVendor} className="space-y-5">
          <input type="hidden" name="id" value={vendor.id} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">구분 *</label>
            <div className="flex gap-3">
              {['프리랜서', '업체'].map(t => (
                <label key={t} className="cursor-pointer flex-1">
                  <input type="radio" name="type" value={t} defaultChecked={vendor.type === t} className="sr-only peer" />
                  <span className="block text-center px-4 py-2.5 rounded-lg text-sm border border-gray-200 text-gray-500 peer-checked:border-yellow-400 peer-checked:bg-yellow-50 peer-checked:text-yellow-800 peer-checked:font-medium transition-all">
                    {t}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">이름 *</label>
            <input name="name" required defaultValue={vendor.name} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">연락처</label>
            <input name="phone" defaultValue={vendor.phone ?? ''} placeholder="010-0000-0000" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
            <input name="email" type="email" defaultValue={vendor.email ?? ''} placeholder="example@email.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">주민등록번호 / 사업자번호</label>
            <input name="id_number" defaultValue={vendor.id_number ?? ''} placeholder="000000-0000000 또는 000-00-00000" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">계좌정보</label>
            <input name="bank_info" defaultValue={vendor.bank_info ?? ''} placeholder="국민은행 123456-78-901234 홍길동" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">메모</label>
            <textarea name="memo" rows={2} defaultValue={vendor.memo ?? ''} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <SubmitButton label="저장" loadingLabel="저장 중..." fullWidth />
            <Link href="/vendors" className="px-6 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">취소</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
