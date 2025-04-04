// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { UD60x18 } from "@prb/math/src/ud60x18/ValueType.sol";
import { unwrap, wrap } from "@prb/math/src/ud60x18/Casting.sol";
import { ln, div, mul, pow } from "@prb/math/src/ud60x18/Math.sol";
import { add, sub } from "@prb/math/src/ud60x18/Helpers.sol";

/**
 * @title RangeBetManager
 * @dev 여러 예측 마켓을 단일 컨트랙트로 관리하는 Range Betting 풀 컨트랙트
 * Uniswap V3의 틱 개념을 차용한 등비수열 구간(bin)으로 가격 범위를 나눔
 */
contract RangeBetManager is ERC1155, Ownable {
    using SafeERC20 for IERC20;

    // -------------------------
    // 데이터 구조
    // -------------------------

    // 마켓 정보
    struct MarketInfo {
        bool closed;               // 마켓 종료 여부
        uint256 winningBin;        // 우승 bin 인덱스
        IERC20 stableToken;        // 스테이블코인 주소
        uint256 T;                 // 전체 토큰 발행 총합
        uint256 baseTick;          // 중앙 기준 틱
        uint256 tickSpacing;       // 틱 간격
        uint256 binCount;          // 전체 bin 개수 (2a+1)
        uint256 deadline;          // 만료 시간 (선택적)
        uint256 poolAtClose;       // 마켓 종료 시 스테이블코인 풀 잔액
    }

    // marketId => MarketInfo
    mapping(uint256 => MarketInfo) public markets;

    // (marketId, binIndex) => q (해당 bin 총량)
    mapping(uint256 => mapping(uint256 => uint256)) public q;

    // 다음 자동 생성 마켓 ID
    uint256 public nextMarketId;

    // -------------------------
    // 이벤트
    // -------------------------
    event MarketCreated(uint256 indexed marketId, uint256 baseTick, uint256 tickSpacing, uint256 binCount);
    event Bet(uint256 indexed marketId, uint256[] binIndices, uint256[] amounts, uint256 costTotal);
    event MarketClosed(uint256 indexed marketId, uint256 winningBin);
    event Claimed(uint256 indexed marketId, uint256 indexed binIndex, address indexed user, uint256 payout);

    // -------------------------
    // 생성자
    // -------------------------
    constructor() ERC1155("") Ownable(msg.sender) {
        nextMarketId = 1;
    }

    // -------------------------
    // 마켓 생성
    // -------------------------
    /**
     * @dev 새로운 마켓을 생성
     * @param stableTokenAddr 스테이블코인 주소
     * @param baseTick 중앙 기준 틱
     * @param tickSpacing 틱 간격
     * @param a 양쪽으로 확장할 bin 수 (총 bin 수 = 2a+1)
     * @param deadline 마켓 만료 시간
     * @return marketId 생성된 마켓 ID
     */
    function createMarket(
        IERC20 stableTokenAddr,
        uint256 baseTick,
        uint256 tickSpacing,
        uint256 a,
        uint256 deadline
    ) external onlyOwner returns (uint256 marketId) {
        marketId = nextMarketId++;
        
        MarketInfo storage m = markets[marketId];
        m.stableToken = stableTokenAddr;
        m.baseTick = baseTick;
        m.tickSpacing = tickSpacing;
        m.binCount = 2 * a + 1;
        m.closed = false;
        m.winningBin = type(uint256).max; // 초기화되지 않은 상태
        m.T = 0; // 초기 0
        m.deadline = deadline;

        emit MarketCreated(marketId, baseTick, tickSpacing, m.binCount);
        return marketId;
    }

    // -------------------------
    // 베팅(매수)
    // -------------------------
    /**
     * @dev 여러 bin에 동시에 베팅
     * @param marketId 마켓 ID
     * @param binIndices bin 인덱스 배열
     * @param amounts 각 bin에 베팅할 수량
     * @param maxStable 최대 지불할 스테이블코인 양 (슬리피지 보호)
     */
    function buyTokens(
        uint256 marketId,
        uint256[] calldata binIndices,
        uint256[] calldata amounts,
        uint256 maxStable
    ) external {
        MarketInfo storage m = markets[marketId];
        require(!m.closed, "Market closed");
        require(block.timestamp < m.deadline, "Market expired");
        require(binIndices.length == amounts.length, "Length mismatch");

        uint256 costTotal = 0;
        uint256 Tcurrent = m.T;

        for (uint256 i = 0; i < binIndices.length; i++) {
            uint256 binIdx = binIndices[i];
            uint256 x = amounts[i];
            if (x == 0) continue;

            // Boundary check
            require(binIdx < m.binCount, "Invalid bin index");

            uint256 qBin = q[marketId][binIdx];
            
            // cost = x + (qBin - Tcurrent) * ln((Tcurrent + x) / Tcurrent)
            uint256 costBin = _calcCost(x, qBin, Tcurrent);

            // Update state
            costTotal += costBin;
            q[marketId][binIdx] = qBin + x;
            Tcurrent += x;

            // Mint ERC1155 token
            uint256 tokenId = _getTokenId(marketId, binIdx);
            _mint(msg.sender, tokenId, x, "");
        }

        require(costTotal <= maxStable, "Slippage exceeded");
        
        // Transfer stablecoins from user to contract
        m.stableToken.safeTransferFrom(msg.sender, address(this), costTotal);

        // Update T
        m.T = Tcurrent;

        emit Bet(marketId, binIndices, amounts, costTotal);
    }

    // -------------------------
    // 마켓 종료
    // -------------------------
    /**
     * @dev 마켓을 종료하고 우승 bin을 설정
     * @param marketId 마켓 ID
     * @param winningBin 우승 bin 인덱스
     */
    function closeMarket(uint256 marketId, uint256 winningBin) external onlyOwner {
        MarketInfo storage m = markets[marketId];
        require(!m.closed, "Already closed");
        require(winningBin < m.binCount, "Invalid winning bin");

        m.closed = true;
        m.winningBin = winningBin;
        
        // 종료 시점의 스테이블코인 풀 잔액 저장
        m.poolAtClose = m.stableToken.balanceOf(address(this));

        emit MarketClosed(marketId, winningBin);
    }

    // -------------------------
    // 정산(Claim)
    // -------------------------
    /**
     * @dev 우승 bin 토큰 보유자가 보상을 청구
     * @param marketId 마켓 ID
     */
    function claimReward(uint256 marketId) external {
        MarketInfo storage m = markets[marketId];
        require(m.closed, "Market not closed");
        
        uint256 winningBin = m.winningBin;
        uint256 tokenId = _getTokenId(marketId, winningBin);
        uint256 userBalance = balanceOf(msg.sender, tokenId);
        
        require(userBalance > 0, "No tokens to claim");

        uint256 qWin = q[marketId][winningBin];
        require(qWin > 0, "No winners");

        // 계산: (보유 토큰 / 우승 bin 총 토큰 수) * 풀 잔액
        uint256 payout = (userBalance * m.poolAtClose) / qWin;

        // 토큰 소각
        _burn(msg.sender, tokenId, userBalance);

        // 스테이블코인 전송
        m.stableToken.safeTransfer(msg.sender, payout);

        emit Claimed(marketId, winningBin, msg.sender, payout);
    }

    // -------------------------
    // 조회 함수
    // -------------------------
    /**
     * @dev 특정 마켓의 bin에 대한 실제 틱 값 계산
     * @param marketId 마켓 ID
     * @param binIndex bin 인덱스
     * @return 실제 틱 값
     */
    function getActualTick(uint256 marketId, uint256 binIndex) public view returns (int256) {
        MarketInfo storage m = markets[marketId];
        require(binIndex < m.binCount, "Invalid bin index");
        
        uint256 a = (m.binCount - 1) / 2;
        return int256(m.baseTick) + int256(int256(binIndex) - int256(a)) * int256(m.tickSpacing);
    }

    /**
     * @dev 특정 bin에 대한 가격 계산 (1.0001^tick)
     * @param marketId 마켓 ID
     * @param binIndex bin 인덱스
     * @return 가격 (스케일된 값, 10^18로 나눠야 실제 값)
     */
    function getBinPrice(uint256 marketId, uint256 binIndex) external view returns (uint256) {
        int256 tick = getActualTick(marketId, binIndex);
        
        // PRBMath에서는 UD60x18 타입을 사용하여 계산
        if (tick >= 0) {
            UD60x18 base = wrap(1.0001e18);
            UD60x18 result = pow(base, wrap(uint256(tick) * 1e18));
            return unwrap(result);
        } else {
            UD60x18 base = wrap(1.0001e18);
            UD60x18 result = pow(base, wrap(uint256(-tick) * 1e18));
            return unwrap(div(wrap(1e36), result));
        }
    }

    // -------------------------
    // 내부 함수
    // -------------------------
    /**
     * @dev 비용 계산 - x + (q - T) * ln((T + x) / T)
     * @param x 새로 매수할 토큰 수량
     * @param qBin 현재 bin의 토큰 총량
     * @param Tcurrent 현재 마켓의 전체 토큰 총량
     * @return 비용
     */
    function _calcCost(uint256 x, uint256 qBin, uint256 Tcurrent) internal pure returns (uint256) {
        // x를 반환해야 하는 예외 케이스 처리
        if (Tcurrent == 0 || qBin == Tcurrent) {
            return x;
        }

        // PRBMath를 사용한 비용 계산
        // x + (qBin - Tcurrent) * ln((Tcurrent + x) / Tcurrent)
        UD60x18 xUD = wrap(x * 1e18);
        UD60x18 qUD = wrap(qBin * 1e18);
        UD60x18 TUD = wrap(Tcurrent * 1e18);
        UD60x18 TplusXUD = add(TUD, xUD);
        
        // ln((T + x) / T) 계산
        UD60x18 ratio = div(TplusXUD, TUD);
        UD60x18 lnPart = ln(ratio);
        
        // (q - T) * ln(...) 계산
        if (qBin >= Tcurrent) {
            UD60x18 diff = sub(qUD, TUD);
            UD60x18 secondTerm = mul(diff, lnPart);
            return x + unwrap(secondTerm) / 1e18;
        } else {
            UD60x18 diff = sub(TUD, qUD);
            UD60x18 secondTerm = mul(diff, lnPart);
            uint256 secondTermValue = unwrap(secondTerm) / 1e18;
            return x > secondTermValue ? x - secondTermValue : 0;
        }
    }

    /**
     * @dev 마켓 ID와 bin 인덱스로부터 ERC1155 토큰 ID 생성
     * @param marketId 마켓 ID
     * @param binIndex bin 인덱스
     * @return 토큰 ID
     */
    function _getTokenId(uint256 marketId, uint256 binIndex) internal pure returns (uint256) {
        return (marketId << 128) | binIndex;
    }

    /**
     * @dev ERC1155 URI 재정의
     * @param tokenId 토큰 ID
     * @return URI 문자열
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return super.uri(tokenId);
        // 실제 구현에서는 marketId와 binIndex에 따른 메타데이터를 반환하도록 구현 가능
    }
} 