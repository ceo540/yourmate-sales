'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importBankTransactions, autoMatchTransactions, type BankTxRow } from './bank-actions'

// ── CSV 파싱 ──────────────────────────────────────────────────────
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes }
    else if (line[i] === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += line[i] }
  }
  result.push(current)
  return result
}

function parseCsv(text: string): Record<string, string>[] {
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  const lines = clean.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() ?? '']))
  })
}

function mapRowToTx(row: Record<string, string>, importBatch: string): BankTxRow | null {
  const rawDate = row['일자'] ?? ''
  const txDate = rawDate.replace(/\./g, '-') // "2026.04.04" → "2026-04-04"
  if (!txDate || txDate.length < 10) return null
  const debit = parseFloat(row['지출(출금)']?.replace(/[^0-9.]/g, '') ?? '0') || 0
  const credit = parseFloat(row['입금']?.replace(/[^0-9.]/g, '') ?? '0') || 0
  const balance = parseFloat(row['거래후 잔액']?.replace(/[^0-9.]/g, '') ?? '0') || null

  return {
    tx_date: txDate,
    tx_time: row['시간'] || null,
    method: row['방법'] || null,
    account_no: (row['자산명'] ?? '').split('/')[0].trim() || null,
    description: row['사용처'] || null,
    debit, credit,
    tx_status: row['상태'] || null,
    category: row['계정과목'] || null,
    category_code: row['과목코드'] || null,
    company: row['회사'] || null,
    balance,
    counterparty: row['보낸분/받는분'] || null,
    transaction_type: row['거래구분'] || null,
    memo: row['적요'] || null,
    bank: row['기관'] || null,
    import_batch: importBatch,
  }
}

function fmt(n: number) { return n.toLocaleString() }

interface MatchResult { matched: number; total: number }

