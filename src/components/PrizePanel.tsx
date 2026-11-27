import { Prize } from '../types/raffle';

/**
 * 연말 총회 경품 사전 등록 설정 파일
 * -----------------------------------------------------------
 * 행사 전에 이 파일에서 경품 목록을 미리 수정·추가해 둘 수 있습니다.
 *
 * - id      : 각 경품을 구분하는 고유 ID (중복되지 않게 입력)
 * - name    : 메인 화면과 당첨 팝업에 표시될 상품명
 * - price   : 표시 금액 (예: "150,000원", 비워두면 미표시)
 * - quantity: 준비된 총 경품 수량
 * - image   : 이미지 경로
 *             public/images/ 폴더에 넣은 파일은 "./images/파일명.jpg" 형태로,
 *             public/assets/ 폴더에 넣은 파일은 "./assets/파일명.jpg" 형태로 입력하면
 *             GitHub Pages 배포 환경에서도 깨지지 않고 표시됩니다.
 */
export const INITIAL_PRIZES: Prize[] = [
  {
    id: 'prize1',
    name: 'SMITH 헬멧',
    price: '863,310원',
    quantity: 1,
    image: './src/assets/images/SMITH 제트스트림 TT.png',
  },
  {
    id: 'prize2',
    name: '프라다 고글',
    price: '563,000원',
    quantity: 1,
    image: './src/assets/images/유한권(고글).jpg',
  },
  {
    id: 'prize3',
    name: 'HJC TT 헬멧',
    price: '399,000원',
    quantity: 1,
    image: './src/assets/images/HJC 애드왓 TT 헬멧.png',
  },
  {
    id: 'prize4',
    name: '100% Aerocraft 고글_메탈릭 블랙',
    price: '310,000원',
    quantity: 1,
    image: './src/assets/images/메탈릭 블랙.png',
  },
  
  {
    id: 'prize5',
    name: '디지털도어락 G SUIT 1set',
    price: '290,5000원',
    quantity: 1,
    image: './src/assets/images/도어락.png',
  },
  {
    id: 'prize6',
    name: '100% Aerocraft 고글_블랙 크롬',
    price: '290,0000원',
    quantity: 2,
    image: './src/assets/images/블랙 크롬.png',
  },
  {
    id: 'prize7',
    name: '100% Aerocraft 고글_S3 핑크/옐로',
    price: '260,000원',
    quantity: 1,
    image: './src/assets/images/s3 핑크_옐로.jpg',
  },
  {
    id: 'prize8',
    name: '슈발베 프로원 RS 튜블리스 타이어 700X30C, 블랙',
    price: '220,000원',
    quantity: 3,
    image: './src/assets/images/슈발베 프로원.png',
  },
  {
    id: 'prize9',
    name: '슈발베 프로원 에어로 튜블리스 타이어 700X28C, 블랙',
    price: '220,000원',
    quantity: 6,
    image: './src/assets/images/슈발베 프로원 에어로.jpg',
  },
  {
    id: 'prize10',
    name: '슈발베 프로원 튜블리스 타이어 700X28C, 브라운 월',
    price: '220,000원',
    quantity: 3,
    image: './src/assets/images/슈발베 프로원 ts-sk.jpg',
  },
  {
    id: 'prize11',
    name: '슈발베 원 튜블러 타이어 700X25C, 클래식 스킨',
    price: '120,000원',
    quantity: 10,
    image: './src/assets/images/슈발베 원 튜블러.jpg',
  },
  {
    id: 'prize12',
    name: '헤어 시술권 2ea',
    price: '200,000원',
    quantity: 2,
    image: './src/assets/images/헤어 시술권.png',
  },
  {
    id: 'prize13',
    name: '데상트 저지 긴팔 남색 남 100',
    price: '179,000원',
    quantity: 1,
    image: './src/assets/images/데상트 저지 남색 남100.png',
  },
  {
    id: 'prize14',
    name: '데상트 저지 긴팔 노랑 남 100',
    price: '70,000원',
    quantity: 1,
    image: './src/assets/images/데상트 저지 노랑 남100.png',
  },
  {
    id: 'prize15',
    name: '데상트 저지 긴팔 흰 여 85',
    price: '70,000원',
    quantity: 2,
    image: './src/assets/images/메탈릭 블랙.png',
  },
  {
    id: 'prize16',
    name: '데상트 저지 긴팔 노랑 여 85',
    price: '70,000원',
    quantity: 1,
    image: './src/assets/images/데상트 저지 노랑 남100.png',
  },
    {
    id: 'prize17',
    name: '10under 한정판 T셔츠 10ea',
    price: '50,000원',
    quantity: 1,
    image: './src/assets/images/.png',
  },  
  {
    id: 'prize18',
    name: '아식스 모자 10ea',
    price: '49,000원',
    quantity: 9,
    image: './src/assets/images/아식스 5패널 캡.png',
  },  
  {
    id: 'prize19',
    name: '존버 고글',
    price: '39,000원',
    quantity: 10,
    image: './src/assets/images/2026-11-24 14 56 41.png',
  },  
  {
    id: 'prize20',
    name: 'AVEDA 핸드 크림',
    price: '36,000원',
    quantity: 2,
    image: './src/assets/images/aveda.jpg',
  },  
  {
    id: 'prize21',
    name: '존버 T셔츠',
    price: '35,000원',
    quantity: 18,
    image: ,
  },  
  {
    id: 'prize22',
    name: '2XU 썬캡',
    price: '30,000원',
    quantity: 10,
    image: './src/assets/images/2xu 선캡.png',
  },  
  {
    id: 'prize23',
    name: '자전거 커버',
    price: '29,000원',
    quantity: 10,
    image: './src/assets/images/커버.png',
  },  
  {
    id: 'prize24',
    name: '수제 비누 3개',
    price: '24,000원',
    quantity: 14,
    image: './src/assets/images/2026-11-24 14 55 41.png',
  },
  {
    id: 'prize25',
    name: '썬크림 1box',
    price: '22,500원',
    quantity: ,
    image: './src/assets/images/선전썬크림.png',
  },
    {
    id: 'prize26',
    name: '수제 참기름',
    price: '20,000원',
    quantity: 5,
    image: './src/assets/images/참기름.png',
  },  
  {
    id: 'prize27',
    name: '콜라겐 180정',
    price: '20,000원',
    quantity: 7,
    image: './src/assets/images/콜라겐 180정.png',
  },  
  {
    id: 'prize28',
    name: '수제 비누 2개',
    price: '16,000원',
    quantity: 29,
    image: './src/assets/images/2026-11-24 14 55 41.png',
  },  
  {
    id: 'prize29',
    name: '얼티밋 포텐셜 에너지젤 카페인 프리 1box',
    price: '14,400원',
    quantity: 15,
    image: './src/assets/images/얼티밋 러닝에너지젤프리.png',
  },  
  {
    id: 'prize30',
    name: '얼티밋 포텐셜 에너지젤 1box',
    price: '14,500원',
    quantity: 15,
    image: './src/assets/images/얼티밋 러닝에너지젤.png',
  },
  {
    id: 'prize31',
    name: '자전거 공구통',
    price: '10,000원',
    quantity: 10,
    image: './src/assets/images/공구통.jpg',
  },{
    id: 'prize32',
    name: '떡볶이 분말 소스 500g',
    price: '7,000원',
    quantity: 30,
    image: './src/assets/images/떡볶이.jpg',
  },
];