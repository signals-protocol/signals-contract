# RangeBet 아키텍처 문서

이 문서는 RangeBet 시스템의 핵심 아키텍처와 컴포넌트를 설명합니다.

## 시스템 아키텍처 개요

RangeBet은 다음 주요 컴포넌트로 구성됩니다:

```
                 ┌─────────────────┐
                 │                 │
                 │  RangeBetMath   │◄────┐
                 │     Library     │     │
                 │                 │     │
                 └─────────────────┘     │
                                         │ 호출
                                         │
┌─────────────┐   생성    ┌─────────────▼─────────┐    mint/burn    ┌───────────────┐
│   Market 1  │◄─────────┤                        ├───────────────►│                │
└─────────────┘           │                        │                │                │
                          │    RangeBetManager     │                │  RangeBetToken │
┌─────────────┐   관리    │                        │                │    (ERC1155)   │
│   Market 2  │◄─────────┤                        │                │                │
└─────────────┘           └────────────▲──────────┘                └───────────────┘
                                        │
┌─────────────┐                         │ 전송
│   Market N  │                         │
└─────────────┘             ┌───────────┴───────────┐
                            │                       │
                            │    Collateral Token   │
                            │       (ERC20)         │
                            │                       │
                            └───────────────────────┘
```

### 컨트랙트 설명

## 1. RangeBetManager

중앙 관리 컨트랙트로서 모든 예측 마켓을 생성하고 관리합니다.

### 주요 상태 변수

```solidity
// 마켓 구조체
struct Market {
    bool active;             // 마켓 활성 상태
    bool closed;             // 마켓 종료 여부
    uint256 tickSpacing;     // 틱 간격 (e.g., 60)
    int256 minTick;          // 최소 틱 (e.g., -360)
    int256 maxTick;          // 최대 틱 (e.g., 360)
    uint256 T;               // 시장 전체 토큰 공급량
    uint256 collateralBalance; // 담보 토큰 총액
    int256 winningBin;       // 승리 빈 (마켓 종료 후 설정)
    mapping(int256 => uint256) q; // 각 빈별 토큰 수량
    mapping(address => mapping(int256 => bool)) hasClaimed; // 보상 청구 여부 추적
}

// 마켓 매핑
mapping(uint256 => Market) public markets;

// 토큰 컨트랙트 참조
RangeBetToken public rangeBetToken;
IERC20 public collateralToken;

// 마켓 카운터
uint256 public marketCount;
```

### 주요 함수

#### 1. 마켓 생성

```solidity
function createMarket(
    uint256 tickSpacing,
    int256 minTick,
    int256 maxTick
) external onlyOwner returns (uint256 marketId)
```

- Uniswap V3 스타일의 틱 간격과 범위로 새 예측 시장을 생성합니다.
- `marketId`는 내부 카운터를 기반으로 증가합니다.

#### 2. 토큰 구매 (베팅)

```solidity
function buyTokens(
    uint256 marketId,
    int256[] calldata binIndices,
    uint256[] calldata amounts,
    uint256 maxCollateral
) external nonReentrant
```

- 사용자가 여러 빈에 동시에 베팅할 수 있게 합니다.
- (q+t)/(T+t) 적분 공식을 사용하여 비용을 계산합니다.
- ERC1155 토큰을 발행하고 담보 토큰을 전송합니다.

#### 3. 마켓 종료

```solidity
function closeMarket(uint256 marketId, int256 winningBin) external onlyOwner
```

- 마켓을 종료하고 승리 빈을 설정합니다.
- 이후 해당 마켓에 대한 새로운 베팅은 불가능합니다.

#### 4. 보상 청구

```solidity
function claimReward(uint256 marketId, int256 binIndex) external nonReentrant
```

- 승리 빈의 토큰 보유자가 보상을 청구합니다.
- 토큰은 소각되고 사용자는 보유 비율에 따라 담보 토큰을 받습니다.

## 2. RangeBetToken (ERC1155)

모든 마켓과 빈에 대한 토큰을 관리하는 ERC1155 토큰 컨트랙트입니다.