export default function CsvImportTab() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<BankTxRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importBatch, setImportBatch] = useState('')
  const [importing, setImporting] = useState(false)
  const [matching, setMatching] = useState(false)
  const [imported, setImported] = useState(false)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [filterCompany, setFilterCompany] = useState('all')
  const [matchYear, setMatchYear] = useState(new Date().getFullYear())
  const [matchMonth, setMatchMonth] = useState(new Date().getMonth() + 1)

  const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1]
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const batch = `${file.name}_${Date.now()}`
    setImportBatch(batch)
    setImported(false)
    setMatchResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCsv(text)
      const txRows = parsed.map(r => mapRowToTx(r, batch)).filter((r): r is BankTxRow => r !== null)
      setRows(txRows)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  async function handleImport() {
    if (!rows.length) return
    setImporting(true)
    try {
      await importBankTransactions(rows)
      setImported(true)
    } catch (e) {
      alert('임포트 중 오류: ' + (e as Error).message)
    }
    setImporting(false)
  }

  async function handleAutoMatch() {
    if (!importBatch) return
    setMatching(true)
    try {
      const result = await autoMatchTransactions(matchYear, matchMonth, importBatch)
      setMatchResult({ matched: result.matched, total: result.total ?? 0 })
      startTransition(() => router.refresh())
    } catch (e) {
      alert('매칭 중 오류: ' + (e as Error).message)
    }
    setMatching(false)
  }

  const companies = [...new Set(rows.map(r => r.company).filter(Boolean))] as string[]
  const displayRows = filterCompany === 'all' ? rows : rows.filter(r => r.company === filterCompany)

  const debitTotal = displayRows.filter(r => r.debit > 0).reduce((s, r) => s + r.debit, 0)
  const creditTotal = displayRows.filter(r => r.credit > 0).reduce((s, r) => s + r.credit, 0)
  const debitCount = displayRows.filter(r => r.debit > 0).length

  return (
    <div className="space-y-5">
      {/* 파일 업로드 */}
      <div
        className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-white hover:border-yellow-300 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        <p className="text-3xl mb-2">📄</p>
        <p className="text-sm font-medium text-gray-700 mb-1">그랜터 CSV 파일 업로드</p>
        <p className="text-xs text-gray-400">계좌_전체 (YYYY-MM-DD~YYYY-MM-DD).csv</p>
        {fileName && <p className="text-xs text-yellow-700 mt-2 font-medium">{fileName} 선택됨</p>}
      </div>

      {rows.length > 0 && (
        <>
          {/* 요약 + 회사 필터 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              <span className="text-xs px-3 py-1.5 bg-gray-100 rounded-full text-gray-600">
                총 {rows.length}건
              </span>
              <span className="text-xs px-3 py-1.5 bg-red-50 rounded-full text-red-600">
                출금 {debitCount}건 ({fmt(debitTotal)}원)
              </span>
              <span className="text-xs px-3 py-1.5 bg-green-50 rounded-full text-green-600">
                입금 {fmt(creditTotal)}원
              </span>
            </div>
            <div className="flex gap-1.5 ml-auto flex-wrap">
              {['all', ...companies].map(c => (
                <button key={c} onClick={() => setFilterCompany(c)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${filterCompany === c ? 'border-yellow-400 bg-yellow-50 text-gray-800' : 'border-gray-200 text-gray-500'}`}>
                  {c === 'all' ? '전체' : c}
                </button>
              ))}
            </div>
          </div>

          {/* 미리보기 테이블 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-100">
                    {['날짜', '회사', '거래처', '출금', '입금', '계정과목', '상태'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.slice(0, 100).map((row, i) => (
                    <tr key={i} className={`border-t border-gray-50 ${row.debit > 0 ? '' : 'opacity-50'}`}>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{row.tx_date}</td>
                      <td className="px-3 py-2 max-w-[120px] truncate text-gray-600">{row.company ?? '-'}</td>
                      <td className="px-3 py-2 max-w-[120px] truncate font-medium text-gray-800">{row.counterparty ?? '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-red-600 font-medium">
                        {row.debit > 0 ? fmt(row.debit) : ''}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-green-600">
                        {row.credit > 0 ? fmt(row.credit) : ''}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row.category ?? '-'}</td>
                      <td className="px-3 py-2">
                        {row.debit > 0
                          ? <span className="px-1.5 py-0.5 bg-red-50 text-red-500 rounded-full">출금</span>
                          : <span className="px-1.5 py-0.5 bg-green-50 text-green-500 rounded-full">입금</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayRows.length > 100 && (
                <p className="text-xs text-gray-400 text-center py-2">... 외 {displayRows.length - 100}건</p>
              )}
            </div>
          </div>

          {/* 임포트 + 매칭 */}
          {!imported ? (
            <div className="flex justify-end">
              <button onClick={handleImport} disabled={importing}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-50 hover:opacity-80 transition-all"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {importing ? '임포트 중...' : `${rows.length}건 DB 저장`}
              </button>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-700 mb-3">
                {rows.length}건 저장 완료. 아래에서 자동 매칭을 실행하세요.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">급여 대상 연월</span>
                  <select value={matchYear} onChange={e => setMatchYear(Number(e.target.value))}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-yellow-400">
                    {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                  </select>
                  <select value={matchMonth} onChange={e => setMatchMonth(Number(e.target.value))}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-yellow-400">
                    {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
                  </select>
                </div>
                <button onClick={handleAutoMatch} disabled={matching}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-green-300 bg-white text-green-700 hover:bg-green-100 disabled:opacity-50 transition-all">
                  {matching ? '매칭 중...' : '자동 매칭 실행'}
                </button>
              </div>

              {matchResult && (
                <div className={`mt-3 p-3 rounded-lg ${matchResult.matched > 0 ? 'bg-white border border-green-200' : 'bg-orange-50 border border-orange-100'}`}>
                  <p className="text-sm font-semibold">
                    {matchResult.matched > 0
                      ? `매칭 완료: ${matchResult.total}명 중 ${matchResult.matched}명 지급 확인됨`
                      : '자동 매칭된 항목이 없어요. 이름이 일치하지 않으면 급여 탭에서 수동으로 확인해주세요.'}
                  </p>
                  {matchResult.matched < matchResult.total && matchResult.matched > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {matchResult.total - matchResult.matched}명은 이름이 일치하지 않아 미매칭. 급여 탭에서 직접 확인하세요.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {rows.length === 0 && !fileName && (
        <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-500">
          <p className="font-medium text-gray-700 mb-2">사용 방법</p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500">
            <li>그랜터 → 내보내기 → 계좌_전체 CSV 다운로드</li>
            <li>위 영역에 파일 업로드</li>
            <li>내용 확인 후 DB 저장</li>
            <li>자동 매칭: 거래처명 ↔ 급여 대상자 이름 비교 → 지급 확인 자동 처리</li>
            <li>미매칭 건은 급여 탭에서 수동 확인</li>
          </ol>
        </div>
      )}
    </div>
  )
}
