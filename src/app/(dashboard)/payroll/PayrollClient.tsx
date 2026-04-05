'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertPayroll, deletePayroll, upsertBusinessEntity, deleteBusinessEntity, upsertBonusItem, deleteBonusItem, generateMonthlyFromCards } from './actions'
import CsvImportTab from './CsvImportTab'
import TaxReportTab from './TaxReportTab'

interface PayrollRecord {
  id: string
  year: number
  month: number
  employee_name: string
  employee_type: string
  business_entity: string | null
  profile_id: string | null
  base_salary: number
  meal_allowance: number
  mileage_allowance: number
  allowances: number
  fixed_bonus: number
  bonus: number
  unpaid_leave: number
  national_pension: number
  health_insurance: number
  employment_insurance: number
  income_tax: number
  resident_id: string | null
  bank_info: string | null
  payment_confirmed: boolean
  payment_date: string | null
  memo: string | null
  description: string | null
}

interface BusinessEntity { id: string; name: string }
interface Profile { id: string; name: string }
interface BonusItem {
  id: string
  year: number
  month: number
  employee_name: string
  business_entity: string | null
  date: string | null
  description: string
  detail: string | null
  amount: number
}

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

interface Props {
  payroll: PayrollRecord[]
  profiles: Profile[]
  businessEntities: BusinessEntity[]
  bonusItems: BonusItem[]
  employeeCards: EmployeeCard[]
}

type TabType = 'employee' | 'freelancer' | 'bonus_detail' | 'csv_import' | 'tax_report'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const TAB_LABELS: Record<TabType, string> = { employee: '직원 급여', freelancer: '프리랜서', bonus_detail: '상여 세부내역', csv_import: 'CSV 임포트', tax_report: '세금 리포트' }

function fmt(n: number) { return n.toLocaleString() }
function maskId(id: string | null) {
  if (!id) return '-'
  const clean = id.replace(/[^0-9]/g, '')
  if (clean.length < 7) return id
  return clean.slice(0, 6) + '-' + '*'.repeat(7)
}
function calcGross(r: PayrollRecord) {
  return r.base_salary + r.meal_allowance + r.mileage_allowance + r.allowances + r.fixed_bonus + r.bonus - r.unpaid_leave
}
function calcDeductions(r: PayrollRecord) {
  return r.national_pension + r.health_insurance + r.employment_insurance + r.income_tax
}

// ── 공제 자동계산 (2025 기준) ─────────────────────────────
function calcIncomeTax(monthlyTaxable: number, dependents: number): number {
  if (monthlyTaxable <= 0) return 0
  const annual = monthlyTaxable * 12
  // 근로소득공제
  let wageDeduction: number
  if (annual <= 5_000_000) wageDeduction = annual * 0.7
  else if (annual <= 15_000_000) wageDeduction = 3_500_000 + (annual - 5_000_000) * 0.4
  else if (annual <= 45_000_000) wageDeduction = 7_500_000 + (annual - 15_000_000) * 0.15
  else if (annual <= 100_000_000) wageDeduction = 12_000_000 + (annual - 45_000_000) * 0.05
  else wageDeduction = 14_750_000
  const earned = annual - wageDeduction
  // 기본공제 (본인 포함)
  const basicDeduction = 1_500_000 * (1 + Math.max(0, dependents))
  const taxBase = Math.max(0, earned - basicDeduction)
  // 산출세액
  let tax: number
  if (taxBase <= 14_000_000) tax = taxBase * 0.06
  else if (taxBase <= 50_000_000) tax = 840_000 + (taxBase - 14_000_000) * 0.15
  else if (taxBase <= 88_000_000) tax = 6_240_000 + (taxBase - 50_000_000) * 0.24
  else if (taxBase <= 150_000_000) tax = 15_360_000 + (taxBase - 88_000_000) * 0.35
  else if (taxBase <= 300_000_000) tax = 37_060_000 + (taxBase - 150_000_000) * 0.38
  else if (taxBase <= 500_000_000) tax = 94_060_000 + (taxBase - 300_000_000) * 0.40
  else tax = 174_060_000 + (taxBase - 500_000_000) * 0.42
  // 근로소득세액공제
  let taxCredit = tax <= 1_300_000 ? tax * 0.55 : 715_000 + (tax - 1_300_000) * 0.30
  const creditLimit = annual <= 33_000_000 ? 740_000
    : annual <= 70_000_000 ? 740_000 - (annual - 33_000_000) * 0.008
    : 66_000
  taxCredit = Math.min(taxCredit, creditLimit)
  return Math.round(Math.max(0, (tax - taxCredit) / 12) / 10) * 10
}

