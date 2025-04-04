# RangeBet - 멀티 마켓 예측 시스템

RangeBet은 (q+t)/(T+t) 적분 가격 공식과 Uniswap V3 스타일의 틱 기반 구간(빈) 시스템을 구현한 예측 시장 플랫폼입니다. 단일 컨트랙트로 여러 예측 시장을 동시에 운영할 수 있으며, 특수한 베팅 비용 계산 공식을 통해 유니크한 가격 책정 메커니즘을 제공합니다.

## 주요 기능

- 단일 매니저 컨트랙트로 여러 예측 시장 운영
- Uniswap V3 틱 구조(구간/빈)를 이용한 가격 범위 설정
- (q+t)/(T+t) 적분 공식을 통한 정교한 베팅 비용 계산
- ERC1155 기반의 유연한 토큰 관리
- 다양한 구간에 걸쳐 베팅 가능
- 승리 구간 설정 및 보상 분배 시스템

## 아키텍처

### 주요 컨트랙트

1. **RangeBetManager**:

   - 예측 시장 생성 및 관리
   - 베팅(토큰 구매) 처리
   - 시장 종료 및 승리 빈 설정
   - 보상 청구 처리

2. **RangeBetToken (ERC1155)**:

   - 모든 시장, 모든 빈에 대한 토큰 발행
   - marketId와 binIndex가 인코딩된 토큰 ID

3. **RangeBetMath**:

   - (q+t)/(T+t) 적분 공식을 계산하는 라이브러리
   - PRB Math 라이브러리를 활용한 고정 소수점 수학 연산

4. **MockCollateralToken**:
   - 테스트를 위한 담보 토큰

## 시작하기

### 필요 조건

- Node.js v16 이상
- Yarn 패키지 매니저
- Ethereum 개발 환경

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-username/signals-temp-contract.git
cd signals-temp-contract

# 의존성 설치
yarn install
```

### 컴파일

컨트랙트를 컴파일하려면:

```bash
yarn compile
```

### 테스트

모든 테스트를 실행하려면:

```bash
yarn test
```

특정 테스트만 실행하려면:

```bash
yarn test:market    # 시장 생성 관련 테스트만 실행
yarn test:token     # 토큰 관련 테스트만 실행
yarn test:math      # 수학 라이브러리 테스트만 실행
```

가스 사용량 보고서와 함께 테스트 실행:

```bash
yarn test:gas
```

### 로컬 배포

로컬 개발 노드에 컨트랙트를 배포하려면:

```bash
# 새 터미널에서 로컬 노드 실행
yarn node

# 다른 터미널에서 배포 실행
yarn deploy:local
```

### 테스트넷 배포

Sepolia 테스트넷에 배포하려면:

1. `.env` 파일 생성 후 필요한 환경 변수 설정:

```
PRIVATE_KEY=your_private_key_here
SEPOLIA_URL=your_sepolia_rpc_url_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

2. 배포 실행:

```bash
yarn deploy:sepolia
```

### 상호작용 테스트

이미 배포된 컨트랙트와 상호작용하려면:

```bash
yarn interact:local  # 로컬 노드에 배포된 컨트랙트와 상호작용
yarn interact:sepolia  # Sepolia에 배포된 컨트랙트와 상호작용
```

## 시스템 작동 방식

### 예측 시장 생성

관리자(컨트랙트 소유자)는 `createMarket()`을 호출하여 새로운 예측 시장을 만들 수 있습니다:

```javascript
await rangeBetManager.createMarket(
  60, // tickSpacing: 틱 간격
  -360, // minTick: 최소 틱
  360 // maxTick: 최대 틱
);
```

### 토큰 구매 (베팅)

사용자는 `buyTokens()`를 호출하여 다양한 구간(빈)에 베팅할 수 있습니다:

```javascript
await rangeBetManager.buyTokens(
  marketId, // 시장 ID
  [0, 60], // 베팅할 빈 인덱스
  [ethers.parseEther("100"), ethers.parseEther("50")], // 각 빈에 베팅할 금액
  ethers.parseEther("200") // 최대 지불 의향 금액
);
```

### 시장 종료 및 승리 빈 설정

관리자는 `closeMarket()`을 호출하여 시장을 종료하고 승리 빈을 설정합니다:

```javascript
await rangeBetManager.closeMarket(marketId, winningBin);
```

### 보상 청구

승리 빈의 토큰 홀더는 `claimReward()`를 호출하여 보상을 청구할 수 있습니다:

```javascript
await rangeBetManager.claimReward(marketId, winningBin);
```

## 수학적 배경

베팅 비용은 다음 적분식을 기반으로 계산됩니다:

\[
\int\_{t=0}^{x} \frac{q + t}{T + t} \,\mathrm{d}t
\;=\;
x + (q - T)\,\ln\!\Bigl(\frac{T + x}{T}\Bigr)
\]

- `q`: 현재 빈에 있는 토큰의 양
- `T`: 시장 전체 토큰의 총 공급량
- `x`: 구매하려는 토큰의 양

이 공식은 시장의 유동성에 따라 베팅 비용이 조정됨을 의미합니다. 인기 있는 구간에 베팅할수록 비용이 더 커집니다.

## 개발자 문서

더 자세한 개발 문서는 [docs/](./docs/) 디렉토리를 참조하세요.

## 라이센스

MIT 라이센스에 따라 라이센스가 부여됩니다. 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.
