'use client'

import { useState } from 'react'
import { upsertSalary, deleteSalary } from '../actions'

interface SalaryRecord {
  id: string; member_id: string; year: number; month: number
  base_salary: number; deductions: number; net_salary: number; memo: string | null
}

interface Props {
  userId: string
  records: SalaryRecord[]
  setRecords: React.Dispatch<React.SetStateAction<SalaryRecord[]>>
}

export default function SalaryHistorySection({ userId, records, setRecords }: Props) {
  const [salaryYear, setSalaryYear] = useState(new Date().getFullYear())
  const [editingSalaryMonth, setEditingSalaryMonth] = useState<number | null>(null)
  const [salaryForm, setSalaryForm] = useState({ base_salary: '', deductions: '', net_salary: '', memo: '' })

  const userSalary = records.filter(s => s.member_id === userId && s.year === salaryYear)
  const salaryMap = Object.fromEntries(userSalary.map(s => [s.month, s]))
  const totalBase = userSalary.reduce((a, s) => a + (s.base_salary ?? 0), 0)
  const totalNet = userSalary.reduce((a, s) => a + (s.net_salary ?? 0), 0)
  const fmt = (n: number) => n ? n.toLocaleString('ko-KR') + '원' : '-'

  return (
    <div className="space-y-3">
      {/* 연도 선택 */}
      <div className="flex items-center gap-2">
        <button onClick={() => setSalaryYear(y => y - 1)} className="p-1 rounded hover:bg-gray-100 text-gray-400">‹</button>
        <span className="text-sm font-semibold text-gray-800 w-12 text-center">{salaryYear}</span>
        <button onClick={() => setSalaryYear(y => y + 1)} className="p-1 rounded hover:bg-gray-100 text-gray-400">›</button>
      </div>
      {/* 월별 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 text-gray-400 font-medium w-8">월</th>
              <th className="text-right py-2 text-gray-400 font-medium">기본급</th>
              <th className="text-right py-2 text-gray-400 font-medium">공제</th>
              <th className="text-right py-2 text-gray-400 font-medium">실수령</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({length: 12}, (_, i) => i + 1).map(month => {
              const rec = salaryMap[month]
              const isEditing = editingSalaryMonth === month
              return (
                <tr key={month} className="border-b border-gray-50 hover:bg-gray-50">
                  {isEditing ? (
                    <td colSpan={5} className="py-2">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {[['base_salary','기본급'],['deductions','공제'],['net_salary','실수령']].map(([field, label]) => (
                          <div key={field}>
                            <label className="text-[10px] text-gray-400 block mb-0.5">{label}</label>
                            <input type="number" value={(salaryForm as Record<string, string>)[field]}
                              onChange={e => setSalaryForm(f => ({...f, [field]: e.target.value}))}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white" placeholder="0" />
                          </div>
                        ))}
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">메모</label>
                          <input type="text" value={salaryForm.memo}
                            onChange={e => setSalaryForm(f => ({...f, memo: e.target.value}))}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white" />
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={async () => {
                          await upsertSalary(userId, salaryYear, month, Number(salaryForm.base_salary)||0, Number(salaryForm.deductions)||0, Number(salaryForm.net_salary)||0, salaryForm.memo)
                          const newRec: SalaryRecord = { id: rec?.id ?? Date.now().toString(), member_id: userId, year: salaryYear, month, base_salary: Number(salaryForm.base_salary)||0, deductions: Number(salaryForm.deductions)||0, net_salary: Number(salaryForm.net_salary)||0, memo: salaryForm.memo || null }
                          setRecords(prev => rec ? prev.map(s => s.id === rec.id ? newRec : s) : [...prev, newRec])
                          setEditingSalaryMonth(null)
                        }} className="flex-1 py-1 bg-gray-900 text-white rounded text-xs">저장</button>
                        <button onClick={() => setEditingSalaryMonth(null)} className="flex-1 py-1 border rounded text-xs text-gray-400">취소</button>
                        {rec && <button onClick={async () => { await deleteSalary(rec.id); setRecords(prev => prev.filter(s => s.id !== rec.id)); setEditingSalaryMonth(null) }} className="px-2 py-1 text-red-400 hover:text-red-600 text-xs">삭제</button>}
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="py-2 text-gray-500 font-medium">{month}월</td>
                      <td className="py-2 text-right text-gray-700">{rec ? fmt(rec.base_salary) : <span className="text-gray-300">-</span>}</td>
                      <td className="py-2 text-right text-gray-500">{rec ? fmt(rec.deductions) : <span className="text-gray-300">-</span>}</td>
                      <td className="py-2 text-right font-medium text-gray-800">{rec ? fmt(rec.net_salary) : <span className="text-gray-300">-</span>}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => { setSalaryForm({ base_salary: String(rec?.base_salary ?? ''), deductions: String(rec?.deductions ?? ''), net_salary: String(rec?.net_salary ?? ''), memo: rec?.memo ?? '' }); setEditingSalaryMonth(month) }}
                          className="text-[10px] text-gray-300 hover:text-blue-500">{rec ? '편집' : '+'}</button>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
          {userSalary.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td className="py-2 text-xs font-bold text-gray-600">합계</td>
                <td className="py-2 text-right text-xs font-bold text-gray-700">{fmt(totalBase)}</td>
                <td></td>
                <td className="py-2 text-right text-xs font-bold text-gray-800">{fmt(totalNet)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
