'use client'

import { useState } from 'react'
import { updatePermission } from '../actions'

const ALL_PERM_ROWS: { label: string; pageKey?: string; fixed?: { admin: string; manager: string; member: string } }[] = [
  { label: '대시보드',          pageKey: 'dashboard' },
  { label: '대시보드 자금잔고',  pageKey: 'dashboard_finance' },
  { label: '매출 현황',         pageKey: 'sales' },
  { label: '계약 목록',         pageKey: 'sales_report' },
  { label: '매출 등록/수정',    fixed: { admin: '전체', manager: '전체', member: '본인 건만' } },
  { label: '리드 관리',         pageKey: 'leads' },
  { label: '업무 관리',         pageKey: 'tasks' },
  { label: '미수금 현황',       pageKey: 'receivables' },
  { label: '거래처 DB',         pageKey: 'vendors' },
  { label: '지급 관리',         pageKey: 'payments' },
  { label: '매출 건 내부원가',  pageKey: 'cost_internal' },
  { label: '재무 현황',         fixed: { admin: '✓', manager: '어드민만', member: '어드민만' } },
  { label: '인건비 관리',       fixed: { admin: '✓', manager: '어드민만', member: '어드민만' } },
  { label: '고정비 관리',       fixed: { admin: '✓', manager: '어드민만', member: '어드민만' } },
  { label: '자금일보',          fixed: { admin: '✓', manager: '어드민만', member: '어드민만' } },
  { label: '팀원 관리',         fixed: { admin: '✓', manager: '어드민만', member: '어드민만' } },
]
const ROLES = [
  { role: 'manager', label: '팀장', color: 'bg-blue-100 text-blue-700' },
  { role: 'member',  label: '팀원/PM', color: 'bg-gray-100 text-gray-600' },
]
const LEVELS = [
  { value: 'off',  label: '끄기',  active: 'bg-gray-200 text-gray-600' },
  { value: 'read', label: '읽기',  active: 'bg-blue-100 text-blue-700' },
  { value: 'own',  label: '담당만', active: 'bg-yellow-100 text-yellow-800' },
  { value: 'full', label: '전체',  active: 'bg-green-100 text-green-700' },
]

interface Props {
  initialPerms: Record<string, Record<string, string>>
}

export default function PermissionsTab({ initialPerms }: Props) {
  const [perms, setPerms] = useState(initialPerms)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  async function handleLevelChange(role: string, pageKey: string, level: string) {
    const key = `${role}:${pageKey}`
    setTogglingKey(key)
    setPerms(prev => ({ ...prev, [role]: { ...prev[role], [pageKey]: level } }))
    await updatePermission(role, pageKey, level)
    setTogglingKey(null)
  }

  function LevelSelector({ role, pageKey }: { role: string; pageKey: string }) {
    const current = perms[role]?.[pageKey] ?? 'off'
    const busy = togglingKey === `${role}:${pageKey}`
    return (
      <div className={`inline-flex rounded-lg border border-gray-200 overflow-hidden ${busy ? 'opacity-50' : ''}`}>
        {LEVELS.map(lv => (
          <button
            key={lv.value}
            onClick={() => handleLevelChange(role, pageKey, lv.value)}
            disabled={busy}
            className={`px-2.5 py-1 text-xs font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
              current === lv.value ? lv.active : 'bg-white text-gray-400 hover:bg-gray-50'
            }`}
          >
            {lv.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">역할별 접근 권한</h2>
        <p className="text-xs text-gray-400 mt-1">토글로 켜고 끄면 즉시 적용돼요. 관리자는 항상 전체 접근이에요.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">메뉴</th>
              <th className="text-center text-xs font-semibold px-6 py-3">
                <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">관리자</span>
              </th>
              {ROLES.map(r => (
                <th key={r.role} className="text-center text-xs font-semibold px-6 py-3">
                  <span className={`px-2 py-1 rounded-full ${r.color}`}>{r.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {ALL_PERM_ROWS.map((row) => (
              <tr key={row.label} className="hover:bg-gray-50">
                <td className="px-6 py-3.5 text-sm text-gray-700">{row.label}</td>
                <td className="px-6 py-3.5 text-center">
                  {row.fixed
                    ? <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600 font-medium">{row.fixed.admin}</span>
                    : <span className="inline-flex h-5 w-9 items-center rounded-full bg-green-400 cursor-not-allowed opacity-60"><span className="inline-block h-3.5 w-3.5 translate-x-4 rounded-full bg-white shadow" /></span>
                  }
                </td>
                {ROLES.map(r => (
                  <td key={r.role} className="px-6 py-3.5 text-center">
                    {row.fixed
                      ? <span className={`text-xs px-2 py-1 rounded-full ${row.fixed[r.role as 'manager' | 'member'] === '어드민만' ? 'bg-red-50 text-red-400' : 'bg-gray-50 text-gray-500'}`}>{row.fixed[r.role as 'manager' | 'member']}</span>
                      : <LevelSelector role={r.role} pageKey={row.pageKey!} />
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 space-y-2">
        <p className="text-xs text-gray-400">변경 사항은 해당 역할 직원이 다음 페이지 이동 시 반영돼요.</p>
        <div className="text-xs text-gray-400 space-y-1 pt-1 border-t border-gray-200">
          <p className="font-medium text-gray-500">권한 단계 안내</p>
          <p><span className="font-medium text-gray-600">끄기</span> — 메뉴가 숨겨지고 접근이 차단돼요.</p>
          <p><span className="font-medium text-gray-600">담당만</span> — 팀원 관리에서 지정한 담당 사업부의 매출 건, 또는 본인이 직접 담당자로 지정된 건만 볼 수 있어요. 담당 사업부가 없으면 본인 건만 표시돼요.</p>
          <p><span className="font-medium text-gray-600">읽기</span> — 전체 데이터를 볼 수 있지만 수정은 불가해요.</p>
          <p><span className="font-medium text-gray-600">전체</span> — 전체 데이터를 보고 수정할 수 있어요.</p>
        </div>
      </div>
    </div>
  )
}
