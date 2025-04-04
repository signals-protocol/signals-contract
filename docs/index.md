# RangeBet 문서

RangeBet은 Uniswap V3 스타일의 틱 기반 시스템을 활용한 다중 마켓 예측 플랫폼입니다. 이 문서는 RangeBet 프로토콜의 모든 측면에 대한 종합적인 정보를 제공합니다.

## 목차

### 개요

- [아키텍처 개요](ARCHITECTURE.md) - 시스템 구성요소와 상호작용에 대한 개요
- [수학적 모델](MATH.md) - 베팅 비용 계산을 위한 수학적 공식 및 구현 설명

### 개발자 가이드

- [통합 가이드](INTEGRATION.md) - RangeBet 프로토콜과의 통합 방법
- [기여 가이드](CONTRIBUTING.md) - 프로젝트 기여 방법 및 코딩 표준
- [보안 개요](SECURITY.md) - 보안 모델, 위험 및 취약점 보고 절차

### API 참조

- [RangeBetManager API](api/RangeBetManager.md) - 마켓 관리 컨트랙트 API
- [RangeBetToken API](api/RangeBetToken.md) - 토큰 컨트랙트 API
- [RangeBetMath API](api/RangeBetMath.md) - 수학 라이브러리 API

## 핵심 개념

### 예측 마켓

RangeBet 시스템은 사용자가 특정 결과 범위에 베팅할 수 있는 예측 마켓을 제공합니다. 각 마켓은 다음과 같은 요소로 구성됩니다:

- **범위 (빈)**: 가능한 결과값의 범위를 나타내는 구간
- **틱 간격**: 각 빈 사이의 간격
- **베팅 토큰**: 특정 빈에 베팅하는 토큰 (ERC1155)
- **담보 토큰**: 베팅에 사용되는 ERC20 토큰

### 베팅 메커니즘

RangeBet의 핵심 베팅 메커니즘은 다음과 같은 특징을 가집니다:

1. **유동성 기반 가격**: 특정 빈에 대한 베팅이 많을수록 해당 빈에 베팅하는 비용이 증가합니다.
2. **비선형 가격 곡선**: (q+t)/(T+t) 적분 공식을 기반으로 한 가격 책정
3. **승자 독식**: 마켓이 종료되면 승리한 빈의 토큰 보유자만 보상을 받습니다.

## 시작하기

### 설치 및 설정

```bash
# 저장소 복제
git clone https://github.com/yourusername/rangebet.git
cd rangebet

# 의존성 설치
yarn install

# 컨트랙트 컴파일
yarn compile

# 테스트 실행
yarn test
```

### 로컬 개발 환경

```bash
# 로컬 하드햇 노드 실행
npx hardhat node

# 컨트랙트 배포
npx hardhat run scripts/deploy.ts --network localhost

# 상호작용 스크립트 실행
npx hardhat run scripts/interact.ts --network localhost
```

## 예제 코드

### 마켓 생성

```typescript
// RangeBetManager 컨트랙트 인스턴스 가져오기
const manager = await ethers.getContractAt("RangeBetManager", managerAddress);

// 틱 간격 60, 범위 -360에서 360까지의 마켓 생성
const tx = await manager.createMarket(60, -360, 360);
const receipt = await tx.wait();

// 마켓 ID 추출
const marketCreatedEvent = receipt.events?.find(
  (event) => event.event === "MarketCreated"
);
const marketId = marketCreatedEvent?.args?.marketId;
console.log(`마켓 생성 완료, ID: ${marketId}`);
```

### 베팅 (토큰 구매)

```typescript
// 담보 토큰 승인
const collateral = await ethers.getContractAt("IERC20", collateralAddress);
await collateral.approve(managerAddress, ethers.utils.parseEther("100"));

// 빈 0에 베팅
const binIndices = [0];
const amounts = [ethers.utils.parseEther("10")];
const maxCollateral = ethers.utils.parseEther("100");

// 토큰 구매
await manager.buyTokens(marketId, binIndices, amounts, maxCollateral);
```

### 마켓 종료 및 보상 청구

```typescript
// 마켓 종료 (승리 빈: 0)
await manager.closeMarket(marketId, 0);

// 보상 청구
await manager.claimReward(marketId, 0);
```

## 콘솔 도구

```bash
# 하드햇 콘솔 열기
npx hardhat console --network localhost

# 컨트랙트 인스턴스 가져오기
const manager = await ethers.getContractAt("RangeBetManager", "0x...");
const token = await ethers.getContractAt("RangeBetToken", "0x...");

# 마켓 정보 조회
const market = await manager.markets(0);
console.log(market);
```

## 지원 및 문의

- **GitHub 이슈**: 버그 보고 및 기능 요청
- **이메일**: support@example.com
- **Discord**: [RangeBet Discord 채널](https://discord.gg/example)

## 라이선스

RangeBet은 MIT 라이선스로 제공됩니다. 자세한 내용은 [LICENSE](../LICENSE) 파일을 참조하세요.
