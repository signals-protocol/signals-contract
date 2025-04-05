# RangeBetManager API 문서

`RangeBetManager` 컨트랙트는 RangeBet 시스템의 핵심 컨트랙트로, 모든 예측 마켓의 생성 및 관리를 담당합니다.

## 상태 변수

### 공개 변수

```solidity
RangeBetToken public rangeBetToken;
IERC20 public collateralToken;
uint256 public marketCount;
mapping(uint256 => Market) public markets;
```

- `rangeBetToken`: ERC1155 토큰 컨트랙트 인스턴스
- `collateralToken`: 담보로 사용되는 ERC20 토큰 컨트랙트 인스턴스
- `marketCount`: 생성된 마켓의 총 수
- `markets`: 마켓 ID를 마켓 데이터에 매핑

### 마켓 구조체

```solidity
struct Market {
    bool active;                    // 마켓 활성 상태
    bool closed;                    // 마켓 종료 여부
    uint256 tickSpacing;            // 틱 간격
    int256 minTick;                 // 최소 틱
    int256 maxTick;                 // 최대 틱
    uint256 T;                      // 시장 전체 토큰 공급량
    uint256 collateralBalance;      // 담보 토큰 총액
    int256 winningBin;              // 승리한 빈 (마켓 종료 후 설정)
    uint256 openTimestamp;          // 마켓 생성 시점의 타임스탬프
    uint256 closeTimestamp;         // 마켓 종료 예정 시간 (메타데이터로만 사용)
    mapping(int256 => uint256) q;   // 각 빈별 토큰 수량
}
```

## 이벤트

```solidity
event MarketCreated(uint256 indexed marketId, uint256 tickSpacing, int256 minTick, int256 maxTick, uint256 openTimestamp, uint256 closeTimestamp);
event TokensPurchased(uint256 indexed marketId, address indexed buyer, int256[] binIndices, uint256[] amounts, uint256 collateralAmount);
event MarketClosed(uint256 indexed marketId, int256 winningBin);
event RewardClaimed(uint256 indexed marketId, address indexed claimer, int256 binIndex, uint256 tokenAmount, uint256 rewardAmount);
event CollateralWithdrawn(address indexed to, uint256 amount);
```

## 생성자

```solidity
constructor(address _rangeBetToken, address _collateralToken) Ownable()
```

### 매개변수

- `_rangeBetToken`: RangeBetToken 컨트랙트 주소
- `_collateralToken`: 담보 토큰 컨트랙트 주소

## 기본 함수

### createMarket

```solidity
function createMarket(
    uint256 tickSpacing,
    int256 minTick,
    int256 maxTick,
    uint256 _closeTime
) external onlyOwner returns (uint256 marketId)
```

새로운 예측 시장을 생성합니다.

#### 매개변수

- `tickSpacing`: 틱 간격
- `minTick`: 최소 틱 값
- `maxTick`: 최대 틱 값
- `_closeTime`: 마켓이 종료될 예정 시간 (메타데이터로만 사용)

#### 반환값

- `marketId`: 생성된 마켓의 ID

#### 조건

- 함수 호출자가 컨트랙트 소유자여야 합니다.
- `minTick`은 `maxTick`보다 작아야 합니다.
- `tickSpacing`은 양수여야 합니다.
- `minTick`과 `maxTick`은 `tickSpacing`으로 나누어 떨어져야 합니다.

#### 이벤트

- `MarketCreated`: 마켓 생성 시 발생합니다. 이벤트에는 `openTimestamp`와 `closeTimestamp`가 포함됩니다.

### buyTokens

```solidity
function buyTokens(
    uint256 marketId,
    int256[] calldata binIndices,
    uint256[] calldata amounts,
    uint256 maxCollateral
) external nonReentrant
```

특정 마켓의 여러 빈에 베팅 토큰을 구매합니다.

#### 매개변수

