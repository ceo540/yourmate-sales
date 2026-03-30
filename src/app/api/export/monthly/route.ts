import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

type Row = (string | number | boolean | null)[]

function calcGross(r: any) {
  return (r.base_salary ?? 0) + (r.meal_allowance ?? 0) + (r.mileage_allowance ?? 0) +
    (r.allowances ?? 0) + (r.fixed_bonus ?? 0) + (r.bonus ?? 0) - (r.unpaid_leave ?? 0)
}
function calcDeductions(r: any) {
  return (r.national_pension ?? 0) + (r.health_insurance ?? 0) + (r.employment_insurance ?? 0) + (r.income_tax ?? 0)
}
function net33(amount: number) { return Math.round(amount * 0.967) }
function tax33(amount: number) { return Math.round(amount * 0.033) }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month) return NextResponse.json({ error: 'year, month 필요' }, { status: 400 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })

  const [{ data: payrollAll }, { data: entities }] = await Promise.all([
    supabase
      .from('payroll')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .order('employee_name'),
    supabase.from('business_entities').select('id, name').order('name'),
  ])

  const records = payrollAll ?? []
  const entityNames = (entities ?? []).map(e => e.name)

  // business_entity가 없는 경우도 수집
  const allEntityNames = Array.from(new Set([
    ...entityNames,
    ...records.map(r => r.business_entity).filter(Boolean),
  ])) as string[]

  const wb = XLSX.utils.book_new()

  // ── 시트 1: 세무자료 (구글시트 "2512" 형식) ──────────────
  const taxRows: Row[] = []

  for (const entityName of allEntityNames) {
    const entityRecords = records.filter(r => r.business_entity === entityName)
    const employees = entityRecords.filter(r => r.employee_type === 'employee')
    const freelancers = entityRecords.filter(r => r.employee_type === 'freelancer')

    if (employees.length === 0 && freelancers.length === 0) continue

    // 사업자 구분선
    taxRows.push([`■ ${entityName}`])
    taxRows.push([]) // 빈 줄

    // ── 직원 급여 섹션 ──
    if (employees.length > 0) {
      taxRows.push(['[직원 급여]'])
      taxRows.push([
        '이름', '지급액계', '기본급', '식대', '자가운전보조금',
        '상여', '무급공제', '국민연금', '건강보험', '고용보험', '소득세',
        '실지급액', '지급일', '비고',
      ])

      let sumGross = 0, sumDeductions = 0, sumNet = 0
      for (const r of employees) {
        const gross = calcGross(r)
        const deductions = calcDeductions(r)
        const netPay = gross - deductions
        sumGross += gross; sumDeductions += deductions; sumNet += netPay
        taxRows.push([
          r.employee_name,
          gross,
          r.base_salary ?? 0,
          r.meal_allowance ?? 0,
          r.mileage_allowance ?? 0,
          (r.fixed_bonus ?? 0) + (r.bonus ?? 0),
          r.unpaid_leave ?? 0,
          r.national_pension ?? 0,
          r.health_insurance ?? 0,
          r.employment_insurance ?? 0,
          r.income_tax ?? 0,
          netPay,
          r.payment_date ?? '',
          r.memo ?? r.description ?? '',
        ])
      }
      taxRows.push([
        '합계', sumGross, '', '', '', '', '', '', '', '', '', sumNet, '', '',
      ])
      taxRows.push([]) // 빈 줄
    }

    // ── 프리랜서 지급 섹션 ──
    if (freelancers.length > 0) {
      taxRows.push(['[프리랜서 지급]'])
      taxRows.push([
        '이름', '지급금액', '원천세(3.3%)', '실수령액',
        '주민등록번호', '계좌번호', '지급확인', '비고',
      ])

      let sumAmount = 0, sumTax = 0, sumNetF = 0
      for (const r of freelancers) {
        const amount = r.base_salary ?? 0
        const wtax = tax33(amount)
        const netF = net33(amount)
        sumAmount += amount; sumTax += wtax; sumNetF += netF
        taxRows.push([
          r.employee_name,
          amount,
          wtax,
          netF,
          r.resident_id ?? '',
          r.bank_info ?? '',
          r.payment_confirmed ? '확인' : '미확인',
          r.memo ?? '',
        ])
      }
      taxRows.push([
        '합계', sumAmount, sumTax, sumNetF, '', '', '', '',
      ])
      taxRows.push([]) // 빈 줄
    }

    taxRows.push([]) // 사업자 간 구분
  }

  const ws1 = XLSX.utils.aoa_to_sheet(taxRows)

  // 열 너비
  ws1['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, `${String(year).slice(2)}${String(month).padStart(2, '0')} 세무자료`)

  // ── 시트 2: 직원 상세 (사업자별 합산) ──────────────
  const empRows: Row[] = [[
    '사업자', '이름', '지급액계', '기본급', '식대', '자가운전보조금',
    '고정상여', '상여금', '무급공제', '국민연금', '건강보험', '고용보험',
    '소득세', '공제합계', '실지급액', '지급일', '비고',
  ]]
  const employees = records.filter(r => r.employee_type === 'employee')
  for (const r of employees) {
    const gross = calcGross(r)
    const deductions = calcDeductions(r)
    empRows.push([
      r.business_entity ?? '',
      r.employee_name,
      gross,
      r.base_salary ?? 0,
      r.meal_allowance ?? 0,
      r.mileage_allowance ?? 0,
      r.fixed_bonus ?? 0,
      r.bonus ?? 0,
      r.unpaid_leave ?? 0,
      r.national_pension ?? 0,
      r.health_insurance ?? 0,
      r.employment_insurance ?? 0,
      r.income_tax ?? 0,
      deductions,
      gross - deductions,
      r.payment_date ?? '',
      r.memo ?? r.description ?? '',
    ])
  }
  const ws2 = XLSX.utils.aoa_to_sheet(empRows)
  ws2['!cols'] = Array(17).fill({ wch: 13 })
  ws2['!cols'][1] = { wch: 12 }
  ws2['!cols'][16] = { wch: 20 }
  XLSX.utils.book_append_sheet(wb, ws2, '직원급여')

  // ── 시트 3: 프리랜서 상세 ──────────────
  const freeRows: Row[] = [[
    '사업자', '이름', '지급금액', '원천세(3.3%)', '실수령액',
    '주민등록번호', '계좌번호', '지급확인', '비고',
  ]]
  const freelancers = records.filter(r => r.employee_type === 'freelancer')
  for (const r of freelancers) {
    const amount = r.base_salary ?? 0
    freeRows.push([
      r.business_entity ?? '',
      r.employee_name,
      amount,
      tax33(amount),
      net33(amount),
      r.resident_id ?? '',
      r.bank_info ?? '',
      r.payment_confirmed ? '확인' : '미확인',
      r.memo ?? '',
    ])
  }
  const ws3 = XLSX.utils.aoa_to_sheet(freeRows)
  ws3['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, ws3, '프리랜서')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `${year}년${month}월_세무자료.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
