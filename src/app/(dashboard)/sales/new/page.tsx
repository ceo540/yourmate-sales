// /sales/new는 더 이상 신규 등록 진입점이 아님.
// 새 프로젝트 생성은 /projects 에서, 새 매출(계약) 추가는 프로젝트 상세 [+ 새 매출] 에서.
// 옛날 링크/북마크 호환을 위해 /projects 로 자동 이동.

import { redirect } from 'next/navigation'

export default function NewSaleRedirect() {
  redirect('/projects')
}
