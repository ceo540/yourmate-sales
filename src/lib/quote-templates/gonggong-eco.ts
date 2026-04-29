// 공공이코퍼레이션 견적서 템플릿 (기준 포맷)
//
// 사업자 정보(이름/번호/주소/계좌)는 {{entity_*}} 치환으로 들어옴.
// business_entities 테이블의 short_name = '공공이코' 행과 매칭.
//
// 항목/구조는 이 파일을 다른 사업자 템플릿의 기준으로 사용.

export const GONGGONG_ECO_TEMPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>견적서 - {{client_org}}</title>
<style>
@page { size: A4 portrait; margin: 12mm 15mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: '맑은 고딕', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: 9pt; color: #000; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 0.5pt solid #555; padding: 4px 6px; vertical-align: middle; }
.bold { font-weight: bold; }
.center { text-align: center; }
.right { text-align: right; }
.bg-gray { background-color: #f0f0f0; }
.no-border { border: none !important; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

.doc-title { font-size: 18pt; font-weight: bold; letter-spacing: 0.5em; text-align: center; padding: 8px 0; border-bottom: 2pt solid #000; margin-bottom: 5mm; }
.doc-meta { font-size: 8.5pt; margin-bottom: 4mm; }
.doc-meta td { border: none; padding: 2px 4px; }
.intro { font-size: 9pt; text-align: center; border-top: 0.5pt solid #000; border-bottom: 0.5pt solid #000; padding: 4px; margin: 3mm 0; font-weight: bold; }
.items th { background-color: #e8e8e8; text-align: center; font-weight: bold; font-size: 8.5pt; }
.items td { font-size: 8.5pt; }
.totals { width: 50%; margin-left: 50%; margin-top: 4mm; }
.totals td { font-size: 9pt; padding: 4px 8px; }
.notes { margin-top: 5mm; font-size: 8.5pt; }
.notes .bold { display: inline-block; margin-bottom: 2mm; }
</style>
</head>
<body>

<div class="doc-title">견 적 서</div>

<table class="doc-meta">
  <colgroup><col style="width:50%"><col style="width:50%"></colgroup>
  <tr>
    <td><span class="bold">견적번호</span> : {{quote_number}}</td>
    <td><span class="bold">발 행 일</span> : {{date}}</td>
  </tr>
  <tr>
    <td><span class="bold">거래처명</span> : {{client_org}}</td>
    <td><span class="bold">상&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;호</span> : {{entity_name}}</td>
  </tr>
  <tr>
    <td><span class="bold">담&nbsp;&nbsp;당&nbsp;&nbsp;자</span> : {{client_manager}} {{client_dept}}</td>
    <td><span class="bold">사업자번호</span> : {{entity_business_number}}</td>
  </tr>
  <tr>
    <td><span class="bold">프로젝트</span> : {{project_name}}</td>
    <td><span class="bold">대&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;표</span> : {{entity_representative}}</td>
  </tr>
  <tr>
    <td></td>
    <td><span class="bold">주&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소</span> : {{entity_address}}</td>
  </tr>
  <tr>
    <td></td>
    <td><span class="bold">계&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;좌</span> : {{entity_account}}</td>
  </tr>
</table>

<p class="intro">다음과 같이 견적합니다.</p>

<table class="items">
  <colgroup>
    <col style="width:6%"><col style="width:30%"><col style="width:24%">
    <col style="width:8%"><col style="width:14%"><col style="width:18%">
  </colgroup>
  <thead>
    <tr>
      <th>순번</th><th>품 명</th><th>세부내용</th>
      <th>수량</th><th>단 가</th><th>금 액</th>
    </tr>
  </thead>
  <tbody>
    {{#items}}
    <tr>
      <td class="center">{{index}}</td>
      <td>{{name}}</td>
      <td>{{description}}</td>
      <td class="center">{{qty_fmt}}</td>
      <td class="right">{{unit_price_fmt}}</td>
      <td class="right">{{amount_fmt}}</td>
    </tr>
    {{/items}}
  </tbody>
</table>

<table class="totals">
  <tr>
    <td class="bold bg-gray">공급가액</td>
    <td class="right">{{subtotal_fmt}}</td>
  </tr>
  <tr>
    <td class="bold bg-gray">부가세 (10%)</td>
    <td class="right">{{vat_fmt}}</td>
  </tr>
  <tr>
    <td class="bold bg-gray" style="font-size:10pt;">총 계</td>
    <td class="right bold" style="font-size:11pt;">{{total_fmt}}</td>
  </tr>
  <tr>
    <td colspan="2" style="font-size:7.5pt; color:#555;">※ 부가가치세 포함 금액입니다.</td>
  </tr>
</table>

{{#notes_block}}
<div class="notes">
  <div class="bold">안내사항</div>
  <div>{{notes}}</div>
</div>
{{/notes_block}}

</body>
</html>`
