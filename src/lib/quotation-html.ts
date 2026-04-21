// 견적서 / 임대차 계약서 HTML 생성 라이브러리

export type RentalItem = {
  name: string
  detail?: string
  qty: number
  months: number
  price: number
}

export type RentalQuotationData = {
  docType: 'quotation' | 'contract'
  issueDate: string
  clientName: string
  clientAddress?: string
  manager?: string
  phone?: string
  rentalPeriod?: string
  items: RentalItem[]
  deliveryFee: number
  pickupFee: number
  deposit: number
  notes?: string
}

export type CategoryItem = {
  name: string
  detail?: string
  unit?: string
  qty: number
  price: number
}

export type Category = {
  name: string
  items: CategoryItem[]
}

export type CategoryQuotationData = {
  serviceType: 'school_store' | '002creative' | 'artqium' | 'sos' | 'other'
  issueDate: string
  clientName: string
  manager?: string
  validDays?: number
  categories: Category[]
  discount?: number
  notes?: string
}

// ── 유틸 ────────────────────────────────────────────────────────

function n2kr(n: number): string {
  if (!n) return '금 영원정'
  n = Math.floor(n)
  const units = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const tens = ['', '십', '백', '천']
  const mega = ['', '만', '억', '조']
  function g2k(g: number) {
    let s = ''
    for (let i = 3; i >= 0; i--) {
      const d = Math.floor(g / Math.pow(10, i)) % 10
      if (!d) continue
      s += (d === 1 && i > 0 ? '' : units[d]) + tens[i]
    }
    return s
  }
  let r = ''
  for (let i = 3; i >= 0; i--) {
    const g = Math.floor(n / Math.pow(10000, i)) % 10000
    if (!g) continue
    r += g2k(g) + mega[i]
  }
  return '금 ' + r + '원정'
}

