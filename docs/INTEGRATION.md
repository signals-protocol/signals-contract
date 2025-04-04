# RangeBet 통합 가이드

이 문서는 RangeBet 예측 시장 시스템과 통합하려는 개발자를 위한 가이드입니다.

## 목차

1. [개요](#개요)
2. [컨트랙트 주소](#컨트랙트-주소)
3. [JavaScript/TypeScript 통합](#javascripttypescript-통합)
4. [스마트 컨트랙트 통합](#스마트-컨트랙트-통합)
5. [이벤트 모니터링](#이벤트-모니터링)
6. [오류 처리](#오류-처리)
7. [테스트 환경](#테스트-환경)

## 개요

RangeBet 시스템은 다음 핵심 컨트랙트로 구성됩니다:

- **RangeBetManager**: 마켓 생성 및 관리 컨트랙트
- **RangeBetToken**: ERC1155 토큰 컨트랙트
- **RangeBetMath**: 베팅 비용 계산 라이브러리
- **담보 토큰**: 시스템에서 사용하는 ERC20 토큰

이 가이드는 프론트엔드나 다른 스마트 컨트랙트에서 RangeBet 시스템과 통합하는 방법을 보여줍니다.

## 컨트랙트 주소

### 테스트넷 (Sepolia)

```
RangeBetManager: 0x...
RangeBetToken: 0x...
담보 토큰 (Mock): 0x...
```

### 메인넷

```
아직 배포되지 않음
```

## JavaScript/TypeScript 통합

### 필요한 종속성

```bash
npm install ethers@5.7.2
# 또는
yarn add ethers@5.7.2
```

### 컨트랙트 인터페이스 설정

```typescript
import { ethers } from "ethers";

// ABI 파일 임포트
import RangeBetManagerABI from "./abis/RangeBetManager.json";
import RangeBetTokenABI from "./abis/RangeBetToken.json";
import ERC20ABI from "./abis/ERC20.json";

// 컨트랙트 주소
const MANAGER_ADDRESS = "0x...";
const TOKEN_ADDRESS = "0x...";
const COLLATERAL_ADDRESS = "0x...";

// 프로바이더 설정
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// 컨트랙트 인스턴스 생성
const managerContract = new ethers.Contract(
  MANAGER_ADDRESS,
  RangeBetManagerABI,
  signer
);

const tokenContract = new ethers.Contract(
  TOKEN_ADDRESS,
  RangeBetTokenABI,
  signer
);

const collateralContract = new ethers.Contract(
  COLLATERAL_ADDRESS,
  ERC20ABI,
  signer
);
```

### 마켓 조회

```typescript
async function getMarketInfo(marketId: number) {
  const market = await managerContract.markets(marketId);

  return {
    active: market.active,
    closed: market.closed,
    tickSpacing: market.tickSpacing.toNumber(),
    minTick: market.minTick.toNumber(),
    maxTick: market.maxTick.toNumber(),
    totalSupply: market.T.toString(),
    collateralBalance: market.collateralBalance.toString(),
    winningBin: market.winningBin.toNumber(),
  };
}

// 특정 빈의 토큰 수량 조회
async function getBinQuantity(marketId: number, binIndex: number) {
  return await managerContract.getBinQuantity(marketId, binIndex);
}

// 사용자의 토큰 밸런스 조회
async function getUserTokenBalance(
  marketId: number,
  binIndex: number,
  userAddress: string
) {
  const tokenId = await tokenContract.encodeTokenId(marketId, binIndex);
  return await tokenContract.balanceOf(userAddress, tokenId);
}
```

### 베팅 (토큰 구매)

```typescript
async function placeBet(
  marketId: number,
  binIndices: number[],
  amounts: string[],
  maxCollateral: string
) {
  // 담보 토큰 승인 (첫 번째 거래)
  const approveTx = await collateralContract.approve(
    MANAGER_ADDRESS,
    maxCollateral
  );
  await approveTx.wait();

  // 토큰 구매 (두 번째 거래)
  const buyTx = await managerContract.buyTokens(
    marketId,
    binIndices,
    amounts.map((a) => ethers.utils.parseUnits(a, 18)),
    ethers.utils.parseUnits(maxCollateral, 18)
  );

  return await buyTx.wait();
}
```

### 보상 청구

```typescript
async function claimReward(marketId: number, binIndex: number) {
  const tx = await managerContract.claimReward(marketId, binIndex);
  return await tx.wait();
}
```

## 스마트 컨트랙트 통합

다른 스마트 컨트랙트에서 RangeBet과 통합하려면:

### 인터페이스 정의

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRangeBetManager {
    function createMarket(
        uint256 tickSpacing,
        int256 minTick,
        int256 maxTick
    ) external returns (uint256);

    function buyTokens(
        uint256 marketId,
        int256[] calldata binIndices,
        uint256[] calldata amounts,
        uint256 maxCollateral
    ) external;

    function closeMarket(uint256 marketId, int256 winningBin) external;

    function claimReward(uint256 marketId, int256 binIndex) external;

    function getBinQuantity(uint256 marketId, int256 binIndex) external view returns (uint256);

    function markets(uint256 marketId) external view returns (
        bool active,
        bool closed,
        uint256 tickSpacing,
        int256 minTick,
        int256 maxTick,
        uint256 T,
        uint256 collateralBalance,
        int256 winningBin
    );
}

interface IRangeBetToken {
    function encodeTokenId(uint256 marketId, int256 binIndex) external pure returns (uint256);
    function decodeTokenId(uint256 tokenId) external pure returns (uint256 marketId, int256 binIndex);
    function balanceOf(address account, uint256 id) external view returns (uint256);
}
```

### 컨트랙트 통합 예제

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IRangeBetManager.sol";
import "./interfaces/IRangeBetToken.sol";

contract RangeBetIntegration {
    IRangeBetManager public rangeBetManager;
    IRangeBetToken public rangeBetToken;
    IERC20 public collateralToken;

    constructor(
        address _rangeBetManager,
        address _rangeBetToken,
        address _collateralToken
    ) {
        rangeBetManager = IRangeBetManager(_rangeBetManager);
        rangeBetToken = IRangeBetToken(_rangeBetToken);
        collateralToken = IERC20(_collateralToken);
    }

    // 사용자를 대신하여 베팅 실행
    function placeBetOnBehalf(
        address user,
        uint256 marketId,
        int256[] calldata binIndices,
        uint256[] calldata amounts,
        uint256 maxCollateral
    ) external {
        // 사용자로부터 컨트랙트로 담보 토큰 전송
        collateralToken.transferFrom(user, address(this), maxCollateral);

        // 컨트랙트에서 RangeBetManager로 담보 토큰 승인
        collateralToken.approve(address(rangeBetManager), maxCollateral);

        // 베팅 실행
        rangeBetManager.buyTokens(marketId, binIndices, amounts, maxCollateral);

        // 토큰을 사용자에게 전송 (필요시)
        // 참고: 이 컨트랙트는 ERC1155 수신자 인터페이스를 구현해야 할 수 있음
    }
}
```

## 이벤트 모니터링

RangeBet 시스템은 다음 주요 이벤트를 발생시킵니다:

### RangeBetManager 이벤트

```solidity
// 마켓 생성 이벤트
event MarketCreated(uint256 indexed marketId, uint256 tickSpacing, int256 minTick, int256 maxTick);

// 토큰 구매 이벤트
event TokensPurchased(
    uint256 indexed marketId,
    address indexed buyer,
    int256[] binIndices,
    uint256[] amounts,
    uint256 collateralAmount
);

// 마켓 종료 이벤트
event MarketClosed(uint256 indexed marketId, int256 winningBin);

// 보상 청구 이벤트
event RewardClaimed(
    uint256 indexed marketId,
    address indexed claimer,
    int256 binIndex,
    uint256 tokenAmount,
    uint256 rewardAmount
);
```

### 웹 애플리케이션에서 이벤트 리스닝

```typescript
// 마켓 생성 이벤트 리스닝
managerContract.on(
  "MarketCreated",
  (marketId, tickSpacing, minTick, maxTick, event) => {
    console.log(`마켓 생성: ID ${marketId}`);
    // UI 업데이트 로직
  }
);

// 토큰 구매 이벤트 리스닝
managerContract.on(
  "TokensPurchased",
  (marketId, buyer, binIndices, amounts, collateralAmount, event) => {
    console.log(`토큰 구매: 마켓 ${marketId}, 구매자 ${buyer}`);
    // UI 업데이트 로직
  }
);

// 마켓 종료 이벤트 리스닝
managerContract.on("MarketClosed", (marketId, winningBin, event) => {
  console.log(`마켓 종료: ID ${marketId}, 승리 빈 ${winningBin}`);
  // UI 업데이트 로직
});

// 보상 청구 이벤트 리스닝
managerContract.on(
  "RewardClaimed",
  (marketId, claimer, binIndex, tokenAmount, rewardAmount, event) => {
    console.log(
      `보상 청구: 마켓 ${marketId}, 청구자 ${claimer}, 보상 ${ethers.utils.formatUnits(
        rewardAmount,
        18
      )}`
    );
    // UI 업데이트 로직
  }
);
```

## 오류 처리

RangeBet 시스템 컨트랙트는 다음과 같은 주요 오류를 발생시킬 수 있습니다:

```typescript
try {
  // 컨트랙트 호출
} catch (error) {
  const errorMessage = error.message;

  if (errorMessage.includes("Market not active")) {
    // 마켓이 활성화되지 않음
  } else if (errorMessage.includes("Market already closed")) {
    // 마켓이 이미 종료됨
  } else if (errorMessage.includes("Invalid bin index")) {
    // 잘못된 빈 인덱스
  } else if (errorMessage.includes("Insufficient allowance")) {
    // 토큰 승인 부족
  } else if (errorMessage.includes("Collateral too high")) {
    // 최대 담보 초과
  } else if (errorMessage.includes("Not winning bin")) {
    // 승리 빈이 아님
  } else if (errorMessage.includes("No tokens to claim")) {
    // 청구할 토큰이 없음 (이미 청구했거나 토큰을 보유하지 않음)
  } else {
    // 기타 오류
    console.error("거래 오류:", errorMessage);
  }
}
```

## 테스트 환경

### 로컬 개발을 위한 하드햇 설정

```typescript
// scripts/localDeploy.ts

import { ethers } from "hardhat";

async function main() {
  // 담보 토큰 배포
  const MockERC20 = await ethers.getContractFactory("MockCollateralToken");
  const collateralToken = await MockERC20.deploy("Mock Token", "MCK");
  await collateralToken.deployed();
  console.log(`담보 토큰 배포: ${collateralToken.address}`);

  // RangeBetMath 라이브러리 배포
  const RangeBetMath = await ethers.getContractFactory("RangeBetMath");
  const rangeBetMath = await RangeBetMath.deploy();
  await rangeBetMath.deployed();
  console.log(`RangeBetMath 배포: ${rangeBetMath.address}`);

  // RangeBetToken 배포
  const RangeBetToken = await ethers.getContractFactory("RangeBetToken");
  const rangeBetToken = await RangeBetToken.deploy();
  await rangeBetToken.deployed();
  console.log(`RangeBetToken 배포: ${rangeBetToken.address}`);

  // RangeBetManager 배포 (라이브러리 링크)
  const RangeBetManager = await ethers.getContractFactory("RangeBetManager", {
    libraries: {
      RangeBetMath: rangeBetMath.address,
    },
  });
  const rangeBetManager = await RangeBetManager.deploy(
    rangeBetToken.address,
    collateralToken.address
  );
  await rangeBetManager.deployed();
  console.log(`RangeBetManager 배포: ${rangeBetManager.address}`);

  // RangeBetToken이 Manager를 인식하도록 설정
  await rangeBetToken.setManager(rangeBetManager.address);
  console.log("Manager 주소 설정 완료");

  // 테스트 계정에 담보 토큰 민팅
  const [owner, user1, user2] = await ethers.getSigners();
  const amount = ethers.utils.parseUnits("1000", 18);

  await collateralToken.mint(user1.address, amount);
  await collateralToken.mint(user2.address, amount);
  console.log("테스트 토큰 민팅 완료");

  // 테스트 마켓 생성
  const marketTx = await rangeBetManager.createMarket(60, -360, 360);
  const marketReceipt = await marketTx.wait();

  // MarketCreated 이벤트에서 marketId 추출
  const marketCreatedEvent = marketReceipt.events?.find(
    (event) => event.event === "MarketCreated"
  );
  const marketId = marketCreatedEvent?.args?.marketId;

  console.log(`테스트 마켓 생성 완료, ID: ${marketId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### 로컬 테스트 환경 설정

```bash
# 로컬 하드햇 노드 실행
npx hardhat node

# 새 터미널에서 컨트랙트 배포
npx hardhat run scripts/localDeploy.ts --network localhost
```

### 테스트 상호작용 스크립트

```typescript
// scripts/interact.ts

import { ethers } from "hardhat";

async function main() {
  // 배포된 컨트랙트 주소
  const MANAGER_ADDRESS = "0x..."; // 배포 시 로그에서 가져온 주소
  const TOKEN_ADDRESS = "0x...";
  const COLLATERAL_ADDRESS = "0x...";

  // 컨트랙트 인스턴스 가져오기
  const rangeBetManager = await ethers.getContractAt(
    "RangeBetManager",
    MANAGER_ADDRESS
  );
  const rangeBetToken = await ethers.getContractAt(
    "RangeBetToken",
    TOKEN_ADDRESS
  );
  const collateralToken = await ethers.getContractAt(
    "MockCollateralToken",
    COLLATERAL_ADDRESS
  );

  // 계정 가져오기
  const [owner, user1, user2] = await ethers.getSigners();

  // 마켓 ID (배포 스크립트에서 생성된 ID)
  const marketId = 0;

  // 마켓 정보 출력
  const market = await rangeBetManager.markets(marketId);
  console.log("마켓 상태:");
  console.log("- 활성:", market.active);
  console.log("- 종료:", market.closed);
  console.log("- 틱 간격:", market.tickSpacing.toString());
  console.log("- 최소 틱:", market.minTick.toString());
  console.log("- 최대 틱:", market.maxTick.toString());
  console.log("- 총 공급량:", market.T.toString());
  console.log("- 담보 잔액:", market.collateralBalance.toString());

  // 사용자 토큰 승인
  const betAmount = ethers.utils.parseUnits("100", 18);
  await collateralToken.connect(user1).approve(MANAGER_ADDRESS, betAmount);
  await collateralToken.connect(user2).approve(MANAGER_ADDRESS, betAmount);
  console.log("담보 토큰 승인 완료");

  // 베팅 실행
  await rangeBetManager.connect(user1).buyTokens(
    marketId,
    [0], // 빈 인덱스
    [betAmount], // 금액
    betAmount // 최대 담보
  );
  console.log("User1이 빈 0에 베팅 완료");

  await rangeBetManager.connect(user2).buyTokens(
    marketId,
    [60, -60], // 빈 인덱스
    [betAmount.div(2), betAmount.div(2)], // 각 빈에 절반씩 베팅
    betAmount // 최대 담보
  );
  console.log("User2가 빈 60과 -60에 베팅 완료");

  // 토큰 밸런스 확인
  const token0Id = await rangeBetToken.encodeTokenId(marketId, 0);
  const token60Id = await rangeBetToken.encodeTokenId(marketId, 60);
  const tokenNeg60Id = await rangeBetToken.encodeTokenId(marketId, -60);

  console.log("토큰 밸런스:");
  console.log(
    "- User1 (빈 0):",
    (await rangeBetToken.balanceOf(user1.address, token0Id)).toString()
  );
  console.log(
    "- User2 (빈 60):",
    (await rangeBetToken.balanceOf(user2.address, token60Id)).toString()
  );
  console.log(
    "- User2 (빈 -60):",
    (await rangeBetToken.balanceOf(user2.address, tokenNeg60Id)).toString()
  );

  // 마켓 종료 (0을 승리 빈으로 선언)
  await rangeBetManager.connect(owner).closeMarket(marketId, 0);
  console.log("마켓 종료, 빈 0 승리");

  // 보상 청구
  await rangeBetManager.connect(user1).claimReward(marketId, 0);
  console.log("User1이 보상 청구 완료");

  // 최종 담보 토큰 밸런스 확인
  console.log("최종 담보 토큰 밸런스:");
  console.log(
    "- User1:",
    (await collateralToken.balanceOf(user1.address)).toString()
  );
  console.log(
    "- User2:",
    (await collateralToken.balanceOf(user2.address)).toString()
  );
  console.log(
    "- RangeBetManager:",
    (await collateralToken.balanceOf(MANAGER_ADDRESS)).toString()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```
