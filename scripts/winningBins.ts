// This file contains predefined winning bin values for specific markets
// and a default calculation function for markets without predefined values

export const WINNING_BINS: { [marketId: number]: number } = {
  // Define specific winning bins for certain markets if needed
  // For example:
  // 0: 60,
  // 1: 0,
  // 2: -60,
};

/**
 * Calculates a default winning bin value based on market parameters
 * @param minTick The minimum tick of the market
 * @param maxTick The maximum tick of the market
 * @param tickSpacing The tick spacing of the market
 * @returns A default winning bin value (middle of the range or closest to zero)
 */
export function getDefaultWinningBin(
  minTick: number,
  maxTick: number,
  tickSpacing: number
): number {
  // Find the middle of the range rounded to the nearest valid bin
  const middleTick =
    Math.floor((minTick + maxTick) / 2 / tickSpacing) * tickSpacing;

  // If 0 is a valid bin, use that (assuming 0 is within the range)
  if (minTick <= 0 && maxTick >= 0 && 0 % tickSpacing === 0) {
    return 0;
  }

  return middleTick;
}
