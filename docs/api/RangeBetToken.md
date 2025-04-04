# RangeBetToken API 문서

`RangeBetToken` 컨트랙트는 RangeBet 시스템의 토큰 관리를 담당하는 ERC1155 기반 컨트랙트입니다. 이 컨트랙트는 모든 마켓과 빈(bin)의 토큰을 추적합니다.

## 상수

```solidity
uint256 private constant OFFSET = 2**127;
```

- `OFFSET`: 음수 빈 인덱스를 처리하기 위한 오프셋 값

## 상태 변수

```solidity
address public manager;
```

- `manager`: RangeBetManager 컨트랙트 주소 (토큰 발행 및 소각 권한 보유)

## 이벤트

```solidity
event ManagerSet(address indexed manager);
```

## 수정자

```solidity
modifier onlyManager()
```

함수 호출자가 설정된 `manager` 주소와 동일한지 확인합니다.

## 생성자

```solidity
constructor() ERC1155("")
```

빈 URI로 ERC1155 토큰을 초기화합니다.

## 관리 함수

### setManager

```solidity
function setManager(address _manager) external
```

RangeBetManager 컨트랙트 주소를 설정합니다.

#### 매개변수

- `_manager`: 새로운 매니저 주소

#### 조건

- `manager`가 아직 설정되지 않았거나, 함수 호출자가 현재 `manager`여야 합니다.
- 새 매니저 주소는 0 주소가 아니어야 합니다.

#### 이벤트

- `ManagerSet`: 매니저 주소 설정 시 발생합니다.

## 토큰 관리 함수

### mint

```solidity
function mint(
    address account,
    uint256 marketId,
    int256 binIndex,
    uint256 amount
) external onlyManager
```

특정 마켓의 특정 빈에 대한 토큰을 발행합니다.

#### 매개변수

- `account`: 토큰을 받을 주소
- `marketId`: 마켓 ID
- `binIndex`: 빈 인덱스
- `amount`: 발행할 토큰 수량

#### 조건

- 함수 호출자가 `manager`여야 합니다.

### burn

```solidity
function burn(
    address account,
    uint256 marketId,
    int256 binIndex,
    uint256 amount
) external onlyManager
```

특정 마켓의 특정 빈에 대한 토큰을 소각합니다.

#### 매개변수

- `account`: 토큰을 소각할 주소
- `marketId`: 마켓 ID
- `binIndex`: 빈 인덱스
- `amount`: 소각할 토큰 수량

#### 조건

- 함수 호출자가 `manager`여야 합니다.

## 토큰 ID 인코딩/디코딩 함수

### encodeTokenId

```solidity
function encodeTokenId(uint256 marketId, int256 binIndex) public pure returns (uint256)
```

마켓 ID와 빈 인덱스를 단일 토큰 ID로 인코딩합니다.

#### 매개변수

- `marketId`: 마켓 ID
- `binIndex`: 빈 인덱스

#### 반환값

- 인코딩된 토큰 ID

#### 인코딩 방식

토큰 ID는 다음과 같이 계산됩니다:

```
tokenId = (marketId << 128) + (binIndex + OFFSET)
```

여기서 `OFFSET`은 음수 빈 인덱스를 처리하기 위해 사용됩니다.

### decodeTokenId

```solidity
function decodeTokenId(uint256 tokenId) public pure returns (uint256 marketId, int256 binIndex)
```

토큰 ID를 마켓 ID와 빈 인덱스로 디코딩합니다.

#### 매개변수

- `tokenId`: 디코딩할 토큰 ID

#### 반환값

- `marketId`: 마켓 ID
- `binIndex`: 빈 인덱스

#### 디코딩 방식

마켓 ID와 빈 인덱스는 다음과 같이 추출됩니다:

```
marketId = tokenId >> 128
binIndex = int256((tokenId & ((1 << 128) - 1)) - OFFSET)
```

## ERC1155 확장 함수

### uri

```solidity
function uri(uint256 tokenId) public view override returns (string memory)
```

토큰 메타데이터 URI를 반환합니다. 현재는 구현되지 않았으며 빈 문자열을 반환합니다.

#### 매개변수

- `tokenId`: URI를 조회할 토큰 ID

#### 반환값

- 토큰 메타데이터 URI 문자열

## 오류 코드

```solidity
error ManagerAlreadySet();
error NotManager();
error ZeroAddressNotAllowed();
```

## 사용 예시

### 매니저 설정

```solidity
// 컨트랙트 인스턴스 가져오기
RangeBetToken token = RangeBetToken(tokenAddress);

// 매니저 설정 (초기 배포 시)
token.setManager(managerAddress);
```

### 토큰 ID 인코딩/디코딩

```solidity
// 컨트랙트 인스턴스 가져오기
RangeBetToken token = RangeBetToken(tokenAddress);

// 토큰 ID 인코딩
uint256 tokenId = token.encodeTokenId(1, 60);

// 토큰 ID 디코딩
(uint256 marketId, int256 binIndex) = token.decodeTokenId(tokenId);
// marketId == 1, binIndex == 60
```

### 토큰 밸런스 조회

```solidity
// 컨트랙트 인스턴스 가져오기
RangeBetToken token = RangeBetToken(tokenAddress);

// 특정 마켓, 특정 빈의 토큰 밸런스 조회
uint256 marketId = 1;
int256 binIndex = 60;
uint256 tokenId = token.encodeTokenId(marketId, binIndex);
uint256 balance = token.balanceOf(userAddress, tokenId);
```

### 토큰 발행 (RangeBetManager에서만 호출 가능)

```solidity
// RangeBetManager 내부 구현 예시
function buyTokens(...) external {
    // ... 비용 계산 등

    // 토큰 발행
    rangeBetToken.mint(msg.sender, marketId, binIndex, amount);

    // ...
}
```

### 토큰 소각 (RangeBetManager에서만 호출 가능)

```solidity
// RangeBetManager 내부 구현 예시
function claimReward(...) external {
    // ... 보상 계산 등

    // 토큰 소각
    rangeBetToken.burn(msg.sender, marketId, binIndex, amount);

    // ...
}
```