- `marketId`: 베팅할 마켓 ID
- `binIndices`: 베팅할 빈 인덱스 배열
- `amounts`: 각 빈에 구매할 토큰 수량 배열
- `maxCollateral`: 최대 담보 토큰 양 (슬리피지 보호)

#### 조건

- 마켓이 존재하고 활성화되어 있어야 합니다.
- 마켓이 종료되지 않았어야 합니다.
- `binIndices`와 `amounts` 배열의 길이가 같아야 합니다.
- 각 빈 인덱스는 마켓의 최소/최대 틱 범위 내에 있어야 합니다.
- 각 빈 인덱스는 `tickSpacing`의 배수여야 합니다.
- 사용자는 충분한 담보 토큰을 승인해야 합니다.
- 계산된 총 비용은 `maxCollateral`을 초과하지 않아야 합니다.

#### 이벤트

- `TokensPurchased`: 토큰 구매 시 발생합니다.

### closeMarket

```solidity
function closeMarket(uint256 marketId, int256 winningBin) external onlyOwner
```

예측 마켓을 종료하고 승리한 빈을 설정합니다.

#### 매개변수

- `marketId`: 종료할 마켓 ID
- `winningBin`: 승리한 빈 인덱스

#### 조건

- 함수 호출자가 컨트랙트 소유자여야 합니다.
- 마켓이 존재하고 활성화되어 있어야 합니다.
- 마켓이 아직 종료되지 않았어야 합니다.
- 승리한 빈은 마켓의 최소/최대 틱 범위 내에 있어야 합니다.
- 승리한 빈은 `tickSpacing`의 배수여야 합니다.

#### 이벤트

- `MarketClosed`: 마켓 종료 시 발생합니다.

### claimReward

```solidity
function claimReward(uint256 marketId, int256 binIndex) external nonReentrant
```

종료된 마켓에서 승리한 빈의 보상을 청구합니다.

#### 매개변수

- `marketId`: 보상을 청구할 마켓 ID
- `binIndex`: 보상을 청구할 빈 인덱스

#### 조건

- 마켓이 존재하고 종료되었어야 합니다.
- 청구하려는 빈은 승리한 빈이어야 합니다.
- 사용자는 해당 빈의 토큰을 보유하고 있어야 합니다.

#### 중복 청구 방지

이 함수는 사용자의 토큰을 완전히 소각하기 때문에, 토큰을 한 번 청구하면 잔액이 0이 되어 중복 청구가 자연스럽게 방지됩니다. 두 번째 청구 시도는 `No tokens to claim` 오류로 실패합니다.

#### 이벤트

- `RewardClaimed`: 보상 청구 시 발생합니다.

### withdrawAllCollateral

```solidity
function withdrawAllCollateral(address to) external onlyOwner
```

컨트랙트에 있는 모든 담보 토큰을 인출합니다.

#### 매개변수

- `to`: 담보를 전송할 주소

#### 조건

- 함수 호출자가 컨트랙트 소유자여야 합니다.
- 인출할 담보 토큰이 존재해야 합니다.

#### 이벤트

- `CollateralWithdrawn`: 담보 인출 시 발생합니다.

## View 함수

### getMarketInfo

```solidity
function getMarketInfo(uint256 marketId) external view returns (
    bool active,
    bool closed,
    uint256 tickSpacing,
    int256 minTick,
    int256 maxTick,
    uint256 T,
    uint256 collateralBalance,
    int256 winningBin,
    uint256 openTimestamp,
    uint256 closeTimestamp
)
```

특정 마켓의 정보를 반환합니다.

#### 매개변수

- `marketId`: 마켓 ID

#### 반환값

- `active`: 마켓 활성 상태
- `closed`: 마켓 종료 여부
- `tickSpacing`: 틱 간격
- `minTick`: 최소 틱 값
- `maxTick`: 최대 틱 값
- `T`: 시장 전체 토큰 공급량
- `collateralBalance`: 담보 토큰 총액
- `winningBin`: 승리한 빈 (마켓 종료 후 설정)
- `openTimestamp`: 마켓 생성 시점의 타임스탬프
- `closeTimestamp`: 마켓 종료 예정 시간 (메타데이터)