function autoCalcDeductions(f: typeof EMPTY_FORM, dependents: number) {
  const mealTaxFree = Math.min(f.meal_allowance, 200_000)
  const mileageTaxFree = Math.min(f.mileage_allowance, 200_000)
  // 과세급여 (보험료 부과 기준)
  const taxable = f.base_salary + (f.meal_allowance - mealTaxFree)
    + (f.mileage_allowance - mileageTaxFree) + f.allowances + f.fixed_bonus - f.unpaid_leave
  // 총급여 (고용보험 부과 기준 — 비과세 포함)
  const total = f.base_salary + f.meal_allowance + f.mileage_allowance + f.allowances + f.fixed_bonus - f.unpaid_leave
  const pension = Math.round(taxable * 0.045 / 10) * 10
  const healthBase = Math.round(taxable * 0.03545 / 10) * 10
  const longTermCare = Math.round(healthBase * 0.1295 / 10) * 10
  const health = healthBase + longTermCare
  const employment = Math.round(total * 0.009 / 10) * 10
  const incomeTax = calcIncomeTax(taxable, dependents)
  return { pension, health, employment, incomeTax }
}

const EMPTY_FORM = {
  id: '', year: CURRENT_YEAR, month: new Date().getMonth() + 1,
  employee_name: '', employee_type: 'employee' as TabType,
  business_entity: '', profile_id: null as string | null,
  base_salary: 0, meal_allowance: 0, mileage_allowance: 0, allowances: 0,
  fixed_bonus: 0, bonus: 0, unpaid_leave: 0,
  national_pension: 0, health_insurance: 0, employment_insurance: 0, income_tax: 0,
  resident_id: '', bank_info: '', payment_confirmed: false, payment_date: '', description: '', memo: '',
}

