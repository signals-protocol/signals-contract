# RangeBet 수학적 모델 설명

RangeBet 시스템의 핵심은 베팅 가격을 계산하는 수학적 모델입니다. 이 문서는 그 공식과 구현에 대해 설명합니다.

## 적분 공식 원리

RangeBet은 시장에서 사용자가 특정 빈(bin)에 베팅할 때 가격을 계산하기 위해 적분 공식을 사용합니다. 이 공식은 두 가지 주요 속성을 가지고 있습니다:

1. **유동성에 기반한 가격**: 특정 빈에 더 많은 베팅이 있을수록 해당 빈의 토큰 가격이 상승합니다.
2. **시장 규모에 따른 조정**: 전체 시장 규모가 커질수록 가격 영향이 줄어듭니다.

### 기본 공식

사용자가 특정 빈에 `x` 만큼의 토큰을 구매하려고 할 때, 비용은 다음 적분으로 계산됩니다:

![Cost = \int_{0}^{x} \frac{q + t}{T + t} dt](https://latex.codecogs.com/png.latex?Cost%20%3D%20%5Cint_%7B0%7D%5E%7Bx%7D%20%5Cfrac%7Bq%20%2B%20t%7D%7BT%20%2B%20t%7D%20dt)

여기서:

- `q`: 현재 해당 빈의 토큰 수량
- `T`: 시장 전체 토큰 공급량
- `t`: 적분 변수 (0부터 x까지)

### 적분 계산

위 적분을 풀면 다음과 같습니다:

![Integral Step 1](https://latex.codecogs.com/png.latex?%5Cint_%7B0%7D%5E%7Bx%7D%20%5Cfrac%7Bq%20%2B%20t%7D%7BT%20%2B%20t%7D%20dt%20%3D%20%5Cint_%7B0%7D%5E%7Bx%7D%20%5Cfrac%7Bq%20-%20T%20%2B%20T%20%2B%20t%7D%7BT%20%2B%20t%7D%20dt%20%3D%20%5Cint_%7B0%7D%5E%7Bx%7D%20%281%20%2B%20%5Cfrac%7Bq%20-%20T%7D%7BT%20%2B%20t%7D%29%20dt)

![Integral Step 2](https://latex.codecogs.com/png.latex?Cost%20%3D%20%5Bt%20%2B%20%28q%20-%20T%29%20%5Cln%28T%20%2B%20t%29%5D_%7B0%7D%5E%7Bx%7D%20%3D%20x%20%2B%20%28q%20-%20T%29%20%5Cln%5Cfrac%7BT%20%2B%20x%7D%7BT%7D)

### 특수 케이스

1. 빈에 토큰이 없는 경우 (`q = 0`):
   ![Case q = 0](https://latex.codecogs.com/png.latex?Cost%20%3D%20x%20-%20T%20%5Cln%5Cfrac%7BT%20%2B%20x%7D%7BT%7D)

2. 전체 시장과 빈의 토큰 수량이 같은 경우 (`q = T`):
   ![Case q = T](https://latex.codecogs.com/png.latex?Cost%20%3D%20x)

3. 빈의 토큰이 시장 전체보다 많은 경우 (`q > T`):
   ![Case q > T](https://latex.codecogs.com/png.latex?Cost%20%3E%20x)

4. 빈의 토큰이 시장 전체보다 적은 경우 (`q < T`):
   ![Case q < T](https://latex.codecogs.com/png.latex?Cost%20%3C%20x)

## 고정 소수점 구현

Solidity에서는 부동 소수점 연산이 제한적이므로, 이 공식은 고정 소수점 수학 라이브러리를 사용하여 구현되었습니다.

### PRBMath 라이브러리 사용

RangeBet은 [PRBMath](https://github.com/paulrberg/prb-math) 라이브러리를 사용하여 로그 함수와 고정 소수점 연산을 구현합니다.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { UD60x18, ud, unwrap } from "@prb/math/src/UD60x18.sol";

library RangeBetMath {
    function calculateCost(uint256 x, uint256 q, uint256 T) public pure returns (uint256) {
        if (x == 0) return 0;
        if (T == 0) return x; // 특수 케이스: 시장의 첫 번째 베팅

        // UD60x18로 변환
        UD60x18 xUD = ud(x);
        UD60x18 qUD = ud(q);
        UD60x18 TUD = ud(T);

        // 첫 번째 항: x
        UD60x18 cost = xUD;

        // 두 번째 항: (q-T)*ln((T+x)/T)
        if (q != T) { // q == T이면 이 부분은 0이 됨
            // (T+x)/T 계산
            UD60x18 ratio = (TUD + xUD) / TUD;
            // ln((T+x)/T) 계산
            UD60x18 logTerm = ratio.ln();

            // (q-T) 계산
            if (q > T) {
                // q > T이면, (q-T)*ln((T+x)/T) 더함
                UD60x18 qMinusT = qUD - TUD;
                cost = cost + (qMinusT * logTerm);
            } else {
                // q < T이면, (T-q)*ln((T+x)/T) 뺌
                UD60x18 TMinusq = TUD - qUD;
                // 언더플로우 방지
                if ((TMinusq * logTerm) > cost) {
                    return 0;
                }
                cost = cost - (TMinusq * logTerm);
            }
        }

        // uint256으로 변환
        return unwrap(cost);
    }
}
```

### 정밀도와 오차

고정 소수점 수학 연산에서는 정밀도 손실이 발생할 수 있습니다. PRBMath 라이브러리는 높은 정밀도를 제공하지만, 극단적인 값에서는 오차가 발생할 수 있습니다. 따라서 다음 제한을 두는 것이 좋습니다:

- 최소 토큰 수량: `1e6` (백만) 단위로 설정
- 최대 토큰 수량: `1e27` (10억 _ 10억 _ 10억) 미만

### 가스 최적화

고정 소수점 연산은 가스 비용이 많이 들 수 있습니다. RangeBetMath 구현은 다음과 같은 최적화를 포함합니다:

1. 특수 케이스 조기 처리 (`q = T`, `x = 0`, `T = 0`)
2. 부분 연산 결과 저장하여 재사용
3. 오버플로우 방지를 위한 순서 조정

## 시뮬레이션 및 시각화

실제 사용 시나리오에서 이 공식이 어떻게 작동하는지 이해하기 위해 아래 시뮬레이션을 제공합니다.

### 토큰 구매 비용 곡선

![토큰 구매 비용 곡선](https://via.placeholder.com/800x600.png?text=Token+Purchase+Cost+Curve)

그래프는 다음 조건에서 토큰 구매 비용을 보여줍니다:

- T = 1000 (시장 전체 토큰 공급량)
- 다양한 q 값 (빈의 현재 토큰 수량)
- x축: 구매하려는 토큰 수량 (x)
- y축: 필요한 담보 토큰 비용

### 다양한 시장 조건의 영향

시장 규모 (T)와 빈의 현재 토큰 수량 (q)에 따른 비용 변화:

| 시장 규모 (T) | 빈 토큰 (q) | 100 토큰 구매 비용 | 비고                      |
| ------------- | ----------- | ------------------ | ------------------------- |
| 1,000         | 0           | 90.7               | 할인 적용                 |
| 1,000         | 500         | 95.3               | 약간 할인                 |
| 1,000         | 1,000       | 100.0              | 정가                      |
| 1,000         | 2,000       | 109.3              | 프리미엄 적용             |
| 10,000        | 1,000       | 99.0               | 큰 시장에서 약간 할인     |
| 10,000        | 10,000      | 100.0              | 정가                      |
| 10,000        | 20,000      | 101.0              | 큰 시장에서 약간 프리미엄 |

## 응용 및 확장

이 수학적 모델은 다음과 같은 확장 가능성을 제공합니다:

1. **다양한 범위의 빈**:

   - 다양한 크기의 빈을 사용하여 다양한 가격 범위에 대한 예측 가능
   - 틱 간격을 조정하여 세분화 조정

2. **시간 경과에 따른 가격 변화**:

   - 시간이 지남에 따라 베팅 분포를 분석하여 가격 움직임 예측

3. **게임 이론적 최적 전략**:
   - 이 공식에 기반한 최적 베팅 전략 개발 가능
   - 다양한 시장 참가자의 행동 모델링

## 결론

RangeBet의 수학적 모델은 시장 참가자들에게 공정하고 효율적인 가격 책정 메커니즘을 제공합니다. 이는 일종의 AMM(Automated Market Maker) 모델로, 유동성이 낮은 빈에 베팅 시 할인을 제공하고, 인기 있는 빈에 베팅 시 프리미엄을 부과합니다.

이러한 메커니즘은 시장의 유동성과 효율성을 증진시키는 동시에, 사용자들이 덜 인기 있는 결과에 베팅할 인센티브를 제공합니다.
