# RangeBetMath API 문서

`RangeBetMath` 라이브러리는 RangeBet 시스템의 토큰 구매 비용 계산을 담당하는 수학 라이브러리입니다. 이 라이브러리는 PRBMath 라이브러리를 사용하여 고정 소수점 수학 연산을 구현합니다.

## 개요

RangeBetMath는 (q+t)/(T+t) 적분을 기반으로 한 비용 계산 공식을 구현합니다. 이 공식은 마켓의 현재 상태와 구매하려는 토큰 수량을 고려하여 사용자가 지불해야 할 담보 토큰의 양을 계산합니다.

## 의존성

```solidity
import "@prb/math/contracts/PRBMath.sol";
```

- PRBMath: 고정 소수점 수학 연산을 위한 라이브러리

## 수학적 기초

### 기본 공식

사용자가 특정 빈에 `x` 만큼의 토큰을 구매하려고 할 때, 비용은 다음 적분으로 계산됩니다:

$$ \text{Cost} = \int\_{0}^{x} \frac{q + t}{T + t} dt $$

### 최종 공식

적분을 풀면 다음과 같은 공식이 도출됩니다:

$$ \text{Cost} = x + (q - T) \ln\frac{T + x}{T} $$

여기서:

- `x`: 구매하려는 토큰 수량
- `q`: 현재 해당 빈의 토큰 수량
- `T`: 시장 전체 토큰 공급량
- `ln`: 자연 로그 함수

## 함수

### calculateCost

```solidity
function calculateCost(
    uint256 x,
    uint256 q,
    uint256 T
) public pure returns (uint256)
```

지정된 매개변수를 기반으로 토큰 구매 비용을 계산합니다.

#### 매개변수

- `x`: 구매하려는 토큰 수량
- `q`: 현재 빈의 토큰 수량
- `T`: 시장 전체 토큰 공급량

#### 반환값

- 계산된 담보 토큰 비용

#### 특수 케이스

- `q == T`인 경우, 비용은 정확히 `x`가 됩니다.
- `q > T`인 경우, 비용은 `x`보다 큽니다 (프리미엄).
- `q < T`인 경우, 비용은 `x`보다 작습니다 (할인).

#### 구현 세부 사항

```solidity
function calculateCost(uint256 x, uint256 q, uint256 T) public pure returns (uint256) {
    // 특수 케이스: q = T
    if (q == T) {
        return x;
    }

    // x + (q - T) * ln((T + x) / T)
    uint256 cost;

    // 첫 번째 항: x
    cost = x;

    // (T + x) / T 계산
    uint256 ratio = PRBMath.mulDiv(T + x, PRBMath.SCALE, T);

    // ln((T + x) / T) 계산
    uint256 lnRatio = PRBMath.ln(ratio);

    // q > T 인 경우
    if (q > T) {
        // 두 번째 항: (q - T) * ln((T + x) / T)
        uint256 secondTerm = PRBMath.mulDiv(q - T, lnRatio, PRBMath.SCALE);
        cost = cost + secondTerm;
    } else {
        // q < T 인 경우
        // 두 번째 항: (q - T) * ln((T + x) / T), q < T 이므로 이 값은 음수
        uint256 secondTerm = PRBMath.mulDiv(T - q, lnRatio, PRBMath.SCALE);
        cost = cost > secondTerm ? cost - secondTerm : 0;
    }

    return cost;
}
```

## 사용 예시

### RangeBetManager에서의 사용

```solidity
// RangeBetManager 컨트랙트 내부
import "./RangeBetMath.sol";

contract RangeBetManager {
    // RangeBetMath 라이브러리 사용
    using RangeBetMath for uint256;

    // ...

    function _calculateBinCost(
        uint256 amount,
        uint256 binQuantity,
        uint256 totalSupply
    ) internal pure returns (uint256) {
        // RangeBetMath 라이브러리를 사용하여 비용 계산
        return RangeBetMath.calculateCost(amount, binQuantity, totalSupply);
    }

    // ...
}
```

### 독립적인 사용

```solidity
// 별도의 컨트랙트나 스크립트에서
import "./RangeBetMath.sol";

contract ExampleContract {
    // RangeBetMath 사용 예시
    function calculateExampleCost() public pure returns (uint256) {
        uint256 tokensToBuy = 100 * 10**18;  // 100 토큰
        uint256 currentBinQuantity = 500 * 10**18;  // 현재 빈에 500 토큰
        uint256 marketTotalSupply = 1000 * 10**18;  // 시장 전체 1000 토큰

        // 비용 계산
        return RangeBetMath.calculateCost(
            tokensToBuy,
            currentBinQuantity,
            marketTotalSupply
        );
    }
}
```

## 성능 고려사항

### 가스 최적화

RangeBetMath 라이브러리는 복잡한 수학 연산을 포함하므로 가스 비용이 상당할 수 있습니다. 다음과 같은 최적화가

적용되었습니다:

1. 특수 케이스 조기 처리 (`q = T`)
2. 부분 연산 결과 저장하여 재사용
3. PRBMath의 최적화된 고정 소수점 연산 사용

### 권장 사용법

- 온체인 계산의 가스 비용을 절약하기 위해, 가능하면 오프체인에서 비용을 미리 계산하고 검증용으로만 온체인 계산을 사용하는 것이 좋습니다.
- 큰 숫자를 다룰 때는 오버플로우를 방지하기 위해 충분한 테스트를 수행하세요.

## 제한사항

- PRBMath 라이브러리의 정밀도 한계로 인해, 극단적인 값에서는 근사치가 반환될 수 있습니다.
- 매우 큰 토큰 수량 (> 1e27)은 오버플로우를 일으킬 수 있으므로, 가능한 합리적인 범위 내에서 사용하는 것이 좋습니다.

## 모의 계산 예시

| 구매량 (x) | 빈 수량 (q) | 시장 총량 (T) | 계산된 비용 | 비율 (비용/x) |
| ---------- | ----------- | ------------- | ----------- | ------------- |
| 10         | 0           | 100           | 9.05        | 0.905         |
| 10         | 50          | 100           | 9.53        | 0.953         |
| 10         | 100         | 100           | 10.00       | 1.000         |
| 10         | 200         | 100           | 10.95       | 1.095         |
| 100        | 0           | 1000          | 90.5        | 0.905         |
| 100        | 500         | 1000          | 95.3        | 0.953         |
| 100        | 1000        | 1000          | 100.0       | 1.000         |
| 100        | 2000        | 1000          | 109.3       | 1.093         |
