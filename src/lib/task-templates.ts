export type TaskTemplate = {
  title: string
  priority: '높음' | '보통' | '낮음'
  memo?: string
}

export const SERVICE_TASK_TEMPLATES: Record<string, TaskTemplate[]> = {
  'SOS': [
    { title: 'CS 응대 및 CRM 작성', priority: '높음' },
    { title: '견적서 발송', priority: '높음' },
    { title: '계약 확정 및 요청사항 송부', priority: '높음', memo: '공연장 사진·프로젝터 사용 확인, 사전 사연 작성 폼 전달' },
    { title: '아티스트 컨택 및 일정 픽스', priority: '높음' },
    { title: '사전설문지 전달 (공연 2~3주 전)', priority: '보통' },
    { title: '큐시트 및 대본 전달', priority: '보통' },
    { title: '일주일 전 안내 (아티스트 메뉴얼)', priority: '보통' },
    { title: '공연 진행', priority: '높음', memo: '본 공연 4시간 전 입장, 장비 세팅, 테크·아티스트 리허설' },
    { title: '공연 후 감사 메시지 발송', priority: '낮음', memo: '사후 설문지 취합, 홍보용 자료 회수' },
    { title: '콘텐츠 제작 및 업로드', priority: '낮음', memo: '스케치 영상(1주일 후), 인터뷰, 스페셜클립 순 업로드' },
    { title: '정산 처리', priority: '높음' },
  ],

  '교육프로그램': [
    { title: 'CS 응대 및 CRM 작성', priority: '높음' },
    { title: '견적서 발송', priority: '높음' },
    { title: '계약 확정 및 강사·기관 일정 조율', priority: '높음', memo: '노션·드롭박스 프로젝트 폴더 생성, 운영계획안 확보' },
    { title: '사전 안내 및 사전답사', priority: '보통', memo: '학급 교사에게 협조사항 안내문·동의서 전달, 수업 환경 파악' },
    { title: '강사 교육 및 수업자료 전달', priority: '보통', memo: '강사 메뉴얼, PPT(구글슬라이드), 녹음수업 가이드, 사진 요청 사전 안내' },
    { title: '수업 자료 준비 (현수막·명찰·활동지·PPT)', priority: '보통' },
    { title: '수업 진행', priority: '높음' },
    { title: '사후설문지 전달', priority: '낮음' },
    { title: '동의서·사진·활동지 스캔 및 보관', priority: '낮음' },
    { title: '음원 발매 준비 (크레딧·앨범커버·음원 취합)', priority: '보통' },
    { title: '뮤직비디오 제작 및 업로드', priority: '낮음' },
    { title: '정산 처리', priority: '높음' },
  ],

  '납품설치': [
    { title: 'CS 응대 및 CRM 작성', priority: '높음' },
    { title: '인하우스/외주 여부 파악', priority: '높음' },
    { title: '방문점검 진행', priority: '높음' },
    { title: '견적서 발송', priority: '높음' },
    { title: '견적 확정 대기', priority: '보통' },
    { title: '시공 일정 조율', priority: '높음' },
    { title: '시공 진행', priority: '높음' },
    { title: '결제 처리 (행정실 소통)', priority: '높음' },
    { title: '마케팅 콘텐츠 발행', priority: '낮음', memo: '블로그, 인스타그램, 유튜브' },
  ],

  '유지보수': [
    { title: 'CS 응대 및 CRM 작성', priority: '높음' },
    { title: '내용 협의 및 견적 발송', priority: '높음' },
    { title: '방문 준비 (필요 물품 확인)', priority: '보통' },
    { title: '점검 및 시공', priority: '높음' },
    { title: '결제 처리 (행정실 소통)', priority: '높음' },
    { title: '마케팅 콘텐츠 발행', priority: '낮음' },
  ],

  '교구대여': [
    { title: 'CS 응대 및 CRM 작성', priority: '높음' },
    { title: '재고 확인', priority: '높음' },
    { title: '렌탈 계약서 작성', priority: '높음' },
    { title: '계약 확정 및 파일 정리', priority: '보통' },
    { title: '배송 준비', priority: '보통' },
    { title: '배송/발송', priority: '높음' },
    { title: '회수 일정 확정', priority: '보통' },
    { title: '반납 검수', priority: '보통' },
    { title: '보증금 환급', priority: '보통' },
    { title: '정산 처리', priority: '높음' },
  ],

  '제작인쇄': [
    { title: 'CS 응대 및 문의 접수', priority: '높음' },
    { title: '1차 상담 및 요구사항 파악', priority: '높음' },
    { title: '견적서 발송', priority: '높음' },
    { title: '기획안 및 시안 제안', priority: '높음' },
    { title: '계약 체결', priority: '높음' },
    { title: '디자인·제작 작업', priority: '높음' },
    { title: '검수 및 수정', priority: '보통' },
    { title: '최종 납품', priority: '높음' },
    { title: '정산 처리 (세금계산서)', priority: '높음' },
  ],

  '콘텐츠제작': [
    { title: '유입 및 문의 접수 (CRM 등록)', priority: '높음' },
    { title: '1차 상담 및 니즈 분석', priority: '높음' },
    { title: '견적서 발송', priority: '높음' },
    { title: '기획안 및 일정 제안', priority: '높음' },
    { title: '계약 체결', priority: '높음', memo: '공공기관은 나라장터 진행' },
    { title: '대본 작성', priority: '보통' },
    { title: '촬영', priority: '높음' },
    { title: '편집', priority: '높음' },
    { title: '시사 및 피드백 수렴', priority: '보통' },
    { title: '최종 납품 (드롭박스 업로드)', priority: '높음' },
    { title: '정산 처리 (세금계산서·잔금 확인)', priority: '높음' },
    { title: '결과 보고 및 자료 백업', priority: '낮음' },
  ],

  '행사운영': [
    { title: '유입 및 문의 접수 (CRM 등록)', priority: '높음' },
    { title: '1차 상담 및 니즈 분석', priority: '높음' },
    { title: '견적서 발송', priority: '높음' },
    { title: '기획안 및 일정 제안', priority: '높음' },
    { title: '계약 체결', priority: '높음' },
    { title: '행사 준비', priority: '높음' },
    { title: '행사 진행', priority: '높음' },
    { title: '정산 처리 (세금계산서·잔금 확인)', priority: '높음' },
    { title: '결과 보고 및 자료 백업', priority: '낮음' },
  ],

  '행사대여': [
    { title: 'CS 응대 및 문의 접수', priority: '높음' },
    { title: '재고·장비 확인', priority: '높음' },
    { title: '견적서 발송', priority: '높음' },
    { title: '계약 확정', priority: '높음' },
    { title: '장비 준비 및 배송', priority: '높음' },
    { title: '행사 현장 지원', priority: '높음' },
    { title: '장비 회수 및 검수', priority: '보통' },
    { title: '정산 처리', priority: '높음' },
  ],

  '프로젝트': [
    { title: '유입 및 문의 접수 (CRM 등록)', priority: '높음' },
    { title: '1차 상담 및 니즈 분석', priority: '높음' },
    { title: '견적서 발송', priority: '높음' },
    { title: '기획안 및 일정 제안', priority: '높음' },
    { title: '계약 체결', priority: '높음' },
    { title: '진행', priority: '높음' },
    { title: '검수 및 납품', priority: '높음' },
    { title: '정산 처리', priority: '높음' },
  ],

  '002ENT': [
    { title: '발매 요청 접수 (데모·희망일자 확인)', priority: '높음' },
    { title: '발매자료 데이터파일 전송', priority: '높음' },
    { title: '고객 정보 및 음원 정보 파악', priority: '높음', memo: '드롭박스·노션 유통DB 업데이트' },
    { title: '발매 진행 확정', priority: '높음' },
    { title: 'CP사 프로모션 설정', priority: '보통' },
    { title: '발매 후 자사 프로모션', priority: '보통' },
    { title: '정산', priority: '높음' },
  ],
}
