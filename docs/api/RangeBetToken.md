# RangeBetToken API 문서

`RangeBetToken` 컨트랙트는 RangeBet 시스템의 토큰 관리를 담당하는 ERC1155 기반 컨트랙트입니다. 이 컨트랙트는 모든 마켓과 빈(bin)의 토큰을 추적합니다.

## 상수

```solidity
uint256 private constant OFFSET = 1e9;
```

- `OFFSET`: 음수 빈 인덱스를 처리하기 위한 오프셋 값

## 상태 변수

```solidity
address public manager;
```

- `manager`: RangeBetManager 컨트랙트 주소 (토큰 발행 및 소각 권한 보유)

## 이벤트

```solidity
event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 amount);
event TokenBurned(address indexed from, uint256 indexed tokenId, uint256 amount);
```

## 수정자

```solidity
modifier onlyManager()
```

함수 호출자가 설정된 `manager` 주소와 동일한지 확인합니다.

## 생성자

```solidity
constructor(string memory uri_, address manager_) ERC1155(uri_)
```

지정된 URI로 ERC1155 토큰을 초기화하고 manager 주소를 설정합니다.

#### 매개변수

- `uri_`: 토큰 메타데이터의 기본 URI
- `manager_`: 매니저 컨트랙트 주소

## 토큰 관리 함수

### mint

```solidity
function mint(address to, uint256 id, uint256 amount) external onlyManager
```

특정 토큰 ID에 해당하는 토큰을 발행합니다.

#### 매개변수

- `to`: 토큰을 받을 주소
- `id`: 토큰 ID (마켓 ID와 빈 인덱스가 인코딩됨)
- `amount`: 발행할 토큰 수량

#### 조건

- 함수 호출자가 `manager`여야 합니다.

#### 이벤트

- `TokenMinted`: 토큰 발행 시 발생합니다.

### mintBatch

```solidity
function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyManager
```

여러 토큰 ID에 대한 토큰을 한 번에 발행합니다.

#### 매개변수

- `to`: 토큰을 받을 주소
- `ids`: 토큰 ID 배열
- `amounts`: 각 토큰 ID에 대해 발행할 수량 배열

#### 조건

- 함수 호출자가 `manager`여야 합니다.

### burn

```solidity
function burn(address from, uint256 id, uint256 amount) external onlyManager
```

특정 주소에서 특정 토큰 ID의 토큰을 소각합니다.

#### 매개변수

- `from`: 토큰을 소각할 주소
- `id`: 토큰 ID
- `amount`: 소각할 토큰 수량

#### 조건

- 함수 호출자가 `manager`여야 합니다.

#### 이벤트

- `TokenBurned`: 토큰 소각 시 발생합니다.

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
marketId = tokenId >> 128;
binIndex = int256(tokenId & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) - int256(OFFSET);
```

## 관리 함수

### setManager

```solidity
function setManager(address newManager) external onlyManager
```

매니저 주소를 새 주소로 업데이트합니다. 현재 매니저만 이 함수를 호출할 수 있습니다.

#### 매개변수

- `newManager`: 새로운 매니저 주소

#### 조건

- 함수 호출자가 현재 `manager`여야 합니다.
- 새 매니저 주소는 0 주소가 아니어야 합니다.

## 사용 예시

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
    uint256[] memory tokenIds = new uint256[](binIndices.length);
    uint256[] memory mintedAmounts = new uint256[](binIndices.length);

    for (uint256 i = 0; i < binIndices.length; i++) {
        tokenIds[i] = rangeBetToken.encodeTokenId(marketId, binIndices[i]);
        mintedAmounts[i] = amounts[i];
    }

    // 배치 발행 실행
    rangeBetToken.mintBatch(msg.sender, tokenIds, mintedAmounts);

    // ...
}
```

### 토큰 소각 (RangeBetManager에서만 호출 가능)

```solidity
// RangeBetManager 내부 구현 예시
function claimReward(uint256 marketId, int256 binIndex) external {
    // ... 보상 계산 등

    // 토큰 ID 계산
    uint256 tokenId = rangeBetToken.encodeTokenId(marketId, binIndex);

    // 사용자의 토큰 밸런스 조회
    uint256 userBalance = rangeBetToken.balanceOf(msg.sender, tokenId);

    // 토큰 소각
    rangeBetToken.burn(msg.sender, tokenId, userBalance);

    // ... 보상 전송
}
```