function fmtDate(s: string) {
  const d = new Date(s)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function fmtNum(n: number) {
  return n.toLocaleString('ko-KR')
}

// ── 공통 CSS ────────────────────────────────────────────────────

const BASE_CSS = `
@page { size: A4 portrait; margin: 12mm 15mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: '맑은 고딕', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: 8.5pt; color: #000; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 0.5pt solid #555; padding: 3px 5px; vertical-align: middle; }
.bold { font-weight: bold; }
.center { text-align: center; }
.right { text-align: right; }
.bg-gray { background-color: #f0f0f0; }
.no-border-right { border-right: none; }
.no-border-left { border-left: none; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`

// ── 교구대여 (임대차 계약서 / 견적서) ──────────────────────────

const CONTRACT_TERMS = `
<div style="margin-top:14mm; font-size:7.5pt; line-height:1.7;">
  <p class="bold" style="font-size:9pt; text-align:center; margin-bottom:4mm;">유어메이트 이용약관</p>

  <p class="bold">제1장 총칙</p>

  <p class="bold">제1조 (목적)</p>
  <p>본 약관은 유어메이트(이하 "회사")가 제공하는 중고 악기 및 기자재 대여 서비스와 관련하여, 회사와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>

  <p class="bold" style="margin-top:3mm;">제2조 (용어의 정의)</p>
  <p>① "대여"란 회사가 임차인에게 회사가 정한 금액을 받고 약정된 계약기간 동안 대여물품을 임대하는 것</p>
  <p>② "대여제품"이란 악기, 교구, 기자재 등 회사가 대여를 목적으로 제공하는 모든 제품</p>
  <p>③ "대여기간"이란 회사와 임차인이 상호 약정한 사용기간으로, 출고일부터 반납 도착일까지의 전체 기간</p>
  <p>④ "대여일자 및 반납일자"는 출고일과 반납 도착일</p>
  <p>⑤ "대여금액"이란 임차인이 지불해야 하는 금액</p>
  <p>⑥ "보증금"이란 손상, 분실, 연체 등에 대비한 사전 수령 금액</p>

  <p class="bold" style="margin-top:3mm;">제3조 (약관의 명시와 개정)</p>
  <p>① 회사는 약관을 홈페이지 및 상품 페이지에 게시합니다.</p>
  <p>② 개정 약관은 공지 이후 신규 계약에 적용되며, 기존 계약은 이용자가 동의하지 않으면 기존 약관이 유지됩니다.</p>
  <p>③ 본 약관에서 정하지 않은 사항은 전자상거래법 등 관련 법령에 따릅니다.</p>

  <p class="bold" style="margin-top:3mm;">제4조 (서비스의 제공 및 변경)</p>
  <p>① 회사는 사양 변경, 예약 마감 등으로 계약 체결 전 제공 내용을 변경할 수 있습니다.</p>
  <p>② 계약 체결 후 변경은 사전 고지를 원칙으로 합니다.</p>
  <p>③ 서비스 내용 추가·변경으로 인한 손해는 배상하지 않습니다.</p>

  <p class="bold" style="margin-top:3mm;">제5조 (서비스의 중단)</p>
  <p>① 시스템 점검, 장애 등으로 일시적으로 중단될 수 있습니다.</p>
  <p>② 고의 또는 중과실 없는 경우 책임을 지지 않습니다.</p>

  <p class="bold" style="margin-top:3mm;">제2장 대여 계약</p>

  <p class="bold" style="margin-top:3mm;">제6조 (예약 신청)</p>
  <p>① 이용자는 홈페이지 또는 유선으로 실명·연락처를 제공하여 예약 신청할 수 있습니다.</p>
  <p>② 회사는 재고 부족, 허위 정보, 사용 지장 등의 사유로 거절할 수 있습니다.</p>

  <p class="bold" style="margin-top:3mm;">제7조 (예약의 취소)</p>
  <p>① 수령 예정 시간으로부터 2시간 이상 지연 또는 연락 불가 시 취소할 수 있습니다.</p>
  <p>② 임차조건 변경 시 회사 승인이 필요합니다.</p>

  <p class="bold" style="margin-top:3mm;">제8조 (계약의 성립)</p>
  <p>① 서명 및 전액 결제 시 계약이 성립합니다.</p>
  <p>② 회사는 신원 확인, 과거 체납 여부 등으로 거절할 수 있습니다.</p>

  <p class="bold" style="margin-top:3mm;">제9조 (대여기간의 연장)</p>
  <p>① 반납일 기준 최소 7일 전까지 요청해야 하며, 회사는 거절할 수 있습니다.</p>
  <p>② 사전 승인 없이 연장 시 1개월 기준 대여요금을 가산금으로 부과합니다.</p>

  <p class="bold" style="margin-top:3mm;">제10조 (대여계약의 해제)</p>
  <p>① 중도 해제 및 환불은 원칙적으로 불가하며, 예외적으로만 허용됩니다.</p>
  <p>② 중고 제품 특성상 재사용·재대여가 곤란함을 고려한 조치입니다.</p>

  <p class="bold" style="margin-top:3mm;">제11조 (대여요금의 결제)</p>
  <p>① 홈페이지 공시 기준에 따르며, 전액 결제 완료 시 확정됩니다.</p>
  <p>② 인수 이전까지 결제 미완료 시 계약이 미성립됩니다.</p>

  <p class="bold" style="margin-top:3mm;">제12조 (추가비용)</p>
  <p>① 임차인 요구로 발생한 추가 비용은 임차인이 부담합니다.</p>
  <p>② 무단 연장 시 제9조 기준 가산금을 청구합니다.</p>

  <p class="bold" style="margin-top:3mm;">제13조 (환급, 반품 및 교환)</p>
  <p>① 제품 이상 또는 전산 오류 시 계약 해제 및 전액 환불합니다.</p>
  <p>② 주문과 다르거나 파손 시 교환 또는 환불합니다.</p>
  <p>③ 임차인 책임 사유로 사용 불가능 시 교환만 가능합니다.</p>

  <p class="bold" style="margin-top:3mm;">제13조의2 (중고 렌탈 제품 고지 및 특수성 인정)</p>
  <p>① 모든 대여 제품은 중고 렌탈 품목입니다.</p>
  <p>② 임차인은 사용흔적, 외관 마모, 조율 상태 등의 특성을 인지하고 동의합니다.</p>
  <p>③ 청약철회는 전자상거래법 제17조 제2항에 의거 제한될 수 있습니다.</p>

  <p class="bold" style="margin-top:3mm;">제13조의3 (계약 해지 및 환불 기준 – 중고 렌탈 기준)</p>
  <p>① 출고 전 해지: 실비 제외 후 결제금액의 80% 환불</p>
  <p>② 출고 후 해지: 일할 계산한 대여료 차감 후 잔여금 환불</p>
  <p>③ 일할 계산: '1개월 기준 대여금액 ÷ 30일 × 사용일수'</p>
  <p>④ 왕복 배송비는 임차인 부담이며, 보증금에서 공제합니다.</p>
  <p>⑤ 손해·비용은 보증금에서 우선 공제하며, 부족 시 초과금을 납부해야 합니다.</p>
  <p>⑥ 손해 발생 시 공식 견적서 사전 통지 후 7일 내 이의 미제기 시 동의 간주합니다.</p>
  <p>⑦ 고객 귀책 반품은 선불 택배로 발송하며, 착불 발송 시 수취 거부 또는 배송비 공제 가능합니다.</p>
  <p>⑧ 회사 귀책 환불은 실사용 여부와 관계없이 전액 환불하며, 배송비는 회사가 부담합니다.</p>
  <p>⑨ 보증금은 제품 상태 확인 후 영업일 기준 7일 이내 정산·환불합니다.</p>

  <p class="bold" style="margin-top:3mm;">제3장 책임과 의무</p>

  <p class="bold" style="margin-top:3mm;">제14조 (회사의 책임과 의무)</p>
  <p>① 계약 이행에 필요한 최소 정보만 수집하며, 동의 없이 제3자에게 제공하지 않습니다.</p>
  <p>② 제품 고유 결함으로 사용 불능 시 환불 또는 대체품을 제공합니다.</p>

  <p class="bold" style="margin-top:3mm;">제15조 (임차인의 책임과 의무)</p>
  <p>① 허위 정보, 무단 사용, 전대, 개조 행위를 금지하며, 선량한 관리자로서 사용해야 합니다.</p>
  <p>② 책임 있는 손해 발생 시 수리비, 제품가 전액, 수리기간 대여료를 부담합니다.</p>
  <p>③ 수령 직후 구성품 확인 및 작동 점검은 임차인의 책임입니다.</p>
  <p>④ 고온·저온·습기·직사광선·분진·물기 환경 노출을 금지하며, 운반 시 제공 케이스 또는 포장재를 사용해야 합니다.</p>
  <p>⑤ 오염 발생 시(음식물·음료·유분·분진·색소·접착제 등) 세척·복원 또는 부품·제품 교체 비용이 청구되며, 보증금 미수령 계약도 임차인이 부담합니다.</p>

  <p class="bold" style="margin-top:3mm;">제15조의2 (택배 수령 및 제품 이상 고지 기준)</p>
  <p>① 수령 후 24시간 내 이상 고지 없을 시 이상 없음에 동의한 것으로 간주합니다.</p>
  <p>② 회사는 출고 전 상태 및 구성품을 기록·촬영합니다.</p>

  <p class="bold" style="margin-top:3mm;">제16조 (제품 반납)</p>
  <p>① 수령 및 반납 방식: (1)직접 수령·반납 (2)택배 (3)퀵서비스 (4)회사 직접 배송·수거</p>
  <p>② 운송비는 사전 정한 기준에 따라 부담하며, 반품 시 귀책 여부에 따라 보증금에서 공제할 수 있습니다.</p>
  <p>③ 회사 직접 수거 또는 퀵서비스 시 약속 장소·시간에 맞춰 인도 의무가 있으며, 불이행 시 연체로 간주하여 추가 요금이 부과됩니다.</p>
  <p>④ 48시간 이상 소재 불분명·무단 미반납 시 형사 고발 등 법적 조치가 가능합니다.</p>

  <p class="bold" style="margin-top:3mm;">제17조 (사고 처리)</p>
  <p>① 사고 발생 시 즉시 통보하고 필요 서류 제출·협조 의무가 있습니다.</p>
  <p>② 파손 장비는 회사 판단에 따라 A/S 또는 사설 수리 업체에 의뢰하며, 비용은 임차인이 부담합니다.</p>
  <p>③ 회사 지정 포장 방식 변경을 금지하며, 포장 불량으로 인한 손해는 임차인의 책임이고, 사고 경위 자료 제출 의무가 있습니다.</p>

  <p class="bold" style="margin-top:3mm;">제18조 (분쟁 해결)</p>
  <p>① 정당한 불만은 신속히 처리하며, 불가 시 사유 및 일정을 안내합니다.</p>
  <p>② 우선 회사와 협의하며, 해결 불가 시 한국소비자원 조정 신청이 가능합니다.</p>

  <p class="bold" style="margin-top:3mm;">제19조 (재판권 및 준거법)</p>
  <p>① 분쟁은 경기도 고양시 관할법원(의정부지방법원 고양지원)을 제1심 전속 관할로, 대한민국 법을 준거법으로 합니다.</p>

  <p class="bold" style="margin-top:3mm;">제20조 (국문과 영문의 해석)</p>
  <p>① 상이 시 국문 약관이 우선합니다.</p>

  <p class="bold" style="margin-top:3mm;">제21조 (약관 외 준칙)</p>
  <p>① 명시되지 않은 사항은 신의성실 원칙과 관계 법령에 따릅니다.</p>
  <p>② 저작권은 회사에 있으며, 무단 복제·배포를 금지합니다.</p>

  <p class="bold" style="margin-top:3mm;">제22조 (약관과 계약서 간 우선순위)</p>
  <p>① 상충 시 약관이 우선 적용되며, '개별 합의' 또는 '특약' 명시 시 그에 따릅니다.</p>

  <p class="bold" style="margin-top:3mm;">제23조 (면책 조항)</p>
  <p>① 천재지변, 불가항력, 정부 정책 변경, 기술적 장애로 제공 불가 시 책임을 지지 않습니다.</p>
  <p>② 부적절한 장소, 용도, 환경 사용으로 발생한 손해에 대해 회사는 면책됩니다.</p>

  <p style="margin-top:5mm; font-style:italic;">반납시에는 완충재로 포장 후 착불택배로 배송해 주시면 됩니다. 보증금은 악기 반납 후 검수 완료 시 입금됩니다.</p>
</div>
`

export function buildRentalHtml(data: RentalQuotationData): string {
  const isContract = data.docType === 'contract'
  const docTitle = isContract ? '임 대 차 계 약 서' : '견    적    서'
  const issueDate = fmtDate(data.issueDate)

  const itemsSubtotal = data.items.reduce((s, it) => s + it.qty * it.months * it.price, 0)
  const subTotal = itemsSubtotal + data.deliveryFee + data.pickupFee
  const grandTotal = subTotal + data.deposit

  const itemRows = data.items.map((item, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${item.name}</td>
      <td>${item.detail ?? ''}</td>
      <td class="center">${item.qty}</td>
      <td class="center">${item.months}</td>
      <td class="right">₩${fmtNum(item.price)}</td>
      <td class="right">₩${fmtNum(item.qty * item.months * item.price)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${docTitle.replace(/\s/g, '')} - ${data.clientName}</title>
<style>
${BASE_CSS}
.doc-title { font-size: 16pt; font-weight: bold; letter-spacing: 0.4em; text-align: center; padding: 6px; border: 1.5pt solid #000; margin-bottom: 4mm; }
.header-table td { font-size: 8pt; padding: 2.5px 5px; }
.section-header { font-size: 9pt; font-weight: bold; letter-spacing: 0.15em; text-align: center; background-color: #e8e8e8; padding: 4px; margin: 3mm 0 1mm; }
.items-table th { background-color: #e8e8e8; font-weight: bold; text-align: center; font-size: 8pt; }
.items-table td { font-size: 8pt; }
.sum-table td { font-size: 8pt; padding: 2.5px 5px; }
</style>
</head>
<body>

<div class="doc-title">${docTitle}</div>

<table class="header-table" style="margin-bottom:3mm;">
  <colgroup>
    <col style="width:12%"><col style="width:38%"><col style="width:12%"><col style="width:38%">
  </colgroup>
  <tr>
    <td class="bold bg-gray center" rowspan="2">공급<br>받는자</td>
    <td><span class="bold">계약사(상호)</span> : ${data.clientName}</td>
    <td class="bold bg-gray center" rowspan="2">공급자</td>
    <td><span class="bold">등록번호</span> : 247-10-01698</td>
  </tr>
  <tr>
    <td><span class="bold">주&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소</span> : ${data.clientAddress ?? ''}</td>
    <td><span class="bold">상&nbsp;&nbsp;호&nbsp;&nbsp;명</span> : 유어메이트 &nbsp; <span class="bold">대표</span> 방준영 (인)</td>
  </tr>
  <tr>
    <td class="bg-gray center bold"></td>
    <td><span class="bold">주소</span> : ${data.clientAddress ?? ''}</td>
    <td class="bg-gray center bold"></td>
    <td><span class="bold">주&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소</span> : 경기도 고양시 덕양구 꽃마을로66 한일미디어타워 318,319</td>
  </tr>
  <tr>
    <td class="bg-gray center bold"></td>
    <td><span class="bold">담&nbsp;&nbsp;당&nbsp;&nbsp;자</span> : ${data.manager ?? ''}</td>
    <td class="bg-gray center bold"></td>
    <td><span class="bold">업&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;태</span> : 교육 서비스업</td>
  </tr>
  <tr>
    <td class="bg-gray center bold"></td>
    <td><span class="bold">연&nbsp;&nbsp;락&nbsp;&nbsp;처</span> : ${data.phone ?? ''}</td>
    <td class="bg-gray center bold"></td>
    <td><span class="bold">견적문의</span> : with@yourmate.io</td>
  </tr>
  <tr>
    <td class="bg-gray center bold" colspan="2"><span class="bold">대여 총 금액</span> : ${n2kr(grandTotal)}</td>
    <td class="bg-gray center bold"></td>
    <td><span class="bold">결제문의</span> : accounts@yourmate.io</td>
  </tr>
  <tr>
    <td class="bg-gray center bold" colspan="2"><span class="bold">VAT 포함</span> : ₩${fmtNum(grandTotal)}</td>
    <td class="bg-gray center bold"></td>
    <td><span class="bold">계&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;좌</span> : 농협은행 302-2091-4272-51 유어메이트</td>
  </tr>
  <tr>
    <td colspan="4"><span class="bold">유효기간</span> : 발행일로부터 14일 &nbsp;&nbsp;&nbsp;&nbsp; <span class="bold">발행일</span> : ${issueDate}</td>
  </tr>
</table>

<div class="section-header">대 여 품 목</div>

<table class="items-table" style="margin-bottom:3mm;">
  <colgroup>
    <col style="width:5%"><col style="width:25%"><col style="width:22%">
    <col style="width:8%"><col style="width:8%"><col style="width:16%"><col style="width:16%">
  </colgroup>
  <thead>
    <tr>
      <th>순번</th><th>품목명</th><th>세부내용</th>
      <th>수량</th><th>개월</th><th>단 가</th><th>합 계</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
    ${data.deliveryFee > 0 ? `<tr><td class="center">-</td><td>배송비</td><td></td><td class="center">1</td><td class="center">-</td><td class="right">₩${fmtNum(data.deliveryFee)}</td><td class="right">₩${fmtNum(data.deliveryFee)}</td></tr>` : ''}
    ${data.pickupFee > 0 ? `<tr><td class="center">-</td><td>수거비</td><td></td><td class="center">1</td><td class="center">-</td><td class="right">₩${fmtNum(data.pickupFee)}</td><td class="right">₩${fmtNum(data.pickupFee)}</td></tr>` : ''}
  </tbody>
</table>

<table class="sum-table" style="margin-bottom:3mm;">
  <colgroup>
    <col style="width:35%"><col style="width:65%">
  </colgroup>
  <tr>
    <td class="bold bg-gray">대여료 + 운송비 합계</td>
    <td class="right bold">₩${fmtNum(subTotal)}</td>
  </tr>
  <tr>
    <td class="bold bg-gray">보증금 합계</td>
    <td class="right">₩${fmtNum(data.deposit)}</td>
  </tr>
  <tr>
    <td class="bold bg-gray">총 금 액 (VAT 포함)</td>
    <td class="right bold" style="font-size:10pt;">₩${fmtNum(grandTotal)}</td>
  </tr>
  <tr>
    <td class="bold bg-gray">대 여 기 간</td>
    <td>${data.rentalPeriod ?? ''}</td>
  </tr>
  ${data.notes ? `<tr><td class="bold bg-gray">특이사항</td><td>${data.notes}</td></tr>` : ''}
</table>

${isContract ? CONTRACT_TERMS : ''}

</body>
</html>`
}

// ── 카테고리형 (학교상점 / 002 Creative / 아트키움 / SOS) ────────

const COMPANY_INFO: Record<CategoryQuotationData['serviceType'], { name: string; bizNo: string; rep: string; addr: string }> = {
  school_store: {
    name: '주식회사 공공이코퍼레이션',
    bizNo: '451-81-04289',
    rep: '방준영',
    addr: '경기도 고양시 덕양구 꽃마을로66 318,319호',
  },
  '002creative': {
    name: '유어메이트',
    bizNo: '247-10-01698',
    rep: '방준영',
    addr: '경기도 고양시 덕양구 꽃마을로66 한일미디어타워 318,319호',
  },
  artqium: {
    name: '유어메이트',
    bizNo: '247-10-01698',
    rep: '방준영',
    addr: '경기도 고양시 덕양구 꽃마을로66 한일미디어타워 318,319호',
  },
  sos: {
    name: '유어메이트',
    bizNo: '247-10-01698',
    rep: '방준영',
    addr: '경기도 고양시 덕양구 꽃마을로66 한일미디어타워 318,319호',
  },
  other: {
    name: '유어메이트',
    bizNo: '247-10-01698',
    rep: '방준영',
    addr: '경기도 고양시 덕양구 꽃마을로66 한일미디어타워 318,319호',
  },
}

export function buildCategoryHtml(data: CategoryQuotationData): string {
  const co = COMPANY_INFO[data.serviceType]
  const issueDate = fmtDate(data.issueDate)
  const validDays = data.validDays ?? 30

  let supplyTotal = 0
  const categoryRows = data.categories.map(cat => {
    const catTotal = cat.items.reduce((s, it) => s + it.qty * it.price, 0)
    supplyTotal += catTotal
    const rows = cat.items.map(item => `
      <tr>
        <td class="center">${cat.name}</td>
        <td>${item.name}</td>
        <td>${item.detail ?? ''}</td>
        <td class="center">${item.unit ?? '식'}</td>
        <td class="center">${item.qty}</td>
        <td class="right">₩${fmtNum(item.price)}</td>
        <td class="right">₩${fmtNum(item.qty * item.price)}</td>
      </tr>`).join('')
    return rows + `
      <tr style="background:#f5f5f5;">
        <td colspan="6" class="right bold">소 계 (${cat.name})</td>
        <td class="right bold">₩${fmtNum(catTotal)}</td>
      </tr>`
  }).join('')

  const vat = Math.round(supplyTotal * 0.1)
  const discount = data.discount ?? 0
  const total = supplyTotal + vat - discount

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>견적서 - ${data.clientName}</title>
<style>
${BASE_CSS}
.doc-title { font-size: 18pt; font-weight: bold; letter-spacing: 0.5em; text-align: center; padding: 8px 0; border-bottom: 2pt solid #000; margin-bottom: 5mm; }
.meta-table td { font-size: 8.5pt; padding: 3px 6px; border: none; }
.intro { font-size: 9pt; text-align: center; margin: 4mm 0; }
.items-table th { background-color: #e8e8e8; font-weight: bold; text-align: center; font-size: 8pt; }
.items-table td { font-size: 8pt; }
.total-table td { font-size: 9pt; padding: 3.5px 8px; }
</style>
</head>
<body>

<div class="doc-title">견 적 서</div>

<table class="meta-table" style="margin-bottom:4mm; border: none;">
  <colgroup><col style="width:50%"><col style="width:50%"></colgroup>
  <tr>
    <td><span class="bold">거래처명</span> : ${data.clientName}</td>
    <td><span class="bold">사업자번호</span> : ${co.bizNo}</td>
  </tr>
  <tr>
    <td><span class="bold">담&nbsp;&nbsp;&nbsp;당&nbsp;&nbsp;&nbsp;자</span> : ${data.manager ?? ''}</td>
    <td><span class="bold">견&nbsp;&nbsp;적&nbsp;&nbsp;일</span> : ${issueDate} &nbsp; <span class="bold">담당</span> : ${co.rep}</td>
  </tr>
  <tr>
    <td><span class="bold">유 효 기 간</span> : 발행일로부터 ${validDays}일</td>
    <td><span class="bold">주&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소</span> : ${co.addr}</td>
  </tr>
  <tr>
    <td></td>
    <td><span class="bold">연&nbsp;&nbsp;락&nbsp;&nbsp;처</span> : 070-7858-9132 &nbsp;|&nbsp; accounts@yourmate.io</td>
  </tr>
</table>

<p class="intro bold" style="border-top:0.5pt solid #000; border-bottom:0.5pt solid #000; padding:4px;">다음과 같이 견적 합니다.</p>

<table class="items-table" style="margin: 3mm 0;">
  <colgroup>
    <col style="width:12%"><col style="width:22%"><col style="width:22%">
    <col style="width:7%"><col style="width:7%"><col style="width:15%"><col style="width:15%">
  </colgroup>
  <thead>
    <tr>
      <th>구 분</th><th>품 명</th><th>세부내역</th>
      <th>단위</th><th>수량</th><th>단 가</th><th>금 액</th>
    </tr>
  </thead>
  <tbody>
    ${categoryRows}
  </tbody>
</table>

<table class="total-table" style="width:40%; margin-left:60%;">
  <tr>
    <td class="bold bg-gray">공급가액</td>
    <td class="right">₩${fmtNum(supplyTotal)}</td>
  </tr>
  <tr>
    <td class="bold bg-gray">부가세 (10%)</td>
    <td class="right">₩${fmtNum(vat)}</td>
  </tr>
  ${discount > 0 ? `<tr><td class="bold bg-gray">할 인</td><td class="right">- ₩${fmtNum(discount)}</td></tr>` : ''}
  <tr>
    <td class="bold bg-gray" style="font-size:10pt;">총 계</td>
    <td class="right bold" style="font-size:10pt;">₩${fmtNum(total)}</td>
  </tr>
  <tr>
    <td colspan="2" style="font-size:7.5pt; color:#555; border-top: 0.5pt solid #aaa;">※ 부가가치세 포함 금액입니다.</td>
  </tr>
</table>

${data.notes ? `<p style="margin-top:5mm; font-size:8pt;"><span class="bold">안내사항:</span> ${data.notes}</p>` : ''}

</body>
</html>`
}

// ── 서비스 타입 → 템플릿 매핑 ──────────────────────────────────

export function getQuotationTemplateType(serviceType: string | null): 'rental' | 'category' {
  if (serviceType === '교구대여') return 'rental'
  return 'category'
}

export function getCategoryServiceType(serviceType: string | null): CategoryQuotationData['serviceType'] {
  if (!serviceType) return 'other'
  if (['납품설치', '유지보수', '제작인쇄'].includes(serviceType)) return 'school_store'
  if (['콘텐츠제작', '행사운영', '행사대여', '프로젝트'].includes(serviceType)) return '002creative'
  if (serviceType === '교육프로그램') return 'artqium'
  if (serviceType === 'SOS' || serviceType === '공연') return 'sos'
  return 'other'
}
