// 마켓 ID별 winningBin 값을 정의
// 이 파일은 필요에 따라 수정하여 각 마켓의 실제 결과값을 설정할 수 있습니다.

export const WINNING_BINS: Record<number, number> = {
  // 마켓 ID: winningBin 값
  0: 0, // 마켓 0의 승리 빈은 0
  1: 60, // 마켓 1의 승리 빈은 60
  2: -60, // 마켓 2의 승리 빈은 -60
  3: 120, // 마켓 3의 승리 빈은 120
  4: -120, // 마켓 4의 승리 빈은 -120
  5: 180, // 마켓 5의 승리 빈은 180
  6: -180, // 마켓 6의 승리 빈은 -180
  7: 0, // 마켓 7의 승리 빈은 0
  8: 60, // 마켓 8의 승리 빈은 60
  9: -60, // 마켓 9의 승리 빈은 -60
  10: 120, // 마켓 10의 승리 빈은 120
  11: -120, // 마켓 11의 승리 빈은 -120
  12: 180, // 마켓 12의 승리 빈은 180
  13: -180, // 마켓 13의 승리 빈은 -180
  14: 0, // 마켓 14의 승리 빈은 0
};

// 기본 winningBin 값 - 마켓의 min과 max의 중간값을 계산하는 경우 사용
export function getDefaultWinningBin(
  minTick: number,
  maxTick: number,
  tickSpacing: number
): number {
  const midTick = Math.floor((minTick + maxTick) / 2);
  return Math.floor(midTick / tickSpacing) * tickSpacing;
}
