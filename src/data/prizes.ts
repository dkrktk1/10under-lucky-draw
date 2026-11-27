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
    id: 'prize-garmin-965',
    name: '가민 포러너 965 GPS 철인 워치',
    price: '890,000원',
    quantity: 1,
    image: './src/assets/images/prize_garmin_watch_1795183198262.jpg',
  },
  {
    id: 'prize-oakley-sutro',
    name: '오클리 수트로 라이트 스포츠 고글',
    price: '260,000원',
    quantity: 2,
    image: './src/assets/images/prize_cycling_sunglasses_1795183217490.jpg',
  },
  {
    id: 'prize-scicon-bag',
    name: '시콘 에어로컴포트 자전거 캐링백',
    price: '980,000원',
    quantity: 1,
    image: './src/assets/images/prize_bike_travel_bag_1795183195837.jpg',
  },
  {
    id: 'prize-maurten-gel',
    name: '모르텐 에너지젤 1박스 (12개입)',
    price: '68,000원',
    quantity: 5,
    image: './src/assets/images/prize_energy_gel_box_1795183195323.jpg',
  },
];