### 토큰 ID 인코딩

```solidity
function encodeTokenId(uint256 marketId, int256 binIndex) public pure returns (uint256)
```

- `marketId`와 `binIndex`를 단일 `uint256` 토큰 ID로 인코딩합니다.
- `tokenId = (marketId << 128) + (binIndex + OFFSET)`
- `OFFSET`은 음수 빈 인덱스를 처리하기 위해 사용됩니다.

### 토큰 ID 디코딩

```solidity
function decodeTokenId(uint256 tokenId) public pure returns (uint256 marketId, int256 binIndex)
```

- 토큰 ID에서 원래의 `marketId`와 `binIndex`를 추출합니다.

## 3. RangeBetMath

베팅 비용 계산을 위한 적분 공식 구현을 담당하는 라이브러리입니다.

### 비용 계산 함수

```solidity
function calculateCost(uint256 x, uint256 q, uint256 T) public pure returns (uint256)
```

- (q+t)/(T+t) 적분 공식을 계산합니다: `x + (q-T)*ln((T+x)/T)`
- `x`: 구매하려는 토큰 양
- `q`: 현재 빈의 토큰 양
- `T`: 시장 전체 토큰 공급량

## 모듈 간 상호작용

1. **RangeBetManager ↔ RangeBetMath**:

   - 베팅 비용 계산을 위해 Manager는 Math 라이브러리를 호출합니다.

2. **RangeBetManager ↔ RangeBetToken**:

   - 베팅 시 Manager는 사용자를 위한 토큰을 발행합니다.
   - 보상 청구 시 Manager는 토큰을 소각합니다.

3. **RangeBetManager ↔ CollateralToken**:
   - 베팅 시 담보 토큰은 사용자로부터 Manager로 전송됩니다.
   - 보상 청구 시 담보 토큰은 Manager에서 사용자로 전송됩니다.

## 데이터 흐름

1. **마켓 생성**:

   ```
   Owner → RangeBetManager.createMarket() → Market Storage
   ```

2. **베팅(토큰 구매)**:

   ```
   User → RangeBetManager.buyTokens() → RangeBetMath.calculateCost() → RangeBetToken.mint() → CollateralToken.transferFrom()
   ```

3. **마켓 종료**:

   ```
   Owner → RangeBetManager.closeMarket() → Market Storage (closed=true, winningBin=X)
   ```

4. **보상 청구**:
   ```
   User → RangeBetManager.claimReward() → RangeBetToken.burn() → CollateralToken.transfer() → User
   ```

## 보안 고려사항

1. **재진입 보호**:

   - `buyTokens()`와 `claimReward()` 함수는 `nonReentrant` 수정자로 보호됩니다.

2. **액세스 제어**:

   - 마켓 생성 및 종료는 `onlyOwner`로 제한됩니다.
   - 토큰 발행 및 소각은 `onlyManager`로 제한됩니다.

3. **슬리피지 보호**:

   - `maxCollateral` 매개변수로 사용자는 최대 지불 의향 금액을 지정할 수 있습니다.

4. **이중 청구 방지**:
   - `hasClaimed` 매핑으로 사용자가 보상을 두 번 청구하는 것을 방지합니다.

## 가스 최적화

1. 여러 빈에 대한 베팅을 단일 트랜잭션으로 처리
2. 토큰 ID 인코딩/디코딩의 비트 연산 최적화
3. 고정 소수점 수학 연산의 효율적 구현

## 확장성 고려사항

1. **다중 담보 토큰**:

   - 시스템은 마켓별로 다른 담보 토큰을 지원하도록 확장될 수 있습니다.

2. **오라클 통합**:

   - 외부 오라클을 통합하여 승리 빈을 자동으로 결정할 수 있습니다.

3. **거버넌스**:

   - 관리자 권한을 DAO나 다중 서명 지갑으로 이전할 수 있습니다.

4. **프론트엔드 지원**:
   - 토큰 메타데이터 URI 시스템이 각 마켓과 빈에 대한 풍부한 메타데이터를 제공할 수 있습니다.