### getBinQuantity

```solidity
function getBinQuantity(uint256 marketId, int256 binIndex) external view returns (uint256)
```

특정 마켓의 특정 빈에 있는 토큰 수량을 반환합니다.

#### 매개변수

- `marketId`: 마켓 ID
- `binIndex`: 빈 인덱스

#### 반환값

- 해당 빈의 토큰 수량

### validateBinIndex

```solidity
function validateBinIndex(uint256 marketId, int256 binIndex) public view
```

빈 인덱스가 유효한지 확인합니다. 유효하지 않으면 revert 합니다.

#### 매개변수

- `marketId`: 마켓 ID
- `binIndex`: 확인할 빈 인덱스

### 담보 인출

```solidity
// 컨트랙트 인스턴스 가져오기
RangeBetManager manager = RangeBetManager(managerAddress);

// 모든 담보 인출 (소유자만 가능)
manager.withdrawAllCollateral(ownerAddress);
```

## 내부 함수

### \_calculateCost

```solidity
function _calculateCost(
    uint256 marketId,
    int256[] calldata binIndices,
    uint256[] calldata amounts
) internal view returns (uint256 totalCost)
```

여러 빈에 걸친 베팅 비용을 계산합니다.

#### 매개변수

- `marketId`: 마켓 ID
- `binIndices`: 베팅할 빈 인덱스 배열
- `amounts`: 각 빈에 구매할 토큰 수량 배열

#### 반환값

- `totalCost`: 모든 빈에 대한 총 비용

### \_calculateBinCost

```solidity
function _calculateBinCost(
    uint256 amount,
    uint256 binQuantity,
    uint256 totalSupply
) internal pure returns (uint256)
```

단일 빈에 대한 베팅 비용을 계산합니다.

#### 매개변수

- `amount`: 구매할 토큰 수량
- `binQuantity`: 현재 빈의 토큰 수량
- `totalSupply`: 시장 전체 토큰 공급량

#### 반환값

- 계산된 비용

## 오류 코드

```solidity
error MarketNotActive();
error MarketAlreadyClosed();
error InvalidBinIndex();
error ArrayLengthMismatch();
error ZeroAmount();
error CollateralTransferFailed();
error NotWinningBin();
error NoTokens();
error CollateralTooHigh();
error MinTickGreaterThanMaxTick();
error TickSpacingZero();
error TickNotDivisibleBySpacing();
```

## 사용 예시

### 마켓 생성

```solidity
// 컨트랙트 인스턴스 가져오기
RangeBetManager manager = RangeBetManager(managerAddress);

// 종료 예정 시간 계산 (예: 1주일 후)
uint256 closeTime = block.timestamp + 7 days;

// 마켓 생성
uint256 marketId = manager.createMarket(60, -360, 360, closeTime);
```

### 베팅

```solidity
// 컨트랙트 인스턴스 가져오기
RangeBetManager manager = RangeBetManager(managerAddress);
IERC20 collateral = IERC20(collateralAddress);

// 담보 토큰 승인
collateral.approve(managerAddress, 100 ether);

// 베팅 실행
int256[] memory binIndices = new int256[](1);
uint256[] memory amounts = new uint256[](1);

binIndices[0] = 0; // 빈 0에 베팅
amounts[0] = 10 ether; // 10 토큰 구매

manager.buyTokens(0, binIndices, amounts, 100 ether);
```

### 마켓 종료

```solidity
// 컨트랙트 인스턴스 가져오기
RangeBetManager manager = RangeBetManager(managerAddress);

// 마켓 종료 (소유자만 가능)
manager.closeMarket(0, 0); // 마켓 0 종료, 빈 0이 승리
```

### 보상 청구

```solidity
// 컨트랙트 인스턴스 가져오기
RangeBetManager manager = RangeBetManager(managerAddress);

// 보상 청구
manager.claimReward(0, 0); // 마켓 0의 빈 0에서 보상 청구
```