function ExportButton({ filterYear, filterMonth }: { filterYear: number; filterMonth: number | 'all' }) {
  const now = new Date()
  const [year, setYear] = useState(filterYear)
  const [month, setMonth] = useState<number>(filterMonth === 'all' ? now.getMonth() + 1 : filterMonth)
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/export/monthly?year=${year}&month=${month}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${year}년${month}월_세무자료.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('다운로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white">
      <select value={year} onChange={e => setYear(Number(e.target.value))}
        className="text-xs text-gray-600 focus:outline-none bg-transparent">
        {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      <select value={month} onChange={e => setMonth(Number(e.target.value))}
        className="text-xs text-gray-600 focus:outline-none bg-transparent">
        {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
      </select>
      <button onClick={handleDownload} disabled={loading}
        className="flex items-center gap-1 text-xs text-gray-600 hover:text-yellow-700 transition-colors disabled:opacity-50 whitespace-nowrap">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {loading ? '생성 중...' : '세무자료'}
      </button>
    </div>
  )
}

export default function PayrollClient({ payroll, profiles, businessEntities, bonusItems: initialBonusItems, employeeCards: initialCards }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [tab, setTab] = useState<TabType>('employee')
  const [filterBiz, setFilterBiz] = useState('all')
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [showBizManager, setShowBizManager] = useState(false)
  const [newBizName, setNewBizName] = useState('')
  const [bizSaving, setBizSaving] = useState(false)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())
  const [showResidentId, setShowResidentId] = useState(false)
  const [dependents, setDependents] = useState(0)

  // 직원 카드 (급여설정은 /admin에서, 여기선 월급여 생성 + 상여 드롭다운에만 사용)
  const [cards] = useState(initialCards)
  const [generating, setGenerating] = useState(false)

  // 상여 세부항목
  const [bonusItems, setBonusItems] = useState(initialBonusItems)
  const [showBonusForm, setShowBonusForm] = useState(false)
  const [bonusForm, setBonusForm] = useState({ id: '', year: CURRENT_YEAR, month: new Date().getMonth() + 1, employee_name: '', business_entity: '', date: '', description: '', detail: '', amount: 0 })
  const [bonusSaving, setBonusSaving] = useState(false)
  const [overtimeHours, setOvertimeHours] = useState('')

  const normalizeType = (t: string): TabType =>
    t === 'freelancer' ? 'freelancer' : 'employee'

  const filtered = (['employee', 'freelancer'] as TabType[]).includes(tab) ? payroll.filter(r => {
    if (normalizeType(r.employee_type) !== tab) return false
    if (filterBiz !== 'all' && r.business_entity !== filterBiz) return false
    if (r.year !== filterYear) return false
    if (filterMonth !== 'all' && r.month !== filterMonth) return false
    return true
  }) : []

  const filteredBonusItems = bonusItems.filter(b => {
    if (filterBiz !== 'all' && b.business_entity !== filterBiz) return false
    if (b.year !== filterYear) return false
    if (filterMonth !== 'all' && b.month !== filterMonth) return false
    return true
  })

  const summary = (() => {
    if (tab === 'bonus_detail') {
      const total = filteredBonusItems.reduce((s, b) => s + b.amount, 0)
      return [
        { label: '상여 항목 수', value: filteredBonusItems.length, color: 'text-gray-900' },
        { label: '총 상여금액', value: total, color: 'text-yellow-700' },
        { label: '', value: 0, color: '' },
      ]
    }
    if (tab === 'employee') {
      const gross = filtered.reduce((s, r) => s + calcGross(r), 0)
      const ded = filtered.reduce((s, r) => s + calcDeductions(r), 0)
      return [
        { label: '총 지급액', value: gross, color: 'text-gray-900' },
        { label: '총 공제액', value: ded, color: 'text-red-500' },
        { label: '총 실수령액', value: gross - ded, color: 'text-green-600' },
      ]
    }
    if (tab === 'freelancer') {
      const total = filtered.reduce((s, r) => s + r.base_salary, 0)
      const tax = filtered.reduce((s, r) => s + r.income_tax, 0)
      return [
        { label: '총 지급액', value: total, color: 'text-gray-900' },
        { label: '총 원천징수', value: tax, color: 'text-red-500' },
        { label: '총 실수령액', value: total - tax, color: 'text-green-600' },
      ]
    }
    return [
      { label: '', value: 0, color: '' },
      { label: '', value: 0, color: '' },
      { label: '', value: 0, color: '' },
    ]
  })()

  async function handleGenerate() {
    const month = filterMonth === 'all' ? new Date().getMonth() + 1 : filterMonth
    if (!confirm(`${filterYear}년 ${month}월 급여를 직원 카드에서 생성할까요?\n이미 입력된 직원은 건너뜁니다.`)) return
    setGenerating(true)
    const result = await generateMonthlyFromCards(filterYear, month)
    setGenerating(false)
    if (result.created === 0) {
      alert('모든 직원의 급여가 이미 입력되어 있습니다.')
    } else {
      alert(`${result.created}명 생성 완료${result.skipped ? ` (${result.skipped}명은 이미 존재)` : ''}`)
    }
    startTransition(() => router.refresh())
  }

  function openNew() {
    setForm({ ...EMPTY_FORM, employee_type: tab === 'bonus_detail' ? 'employee' : tab })
    setShowResidentId(false)
    setShowModal(true)
  }

  function openEdit(r: PayrollRecord) {
    setForm({
      id: r.id, year: r.year, month: r.month,
      employee_name: r.employee_name,
      employee_type: normalizeType(r.employee_type),
      business_entity: r.business_entity ?? '',
      profile_id: r.profile_id,
      base_salary: r.base_salary, meal_allowance: r.meal_allowance,
      mileage_allowance: r.mileage_allowance, allowances: r.allowances,
      fixed_bonus: r.fixed_bonus, bonus: r.bonus, unpaid_leave: r.unpaid_leave,
      national_pension: r.national_pension, health_insurance: r.health_insurance,
      employment_insurance: r.employment_insurance, income_tax: r.income_tax,
      resident_id: r.resident_id ?? '',
      bank_info: (r as any).bank_info ?? '',
      payment_confirmed: r.payment_confirmed,
      payment_date: r.payment_date ?? '',
      description: r.description ?? '', memo: r.memo ?? '',
    })
    setShowResidentId(false)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.employee_name.trim()) return alert('이름을 입력해주세요.')
    setSaving(true)
    await upsertPayroll({
      ...(form.id ? { id: form.id } : {}),
      year: form.year, month: form.month,
      employee_name: form.employee_name, employee_type: form.employee_type,
      business_entity: form.business_entity || null,
      profile_id: form.profile_id || null,
      base_salary: form.base_salary, meal_allowance: form.meal_allowance,
      mileage_allowance: form.mileage_allowance, allowances: form.allowances,
      fixed_bonus: form.fixed_bonus, bonus: form.bonus, unpaid_leave: form.unpaid_leave,
      national_pension: form.national_pension, health_insurance: form.health_insurance,
      employment_insurance: form.employment_insurance, income_tax: form.income_tax,
      resident_id: form.resident_id || null,
      bank_info: form.bank_info || null,
      payment_confirmed: form.payment_confirmed,
      payment_date: form.payment_date || null,
      description: form.description || null, memo: form.memo || null,
    })
    setSaving(false)
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠어요?')) return
    await deletePayroll(id)
  }

  async function handleAddBiz() {
    if (!newBizName.trim()) return
    setBizSaving(true)
    await upsertBusinessEntity({ name: newBizName.trim() })
    setNewBizName('')
    setBizSaving(false)
  }

  async function handleDeleteBiz(id: string) {
    if (!confirm('사업자를 삭제하시겠어요?')) return
    await deleteBusinessEntity(id)
  }

  async function handleBonusSave() {
    if (!bonusForm.employee_name.trim() || !bonusForm.description.trim()) return alert('직원명과 내용을 입력해주세요.')
    setBonusSaving(true)
    await upsertBonusItem({
      ...(bonusForm.id ? { id: bonusForm.id } : {}),
      year: bonusForm.year, month: bonusForm.month,
      employee_name: bonusForm.employee_name,
      business_entity: bonusForm.business_entity || null,
      date: bonusForm.date || null,
      description: bonusForm.description,
      detail: bonusForm.detail || null,
      amount: bonusForm.amount,
    })
    setBonusSaving(false)
    setShowBonusForm(false)
    setBonusForm({ id: '', year: CURRENT_YEAR, month: new Date().getMonth() + 1, employee_name: '', business_entity: '', date: '', description: '', detail: '', amount: 0 })
  }

  async function handleBonusDelete(id: string) {
    if (!confirm('삭제하시겠어요?')) return
    await deleteBonusItem(id)
    setBonusItems(prev => prev.filter(b => b.id !== id))
  }

  function toggleRevealId(id: string) {
    setRevealedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const numF = (key: keyof typeof form) => ({
    value: (form[key] as number) === 0 ? '' : (form[key] as number).toLocaleString(),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })),
  })

  function autoWithholding() {
    setForm(f => ({ ...f, income_tax: Math.round(f.base_salary * 0.033) }))
  }

  const isFree = form.employee_type === 'freelancer'

  const netInForm = isFree
    ? form.base_salary - form.income_tax
    : form.base_salary + form.meal_allowance + form.mileage_allowance + form.allowances + form.fixed_bonus + form.bonus - form.unpaid_leave - form.national_pension - form.health_insurance - form.employment_insurance - form.income_tax

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '-'

  return (
    <>
      {/* 상단 필터 */}
      <div className="flex items-start gap-2 mb-5 flex-wrap">
        <div className="flex gap-2 flex-wrap flex-1">
          <select value={filterBiz} onChange={e => setFilterBiz(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700">
            <option value="all">전체 사업자</option>
            {businessEntities.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700">
            {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700">
            <option value="all">전체 월</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <ExportButton filterYear={filterYear} filterMonth={filterMonth} />
          <button onClick={() => setShowBizManager(v => !v)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            🏢 사업자 관리
          </button>
          <button onClick={openNew}
            className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap hover:opacity-80 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            + 추가
          </button>
        </div>
      </div>

      {/* 사업자 관리 패널 */}
      {showBizManager && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">사업자 목록</p>
          <div className="flex gap-2 mb-3">
            <input value={newBizName} onChange={e => setNewBizName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddBiz()}
              placeholder="사업자명 입력"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            <button onClick={handleAddBiz} disabled={bizSaving}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              추가
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {businessEntities.length === 0 && <p className="text-sm text-gray-400">등록된 사업자가 없어요.</p>}
            {businessEntities.map(b => (
              <div key={b.id} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
                <span className="text-sm text-gray-700">{b.name}</span>
                <button onClick={() => handleDeleteBiz(b.id)} className="text-gray-400 hover:text-red-500 text-sm leading-none transition-colors">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {(['employee', 'freelancer', 'bonus_detail', 'csv_import', 'tax_report'] as TabType[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── CSV 임포트 탭 ── */}
      {tab === 'csv_import' && <CsvImportTab />}

      {/* ── 세금 리포트 탭 ── */}
      {tab === 'tax_report' && (
        <TaxReportTab payroll={payroll} businessEntities={businessEntities} />
      )}

      {/* 요약 카드 (직원/프리랜서/상여 탭만) */}
      {['employee', 'freelancer', 'bonus_detail'].includes(tab) && (
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-5">
          {summary.map(item => (
            <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
              <p className="text-xs text-gray-500 mb-1.5">{item.label}</p>
              <p className={`text-lg md:text-xl font-bold ${item.color}`}>{fmt(item.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── 직원 급여 테이블 ── */}
      {tab === 'employee' && (
        <div>
          <div className="flex items-center justify-between mb-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-sm text-blue-700">
              {cards.filter(c => c.is_active).length > 0
                ? `직원 ${cards.filter(c => c.is_active).length}명 설정됨 — 이달 급여를 자동 생성할 수 있습니다.`
                : '직원 급여설정은 팀원 관리 → 직원 선택 → 급여설정 탭에서 합니다.'}
            </p>
            {cards.filter(c => c.is_active).length > 0 && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-sm px-4 py-1.5 rounded-lg font-semibold disabled:opacity-50 whitespace-nowrap ml-4 hover:opacity-80 transition-all"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {generating ? '생성 중...' : `${filterYear}년 ${filterMonth === 'all' ? new Date().getMonth() + 1 : filterMonth}월 급여 생성`}
              </button>
            )}
          </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['사업자','년/월','직원명','기본급','식대','자가운전','고정상여','상여금','무급휴가','총지급액','공제합계','실수령액','지급일','확인',''].map(h => (
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-3 py-3.5 ${h === '' ? '' : h === '총지급액' || h === '공제합계' || h === '실수령액' || h === '기본급' || h === '식대' || h === '자가운전' || h === '고정상여' || h === '상여금' || h === '무급휴가' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="py-14 text-center text-sm text-gray-400">직원 급여 기록이 없어요.</td></tr>
                )}
                {filtered.map(r => {
                  const gross = calcGross(r)
                  const ded = calcDeductions(r)
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{r.business_entity || '-'}</td>
                      <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{r.year}.{String(r.month).padStart(2,'0')}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{r.employee_name}</td>
                      <td className="px-3 py-3 text-right text-sm text-gray-700">{r.base_salary > 0 ? fmt(r.base_salary) : '-'}</td>
                      <td className="px-3 py-3 text-right text-sm text-gray-600">{r.meal_allowance > 0 ? fmt(r.meal_allowance) : '-'}</td>
                      <td className="px-3 py-3 text-right text-sm text-gray-600">{r.mileage_allowance > 0 ? fmt(r.mileage_allowance) : '-'}</td>
                      <td className="px-3 py-3 text-right text-sm text-gray-600">{r.fixed_bonus > 0 ? fmt(r.fixed_bonus) : '-'}</td>
                      <td className="px-3 py-3 text-right text-sm text-gray-600">{r.bonus > 0 ? fmt(r.bonus) : '-'}</td>
                      <td className="px-3 py-3 text-right text-sm text-red-400">{r.unpaid_leave > 0 ? `-${fmt(r.unpaid_leave)}` : '-'}</td>
                      <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900">{fmt(gross)}</td>
                      <td className="px-3 py-3 text-right text-sm text-red-500">-{fmt(ded)}</td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-green-600">{fmt(gross - ded)}</td>
                      <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(r.payment_date)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.payment_confirmed ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          {r.payment_confirmed ? '완료' : '미지급'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(r)} className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-800 transition-colors">수정</button>
                          <button onClick={() => handleDelete(r.id)} className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">삭제</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* ── 프리랜서 테이블 ── */}
      {tab === 'freelancer' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3.5">사업자</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3.5">정산월</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3.5">프리랜서명</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3.5">업무내용</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3.5">주민등록번호</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3.5">계좌번호</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3.5">지급액</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3.5">원천징수</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3.5">실수령액</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3.5">지급일</th>
                  <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3.5">확인</th>
                  <th className="px-3 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={12} className="py-14 text-center text-sm text-gray-400">프리랜서 내역이 없어요.</td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-xs text-gray-500">{r.business_entity || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{r.year}.{String(r.month).padStart(2,'0')}</td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{r.employee_name}</td>
                    <td className="px-3 py-3 text-sm text-gray-500 max-w-[140px] truncate">{r.description || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs">
                          {r.resident_id ? (revealedIds.has(r.id) ? r.resident_id : maskId(r.resident_id)) : '-'}
                        </span>
                        {r.resident_id && (
                          <button onClick={() => toggleRevealId(r.id)}
                            className="text-xs text-gray-400 hover:text-gray-600">
                            {revealedIds.has(r.id) ? '🙈' : '👁'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400 max-w-[160px] truncate">{(r as any).bank_info || '-'}</td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900">{fmt(r.base_salary)}</td>
                    <td className="px-3 py-3 text-right text-sm text-red-500">-{fmt(r.income_tax)}</td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-green-600">{fmt(r.base_salary - r.income_tax)}</td>
                    <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(r.payment_date)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.payment_confirmed ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {r.payment_confirmed ? '완료' : '미지급'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(r)} className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-800 transition-colors">수정</button>
                        <button onClick={() => handleDelete(r.id)} className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 상여금 테이블 ── */}
      {/* ── 상여 세부내역 탭 ── */}
      {tab === 'bonus_detail' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">상여 세부내역</p>
            <button onClick={() => { setBonusForm({ id: '', year: filterYear, month: filterMonth === 'all' ? new Date().getMonth() + 1 : filterMonth, employee_name: '', business_entity: filterBiz === 'all' ? '' : filterBiz, date: '', description: '', detail: '', amount: 0 }); setShowBonusForm(true) }}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-80 transition-all"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              + 항목 추가
            </button>
          </div>

          {showBonusForm && (
            <div className="px-5 py-4 border-b border-yellow-100 bg-yellow-50/40 space-y-3">
              {/* 직원 + 월 선택 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">직원 *</label>
                  <select
                    value={bonusForm.employee_name}
                    onChange={e => {
                      const name = e.target.value
                      const card = cards.find(c => c.employee_name === name)
                      setBonusForm(f => ({
                        ...f,
                        employee_name: name,
                        business_entity: card?.business_entity ?? f.business_entity,
                      }))
                    }}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
                  >
                    <option value="">직원 선택</option>
                    {cards.filter(c => c.is_active).map(c => (
                      <option key={c.id} value={c.employee_name}>{c.employee_name}</option>
                    ))}
                    {/* 카드에 없는 이름도 직접 입력 가능하도록 */}
                    {bonusForm.employee_name && !cards.some(c => c.employee_name === bonusForm.employee_name) && (
                      <option value={bonusForm.employee_name}>{bonusForm.employee_name} (직접입력)</option>
                    )}
                  </select>
                </div>
                <div className="flex gap-2">
                  <select value={bonusForm.year} onChange={e => setBonusForm(f => ({ ...f, year: Number(e.target.value) }))}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white">
                    {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                  </select>
                  <select value={bonusForm.month} onChange={e => setBonusForm(f => ({ ...f, month: Number(e.target.value) }))}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white">
                    {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
                  </select>
                </div>
              </div>
              {/* 시급 헬퍼 */}
              {(() => {
                const card = cards.find(c => c.employee_name === bonusForm.employee_name)
                if (!card?.hourly_rate) return null
                const overtime = Math.round(card.hourly_rate * 1.5)
                const calcAmount = overtimeHours ? Math.round(overtime * Number(overtimeHours)) : null
                return (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex-wrap">
                    <span className="text-xs text-blue-500">시급 {fmt(card.hourly_rate)}원</span>
                    <span className="text-xs text-blue-400">/ 추가수당 {fmt(overtime)}원/h</span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <input
                        type="number" placeholder="시간"
                        value={overtimeHours}
                        onChange={e => {
                          setOvertimeHours(e.target.value)
                          const h = Number(e.target.value)
                          if (h > 0) setBonusForm(f => ({ ...f, amount: Math.round(overtime * h) }))
                        }}
                        className="w-16 px-2 py-1 border border-blue-200 rounded-lg text-xs text-center focus:outline-none focus:border-blue-400 bg-white"
                      />
                      <span className="text-xs text-blue-400">시간</span>
                      {calcAmount !== null && (
                        <span className="text-xs font-semibold text-blue-700">= {fmt(calcAmount)}원</span>
                      )}
                    </div>
                  </div>
                )
              })()}
              {/* 내용 + 날짜 */}
              <div className="grid grid-cols-2 gap-3">
                <input value={bonusForm.description} onChange={e => setBonusForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="내용 * (예: 행사 운영, 초과근무)"
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                <input value={bonusForm.detail} onChange={e => setBonusForm(f => ({ ...f, detail: e.target.value }))}
                  placeholder="세부내용 (예: 토요일 촬영 4시간)"
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              </div>
              {/* 금액 + 날짜 + 버튼 */}
              <div className="flex items-center gap-3 flex-wrap">
                <input type="date" value={bonusForm.date} onChange={e => setBonusForm(f => ({ ...f, date: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                  style={{ appearance: 'auto' } as React.CSSProperties} />
                <div className="flex items-center gap-1.5">
                  <input type="text" inputMode="numeric"
                    value={bonusForm.amount === 0 ? '' : bonusForm.amount.toLocaleString()}
                    onChange={e => setBonusForm(f => ({ ...f, amount: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 }))}
                    placeholder="금액"
                    className="w-36 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                  <span className="text-sm text-gray-400">원</span>
                </div>
                <button onClick={handleBonusSave} disabled={bonusSaving}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                  {bonusSaving ? '저장 중...' : bonusForm.id ? '수정' : '추가'}
                </button>
                <button onClick={() => setShowBonusForm(false)}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">취소</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['사업자','년/월','직원명','날짜','내용','세부내용','금액',''].map(h => (
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-3 py-3.5 ${h === '금액' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredBonusItems.length === 0 && (
                  <tr><td colSpan={8} className="py-14 text-center text-sm text-gray-400">상여 세부내역이 없어요. + 항목 추가로 기록하세요.</td></tr>
                )}
                {filteredBonusItems.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-xs text-gray-500">{b.business_entity || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{b.year}.{String(b.month).padStart(2,'0')}</td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{b.employee_name}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{b.date ? new Date(b.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{b.description}</td>
                    <td className="px-3 py-3 text-xs text-gray-400 max-w-[160px] truncate">{b.detail || '-'}</td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900">{b.amount.toLocaleString()}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button onClick={() => { setBonusForm({ id: b.id, year: b.year, month: b.month, employee_name: b.employee_name, business_entity: b.business_entity ?? '', date: b.date ?? '', description: b.description, detail: b.detail ?? '', amount: b.amount }); setShowBonusForm(true) }}
                          className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-800 transition-colors">수정</button>
                        <button onClick={() => handleBonusDelete(b.id)}
                          className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 입력 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                {form.id ? '수정' : TAB_LABELS[form.employee_type as TabType] + ' 추가'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* 유형 선택 (신규) */}
              {!form.id && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">유형</label>
                  <div className="flex gap-2">
                    {(['employee', 'freelancer'] as TabType[]).map(t => (
                      <button key={t} onClick={() => setForm(f => ({ ...f, employee_type: t }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.employee_type === t ? 'border-yellow-400' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                        style={form.employee_type === t ? { backgroundColor: '#FFFBEB', color: '#92400E' } : {}}>
                        {TAB_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 사업자 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">사업자</label>
                <select value={form.business_entity} onChange={e => setForm(f => ({ ...f, business_entity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 text-gray-700">
                  <option value="">선택 안 함</option>
                  {businessEntities.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>

              {/* 년/월 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{isFree ? '정산 년도' : '년도'}</label>
                  <select value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400">
                    {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{isFree ? '정산 월' : '월'}</label>
                  <select value={form.month} onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400">
                    {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
                  </select>
                </div>
              </div>

              {/* 이름 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{isFree ? '프리랜서명 *' : '직원명 *'}</label>
                <input value={form.employee_name} onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))}
                  placeholder="이름 입력"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              </div>

              {/* 업무내용 (프리랜서) */}
              {isFree && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">업무내용</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="예: 영상편집, 디자인"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                </div>
              )}

              {/* 주민등록번호 (프리랜서) */}
              {isFree && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">주민등록번호</label>
                  <div className="relative">
                    <input
                      type={showResidentId ? 'text' : 'password'}
                      value={form.resident_id}
                      onChange={e => setForm(f => ({ ...f, resident_id: e.target.value }))}
                      placeholder="000000-0000000"
                      className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400"
                    />
                    <button type="button" onClick={() => setShowResidentId(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                      {showResidentId ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── 직원 급여 항목 ── */}
              {!isFree && (
                <>
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-700 mb-3">지급 항목</p>
                    <div className="space-y-2.5">
                      {[
                        { label: '기본급', key: 'base_salary' as const },
                        { label: '식대', key: 'meal_allowance' as const },
                        { label: '자가운전보조금', key: 'mileage_allowance' as const },
                        { label: '고정상여', key: 'fixed_bonus' as const },
                        { label: '상여금', key: 'bonus' as const },
                        { label: '기타수당', key: 'allowances' as const },
                      ].map(({ label, key }) => (
                        <div key={key} className="flex items-center gap-3">
                          <label className="text-sm text-gray-600 w-24 flex-shrink-0">{label}</label>
                          <input type="text" inputMode="numeric" {...numF(key)}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                          <span className="text-xs text-gray-400 w-4">원</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-700">공제 항목</p>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">부양가족</label>
                        <select
                          value={dependents}
                          onChange={e => setDependents(Number(e.target.value))}
                          className="text-xs px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400 bg-white"
                        >
                          {[0,1,2,3,4,5].map(n => (
                            <option key={n} value={n}>{n}명{n === 0 ? ' (본인만)' : ''}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const { pension, health, employment, incomeTax } = autoCalcDeductions(form, dependents)
                            setForm(f => ({ ...f, national_pension: pension, health_insurance: health, employment_insurance: employment, income_tax: incomeTax }))
                          }}
                          className="text-xs px-3 py-1 rounded-lg font-semibold hover:opacity-80 transition-all"
                          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
                        >자동계산</button>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: '국민연금', key: 'national_pension' as const },
                        { label: '건강보험', key: 'health_insurance' as const },
                        { label: '고용보험', key: 'employment_insurance' as const },
                        { label: '소득세', key: 'income_tax' as const },
                        { label: '무급휴가', key: 'unpaid_leave' as const },
                      ].map(({ label, key }) => (
                        <div key={key} className="flex items-center gap-3">
                          <label className="text-sm text-gray-600 w-24 flex-shrink-0">{label}</label>
                          <input type="text" inputMode="numeric" {...numF(key)}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                          <span className="text-xs text-gray-400 w-4">원</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">* 자동계산은 2025년 기준 추정값. 세무사 확인 후 수정 가능합니다.</p>
                  </div>
                </>
              )}

              {/* 계좌번호 (프리랜서) */}
              {isFree && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">계좌번호</label>
                  <input
                    value={form.bank_info}
                    onChange={e => setForm(f => ({ ...f, bank_info: e.target.value }))}
                    placeholder="예: 국민은행 123456-78-901234"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                  />
                </div>
              )}

              {/* ── 프리랜서 금액 ── */}
              {isFree && (
                <div className="border-t border-gray-100 pt-4 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 w-24 flex-shrink-0">지급액 *</label>
                    <input type="text" inputMode="numeric" {...numF('base_salary')}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                    <span className="text-xs text-gray-400 w-4">원</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 w-24 flex-shrink-0">원천징수</label>
                    <input type="text" inputMode="numeric" {...numF('income_tax')}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                    <span className="text-xs text-gray-400 w-4">원</span>
                  </div>
                  <button type="button" onClick={autoWithholding}
                    className="text-xs text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-lg hover:bg-yellow-100 transition-colors">
                    3.3% 자동 계산
                  </button>
                </div>
              )}


              {/* 실수령액 요약 */}
              <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">실수령액</span>
                <span className="text-base font-bold text-green-600">{fmt(Math.max(0, netInForm))}원</span>
              </div>

              {/* 지급일 + 지급확인 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">지급일</label>
                  <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input type="checkbox" checked={form.payment_confirmed}
                      onChange={e => setForm(f => ({ ...f, payment_confirmed: e.target.checked }))}
                      className="w-4 h-4 rounded accent-yellow-400" />
                    <span className="text-sm text-gray-700 font-medium">지급 완료</span>
                  </label>
                </div>
              </div>

              {/* 시스템 계정 연결 (직원만) */}
              {!isFree && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">계정 연결 (선택)</label>
                  <select value={form.profile_id ?? ''} onChange={e => setForm(f => ({ ...f, profile_id: e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 text-gray-700">
                    <option value="">연결 안 함</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">메모</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  rows={2} placeholder="메모 (선택)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
