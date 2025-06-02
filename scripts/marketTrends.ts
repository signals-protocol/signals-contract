// 마켓별 트렌드 데이터 관리 파일
// 실제 비트코인 가격 데이터를 기반으로 한 마켓별 예상 가격 정보

export enum TrendDirection {
  BULLISH = "BULLISH", // 상승 트렌드
  BEARISH = "BEARISH", // 하락 트렌드
  NEUTRAL = "NEUTRAL", // 중립/횡보
  VOLATILE = "VOLATILE", // 변동성 높음
}

export interface MarketTrend {
  marketId: number;
  direction: TrendDirection;
  intensity: number; // 1-10 스케일 (1: 약함, 10: 강함)
  description?: string;
  expectedPrice: number; // 예상 가격 (실제 데이터 기반)
  date: string; // 해당 날짜
}

// 실제 비트코인 가격 데이터 (2025-05-16부터 시작)
// 각 마켓의 예상 종료 가격을 나타냄
export const HISTORICAL_PRICE_DATA = [
  103500, // 2025-05-16: $103,556 → 103,500 (Market 0)
  103000, // 2025-05-17: $103,212 → 103,000 (Market 1)
  106000, // 2025-05-18: $106,031 → 106,000 (Market 2)
  105500, // 2025-05-19: $105,629 → 105,500 (Market 3)
  107000, // 2025-05-20: $106,787 → 107,000 (Market 4)
  110000, // 2025-05-21: $109,666 → 110,000 (Market 5)
  111500, // 2025-05-22: $111,560 → 111,500 (Market 6)
  107000, // 2025-05-23: $107,217 → 107,000 (Market 7)
  108000, // 2025-05-24: $107,831 → 108,000 (Market 8)
  109000, // 2025-05-25: $108,862 → 109,000 (Market 9)
  109500, // 2025-05-26: $109,378 → 109,500 (Market 10)
  109000, // 2025-05-27: $109,068 → 109,000 (Market 11)
  108000, // 2025-05-28: $107,838 → 108,000 (Market 12)
  106000, // 2025-05-29: $105,745 → 106,000 (Market 13)
  104000, // 2025-05-30: $104,011 → 104,000 (Market 14)
  104500, // 2025-05-31: $104,688 → 104,500 (Market 15)
];

// 실제 가격 데이터를 기반으로 생성된 마켓별 트렌드 데이터
export const MARKET_TRENDS: MarketTrend[] = [
  {
    marketId: 0,
    direction: TrendDirection.NEUTRAL,
    intensity: 3,
    expectedPrice: 103500,
    date: "2025-05-16",
    description: "시장 안정화",
  },
  {
    marketId: 1,
    direction: TrendDirection.BEARISH,
    intensity: 4,
    expectedPrice: 103000,
    date: "2025-05-17",
    description: "약간의 하락",
  },
  {
    marketId: 2,
    direction: TrendDirection.BULLISH,
    intensity: 7,
    expectedPrice: 106000,
    date: "2025-05-18",
    description: "강한 상승",
  },
  {
    marketId: 3,
    direction: TrendDirection.BEARISH,
    intensity: 3,
    expectedPrice: 105500,
    date: "2025-05-19",
    description: "소폭 조정",
  },
  {
    marketId: 4,
    direction: TrendDirection.BULLISH,
    intensity: 5,
    expectedPrice: 107000,
    date: "2025-05-20",
    description: "상승 지속",
  },
  {
    marketId: 5,
    direction: TrendDirection.BULLISH,
    intensity: 8,
    expectedPrice: 110000,
    date: "2025-05-21",
    description: "강한 상승 모멘텀",
  },
  {
    marketId: 6,
    direction: TrendDirection.BULLISH,
    intensity: 6,
    expectedPrice: 111500,
    date: "2025-05-22",
    description: "상승 지속",
  },
  {
    marketId: 7,
    direction: TrendDirection.BEARISH,
    intensity: 8,
    expectedPrice: 107000,
    date: "2025-05-23",
    description: "급격한 조정",
  },
  {
    marketId: 8,
    direction: TrendDirection.BULLISH,
    intensity: 4,
    expectedPrice: 108000,
    date: "2025-05-24",
    description: "반등",
  },
  {
    marketId: 9,
    direction: TrendDirection.BULLISH,
    intensity: 4,
    expectedPrice: 109000,
    date: "2025-05-25",
    description: "완만한 상승",
  },
  {
    marketId: 10,
    direction: TrendDirection.BULLISH,
    intensity: 3,
    expectedPrice: 109500,
    date: "2025-05-26",
    description: "소폭 상승",
  },
  {
    marketId: 11,
    direction: TrendDirection.BEARISH,
    intensity: 3,
    expectedPrice: 109000,
    date: "2025-05-27",
    description: "소폭 하락",
  },
  {
    marketId: 12,
    direction: TrendDirection.BEARISH,
    intensity: 5,
    expectedPrice: 108000,
    date: "2025-05-28",
    description: "하락 압력",
  },
  {
    marketId: 13,
    direction: TrendDirection.BEARISH,
    intensity: 6,
    expectedPrice: 106000,
    date: "2025-05-29",
    description: "조정 지속",
  },
  {
    marketId: 14,
    direction: TrendDirection.BEARISH,
    intensity: 6,
    expectedPrice: 104000,
    date: "2025-05-30",
    description: "하락 지속",
  },
  {
    marketId: 15,
    direction: TrendDirection.BULLISH,
    intensity: 3,
    expectedPrice: 104500,
    date: "2025-05-31",
    description: "소폭 반등",
  },
];

/**
 * 특정 마켓의 트렌드 정보를 가져옵니다
 * @param marketId 마켓 ID
 * @returns 마켓 트렌드 정보 또는 undefined
 */
export function getMarketTrend(marketId: number): MarketTrend | undefined {
  return MARKET_TRENDS.find((trend) => trend.marketId === marketId);
}

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

/**
 * 실제 가격 데이터를 기반으로 위닝빈을 계산합니다
 * @param marketId 마켓 ID
 * @param minTick 최소 틱
 * @param maxTick 최대 틱
 * @param tickSpacing 틱 간격
 * @returns 계산된 위닝빈 값 (실제 예상 가격 기반)
 */
export function calculateWinningBinFromTrend(
  marketId: number,
  minTick: number,
  maxTick: number,
  tickSpacing: number
): number {
  // 실제 가격 데이터에서 예상 가격 가져오기
  const expectedPrice = getExpectedPrice(marketId);

  if (!expectedPrice) {
    // 데이터가 없으면 중간값 반환
    return Math.floor((minTick + maxTick) / 2 / tickSpacing) * tickSpacing;
  }

  // 예상 가격이 마켓 범위를 벗어나는 경우 조정
  let adjustedPrice = expectedPrice;
  if (expectedPrice < minTick) {
    adjustedPrice = minTick;
  } else if (expectedPrice > maxTick) {
    adjustedPrice = maxTick;
  }

  // tickSpacing에 맞춰 조정하여 위닝빈 반환
  return Math.floor(adjustedPrice / tickSpacing) * tickSpacing;
}

/**
 * 트렌드 데이터를 기반으로 위닝빈을 계산합니다 (기존 호환성 유지)
 * @deprecated calculateWinningBinFromTrend 사용 권장
 */
export function calculateWinningBinFromTrendLegacy(
  marketId: number,
  minTick: number,
  maxTick: number,
  tickSpacing: number
): number {
  return calculateWinningBinFromTrend(marketId, minTick, maxTick, tickSpacing);
}
