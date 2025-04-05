# MockCollateralToken API 문서

`MockCollateralToken` 컨트랙트는 테스트 목적으로 사용되는 간단한 ERC20 토큰입니다. RangeBet 시스템에서 담보 토큰으로 사용됩니다.

## 상태 변수

```solidity
uint8 private _decimals;
```

- `_decimals`: 토큰의 소수점 자릿수 (기본값: 18)

## 이벤트

```solidity
event TokensRequested(address indexed to, uint256 amount);
```

## 생성자

```solidity
constructor(string memory name, string memory symbol, uint256 initialSupply)
    ERC20(name, symbol)
    Ownable(msg.sender)
```

### 매개변수

- `name`: 토큰 이름
- `symbol`: 토큰 심볼
- `initialSupply`: 초기 토큰 공급량 (모두 생성자 호출자에게 할당됨)

## 함수

### mint

```solidity
function mint(address to, uint256 amount) external onlyOwner
```

새로운 토큰을 발행합니다.

#### 매개변수

- `to`: 토큰을 받을 주소
- `amount`: 발행할 토큰 양

#### 조건

- 호출자가 컨트랙트 소유자여야 합니다.

### requestTokens

```solidity
function requestTokens(uint256 amount) external
```

테스트 목적으로 누구나 토큰을 요청할 수 있는 함수입니다.

#### 매개변수

- `amount`: 요청할 토큰 양

#### 이벤트

- `TokensRequested`: 토큰 요청 시 발생합니다.

### decimals

```solidity
function decimals() public view override returns (uint8)
```

토큰의 소수점 자릿수를 반환합니다.

#### 반환값

- 토큰의 소수점 자릿수 (18)

## 사용 예시

### 토큰 배포

```solidity
// 컨트랙트 배포
MockCollateralToken token = new MockCollateralToken("Test Token", "TST", 1000000 * 10**18);
```

### 토큰 발행 (민팅)

```solidity
// 컨트랙트 인스턴스 가져오기
MockCollateralToken token = MockCollateralToken(tokenAddress);

// 토큰 발행 (소유자만 가능)
token.mint(recipientAddress, 1000 * 10**18);
```

### 테스트용 토큰 요청

```solidity
// 컨트랙트 인스턴스 가져오기
MockCollateralToken token = MockCollateralToken(tokenAddress);

// 토큰 요청 (누구나 가능)
token.requestTokens(5000 * 10**18);
```
