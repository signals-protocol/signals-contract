// 마켓별 실제 가격 데이터 관리 파일
// 실제 비트코인 가격 데이터를 기반으로 한 마켓별 예상 가격 정보

// 실제 비트코인 가격 데이터 (2025-05-16부터 시작)
// 각 마켓의 예상 종료 가격을 나타냄 (주석의 실제 값 사용)
export const HISTORICAL_PRICE_DATA = [
  103556, // 2025-05-16: Market 0
  103212, // 2025-05-17: Market 1
  106031, // 2025-05-18: Market 2
  105629, // 2025-05-19: Market 3
  106787, // 2025-05-20: Market 4
  109666, // 2025-05-21: Market 5
  111560, // 2025-05-22: Market 6
  107217, // 2025-05-23: Market 7
  107831, // 2025-05-24: Market 8
  108862, // 2025-05-25: Market 9
  109378, // 2025-05-26: Market 10
  109068, // 2025-05-27: Market 11
  107838, // 2025-05-28: Market 12
  105745, // 2025-05-29: Market 13
  104011, // 2025-05-30: Market 14
  104688, // 2025-05-31: Market 15
  105710, // 2025-06-01: Market 16
  105885, // 2025-06-02: Market 17
  105434, // 2025-06-03: Market 18
  104813, // 2025-06-04: Market 19
  101651, // 2025-06-05: Market 20
  104410, // 2025-06-06: Market 21
];

/**
 * 특정 마켓의 예상 가격을 가져옵니다
 * @param marketId 마켓 ID
 * @returns 예상 가격 또는 undefined
 */
export function getExpectedPrice(marketId: number): number | undefined {
  if (marketId < 0 || marketId >= HISTORICAL_PRICE_DATA.length) {
    return undefined;
  }
  return HISTORICAL_PRICE_DATA[marketId];
}
