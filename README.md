# 솔리디티 스마트 컨트랙트 개발 환경

이 프로젝트는 Hardhat을 사용한 솔리디티 스마트 컨트랙트 개발 환경 세팅의 예시입니다. ERC20 토큰 컨트랙트, 테스트 코드, 배포 스크립트가 포함되어 있습니다.

## 기능

- 솔리디티 스마트 컨트랙트 개발
- Hardhat을 이용한 테스트 및 배포
- ERC20 토큰 컨트랙트 예제
- TypeScript 기반 테스트 및 배포 스크립트

## 시작하기

### 필수 조건

- Node.js (v18 이상)
- Yarn 패키지 매니저

### 설치

```shell
# 의존성 패키지 설치
yarn install
```

### 환경 변수 설정

`.env` 파일을 루트 디렉토리에 생성하고 다음 변수들을 설정하세요:

```
PRIVATE_KEY=your_wallet_private_key
SEPOLIA_URL=your_sepolia_rpc_url
ETHERSCAN_API_KEY=your_etherscan_api_key
REPORT_GAS=true
```

## 사용법

### 컴파일

스마트 컨트랙트를 컴파일하려면 다음 명령어를 실행하세요:

```shell
npx hardhat compile
```

### 테스트

테스트를 실행하려면 다음 명령어를 실행하세요:

```shell
npx hardhat test
```

가스 사용량 보고서를 포함한 테스트:

```shell
REPORT_GAS=true npx hardhat test
```

### 로컬 노드 실행

로컬 개발 노드를 실행하려면 다음 명령어를 실행하세요:

```shell
npx hardhat node
```

### 배포

로컬 네트워크에 배포:

```shell
npx hardhat run scripts/deploy.ts --network localhost
```

테스트넷(Sepolia)에 배포:

```shell
npx hardhat run scripts/deploy.ts --network sepolia
```

## 프로젝트 구조

```
├── contracts/             # 솔리디티 스마트 컨트랙트
│   └── Token.sol          # ERC20 토큰 컨트랙트 예제
├── scripts/               # 배포 및 기타 스크립트
│   └── deploy.ts          # 배포 스크립트
├── test/                  # 테스트 파일
│   └── Token.test.ts      # 토큰 컨트랙트 테스트
├── .env                   # 환경 변수 (gitignore에 포함됨)
├── hardhat.config.ts      # Hardhat 설정 파일
└── tsconfig.json          # TypeScript 설정
```

## 라이센스

이 프로젝트는 MIT 라이센스를 따릅니다.
