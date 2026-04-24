'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertEmployeeCard, deleteEmployeeCard } from '../../payroll/actions'

interface EmployeeCard {
  id: string
  employee_name: string
  business_entity: string | null
  profile_id: string | null
  base_salary: number
  meal_allowance: number
  mileage_allowance: number
  allowances: number
  fixed_bonus: number
  national_pension: number
  health_insurance: number
  employment_insurance: number
  income_tax: number
  resident_id: string | null
  bank_info: string | null
  dependents: number
  hourly_rate: number | null
  memo: string | null
  is_active: boolean
}

const EMPTY_CARD = {
  id: '', employee_name: '', business_entity: '',
  base_salary: 0, meal_allowance: 0, mileage_allowance: 0, allowances: 0, fixed_bonus: 0,
  national_pension: 0, health_insurance: 0, employment_insurance: 0, income_tax: 0,
  resident_id: '', bank_info: '', dependents: 0, hourly_rate: 0, memo: '', is_active: true,
}

interface Props {
  selectedUser: { id: string; name: string }
  employeeCards: EmployeeCard[]
  setEmployeeCards: React.Dispatch<React.SetStateAction<EmployeeCard[]>>
}

export default function SalarySettingsSection({ selectedUser, employeeCards, setEmployeeCards }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [cardForm, setCardForm] = useState({ ...EMPTY_CARD })
  const [cardDependents, setCardDependents] = useState(0)
  const [cardSaving, setCardSaving] = useState(false)

  const userCard = employeeCards.find(c => c.profile_id === selectedUser.id)
  const isNew = !userCard

  const cardNumF = (key: keyof typeof cardForm) => ({
    value: (cardForm[key] as number) === 0 ? '' : (cardForm[key] as number).toLocaleString(),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setCardForm(f => ({ ...f, [key]: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })),
  })

  function initCard() {
    if (userCard) {
      setCardForm({
        id: userCard.id, employee_name: userCard.employee_name,
        business_entity: userCard.business_entity ?? '',
        base_salary: userCard.base_salary, meal_allowance: userCard.meal_allowance,
        mileage_allowance: userCard.mileage_allowance, allowances: userCard.allowances,
        fixed_bonus: userCard.fixed_bonus, national_pension: userCard.national_pension,
        health_insurance: userCard.health_insurance, employment_insurance: userCard.employment_insurance,
        income_tax: userCard.income_tax, resident_id: userCard.resident_id ?? '',
        bank_info: userCard.bank_info ?? '', dependents: userCard.dependents,
        hourly_rate: userCard.hourly_rate ?? 0, memo: userCard.memo ?? '', is_active: userCard.is_active,
      })
      setCardDependents(userCard.dependents)
    } else {
      setCardForm({ ...EMPTY_CARD, employee_name: selectedUser?.name ?? '' })
      setCardDependents(0)
    }
  }

  function autoCalc() {
    const mealTaxFree = Math.min(cardForm.meal_allowance, 200_000)
    const mileageTaxFree = Math.min(cardForm.mileage_allowance, 200_000)
    const taxable = cardForm.base_salary + (cardForm.meal_allowance - mealTaxFree)
      + (cardForm.mileage_allowance - mileageTaxFree) + cardForm.allowances + cardForm.fixed_bonus
    const total = cardForm.base_salary + cardForm.meal_allowance + cardForm.mileage_allowance + cardForm.allowances + cardForm.fixed_bonus
    const pension = Math.round(taxable * 0.045 / 10) * 10
    const healthBase = Math.round(taxable * 0.03545 / 10) * 10
    const health = healthBase + Math.round(healthBase * 0.1295 / 10) * 10
    const employment = Math.round(total * 0.009 / 10) * 10
    const annual = taxable * 12
    let wageDeduction: number
    if (annual <= 5_000_000) wageDeduction = annual * 0.7
    else if (annual <= 15_000_000) wageDeduction = 3_500_000 + (annual - 5_000_000) * 0.4
    else if (annual <= 45_000_000) wageDeduction = 7_500_000 + (annual - 15_000_000) * 0.15
    else if (annual <= 100_000_000) wageDeduction = 12_000_000 + (annual - 45_000_000) * 0.05
    else wageDeduction = 14_750_000
    const earned = annual - wageDeduction
    const basicDeduction = 1_500_000 * (1 + Math.max(0, cardDependents))
    const taxBase = Math.max(0, earned - basicDeduction)
    let tax: number
    if (taxBase <= 14_000_000) tax = taxBase * 0.06
    else if (taxBase <= 50_000_000) tax = 840_000 + (taxBase - 14_000_000) * 0.15
    else if (taxBase <= 88_000_000) tax = 6_240_000 + (taxBase - 50_000_000) * 0.24
    else tax = 15_360_000 + (taxBase - 88_000_000) * 0.35
    let taxCredit = tax <= 1_300_000 ? tax * 0.55 : 715_000 + (tax - 1_300_000) * 0.30
    const creditLimit = annual <= 33_000_000 ? 740_000
      : annual <= 70_000_000 ? 740_000 - (annual - 33_000_000) * 0.008 : 66_000
    taxCredit = Math.min(taxCredit, creditLimit)
    const incomeTax = Math.round(Math.max(0, (tax - taxCredit) / 12) / 10) * 10
    setCardForm(f => ({ ...f, national_pension: pension, health_insurance: health, employment_insurance: employment, income_tax: incomeTax }))
  }

  const gross = cardForm.base_salary + cardForm.meal_allowance + cardForm.mileage_allowance + cardForm.allowances + cardForm.fixed_bonus
  const ded = cardForm.national_pension + cardForm.health_insurance + cardForm.employment_insurance + cardForm.income_tax

  return (
    <div className="space-y-4">
      {isNew ? (
        <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">아직 급여설정이 없어요.</p>
          <button onClick={initCard}
            className="text-sm px-3 py-1.5 rounded-lg font-semibold hover:opacity-80 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>설정 시작</button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">{selectedUser.name} 급여 템플릿</p>
          <div className="flex gap-2">
            <button onClick={initCard} className="text-xs text-gray-400 hover:text-gray-600">초기화</button>
            <button onClick={async () => {
              if (!confirm('급여설정을 삭제하시겠어요?')) return
              await deleteEmployeeCard(userCard!.id)
              setEmployeeCards(prev => prev.filter(c => c.id !== userCard!.id))
            }} className="text-xs text-red-400 hover:text-red-600">삭제</button>
          </div>
        </div>
      )}

      {(cardForm.employee_name || !isNew) && (
        <>
          {/* 지급항목 */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">지급 항목</p>
            {([
              { label: '기본급 *', key: 'base_salary' as const },
              { label: '식대', key: 'meal_allowance' as const },
              { label: '자가운전', key: 'mileage_allowance' as const },
              { label: '수당', key: 'allowances' as const },
              { label: '고정상여', key: 'fixed_bonus' as const },
            ]).map(({ label, key }) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</label>
                <input type="text" inputMode="numeric" {...cardNumF(key)}
                  className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                <span className="text-xs text-gray-400">원</span>
              </div>
            ))}
          </div>

          {/* 공제항목 */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600">공제 항목</p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">부양가족</label>
                <select value={cardDependents} onChange={e => setCardDependents(Number(e.target.value))}
                  className="text-xs px-2 py-1 border border-gray-200 rounded-lg focus:outline-none bg-white">
                  {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}명{n === 0 ? '(본인)' : ''}</option>)}
                </select>
                <button type="button" onClick={autoCalc}
                  className="text-xs px-2.5 py-1 rounded-lg font-semibold hover:opacity-80"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>자동계산</button>
              </div>
            </div>
            {([
              { label: '국민연금', key: 'national_pension' as const },
              { label: '건강보험', key: 'health_insurance' as const },
              { label: '고용보험', key: 'employment_insurance' as const },
              { label: '소득세', key: 'income_tax' as const },
            ]).map(({ label, key }) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</label>
                <input type="text" inputMode="numeric" {...cardNumF(key)}
                  className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                <span className="text-xs text-gray-400">원</span>
              </div>
            ))}
            {gross > 0 && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">월 실수령 예상</span>
                <span className="text-sm font-bold text-green-600">{(gross - ded).toLocaleString()}원</span>
              </div>
            )}
          </div>

          {/* 기준시급 */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20 flex-shrink-0">기준 시급</label>
              <input type="text" inputMode="numeric" {...cardNumF('hourly_rate')}
                placeholder="0"
                className="w-28 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
              <span className="text-xs text-gray-400">원</span>
              {cardForm.hourly_rate > 0 && (
                <span className="text-xs text-blue-500">추가수당 {Math.round(cardForm.hourly_rate * 1.5).toLocaleString()}원/h</span>
              )}
            </div>
          </div>

          {/* 계좌·주민번호 */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20 flex-shrink-0">계좌번호</label>
              <input value={cardForm.bank_info}
                onChange={e => setCardForm(f => ({ ...f, bank_info: e.target.value }))}
                placeholder="은행 계좌번호"
                className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20 flex-shrink-0">주민번호</label>
              <input value={cardForm.resident_id}
                onChange={e => setCardForm(f => ({ ...f, resident_id: e.target.value }))}
                placeholder="000000-0000000"
                className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20 flex-shrink-0">메모</label>
              <input value={cardForm.memo}
                onChange={e => setCardForm(f => ({ ...f, memo: e.target.value }))}
                className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cardForm.is_active}
                onChange={e => setCardForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              <span className="text-xs text-gray-600">활성 (월급여 자동생성에 포함)</span>
            </label>
          </div>

          <button onClick={async () => {
            if (!cardForm.base_salary) return alert('기본급을 입력해주세요.')
            setCardSaving(true)
            await upsertEmployeeCard({
              ...(cardForm.id ? { id: cardForm.id } : {}),
              employee_name: selectedUser.name,
              business_entity: cardForm.business_entity || null,
              profile_id: selectedUser.id,
              base_salary: cardForm.base_salary,
              meal_allowance: cardForm.meal_allowance,
              mileage_allowance: cardForm.mileage_allowance,
              allowances: cardForm.allowances,
              fixed_bonus: cardForm.fixed_bonus,
              national_pension: cardForm.national_pension,
              health_insurance: cardForm.health_insurance,
              employment_insurance: cardForm.employment_insurance,
              income_tax: cardForm.income_tax,
              resident_id: cardForm.resident_id || null,
              bank_info: cardForm.bank_info || null,
              dependents: cardDependents,
              hourly_rate: cardForm.hourly_rate || null,
              memo: cardForm.memo || null,
              is_active: cardForm.is_active,
            })
            setCardSaving(false)
            startTransition(() => router.refresh())
          }} disabled={cardSaving}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            {cardSaving ? '저장 중...' : '저장'}
          </button>
        </>
      )}
    </div>
  )
}
