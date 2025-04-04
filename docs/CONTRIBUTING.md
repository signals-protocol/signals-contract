# RangeBet 기여 가이드

RangeBet 프로젝트에 기여하는 데 관심을 가져주셔서 감사합니다! 이 문서는 프로젝트에 기여하는 방법을 설명합니다.

## 목차

1. [시작하기](#시작하기)
2. [개발 환경 설정](#개발-환경-설정)
3. [코딩 스타일](#코딩-스타일)
4. [테스트](#테스트)
5. [풀 리퀘스트 제출](#풀-리퀘스트-제출)
6. [이슈 보고](#이슈-보고)
7. [문서화](#문서화)

## 시작하기

### 사전 요구사항

RangeBet 개발에 참여하기 위해서는 다음 도구가 필요합니다:

- [Node.js](https://nodejs.org/) (v16 이상)
- [Yarn](https://yarnpkg.com/) (v1.22 이상)
- [Git](https://git-scm.com/)
- [Hardhat](https://hardhat.org/)

### 저장소 복제

```bash
git clone https://github.com/yourusername/rangebet.git
cd rangebet
yarn install
```

## 개발 환경 설정

### 환경 변수

`.env` 파일을 프로젝트 루트에 생성하고 다음 변수를 설정합니다:

```
PRIVATE_KEY=your_private_key
INFURA_PROJECT_ID=your_infura_project_id
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 빌드 및 테스트

```bash
# 컨트랙트 컴파일
yarn compile

# 테스트 실행
yarn test

# 코드 커버리지 확인
yarn coverage
```

## 코딩 스타일

RangeBet 프로젝트는 일관된 코드 스타일을 유지하기 위해 다음 가이드라인을 따릅니다:

### Solidity

- [Solidity Style Guide](https://docs.soliditylang.org/en/v0.8.17/style-guide.html)를 따릅니다.
- 들여쓰기: 4 공백
- 최대 줄 길이: 100자
- 함수와 변수 이름: camelCase
- 상수: UPPER_CASE
- 컨트랙트와 구조체 이름: PascalCase
- 모든 함수와 상태 변수에 NatSpec 주석을 추가합니다.

예시:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title 예시 컨트랙트
/// @notice 이 컨트랙트는 예시 목적으로 사용됩니다
/// @dev 개발자 노트
contract ExampleContract {
    /// @notice 상수 설명
    uint256 public constant MAX_VALUE = 1000;

    /// @notice 상태 변수 설명
    uint256 public totalAmount;

    /// @notice 함수 설명
    /// @param _value 값 설명
    /// @return 반환값 설명
    function exampleFunction(uint256 _value) external returns (bool) {
        require(_value <= MAX_VALUE, "Value too high");
        totalAmount += _value;
        return true;
    }
}
```

### TypeScript/JavaScript

- 들여쓰기: 2 공백
- 세미콜론: 사용
- 따옴표: 작은 따옴표 (`'`)
- 변수 선언: `const` 또는 `let` 사용 (`var` 사용하지 않음)
- 함수와 변수 이름: camelCase
- 클래스와 인터페이스 이름: PascalCase
- 모든 함수와 클래스에 JSDoc 주석을 추가합니다.

예시:

```typescript
/**
 * 사용자 인터페이스
 */
interface User {
  id: string;
  name: string;
}

/**
 * 사용자 정보를 가져옵니다
 * @param userId 사용자 ID
 * @returns 사용자 객체
 */
async function getUser(userId: string): Promise<User> {
  // 구현
  return {
    id: userId,
    name: "Test User",
  };
}
```

## 테스트

### 테스트 작성

모든 새 기능과 버그 수정에는 테스트 케이스가 포함되어야 합니다. RangeBet은 [Hardhat](https://hardhat.org/)과 [Chai](https://www.chaijs.com/)를 사용합니다.

테스트는 `test/` 디렉토리에 작성하고 다음 명명 규칙을 따릅니다:

- `UnitTest.test.ts`: 단위 테스트
- `Integration.test.ts`: 통합 테스트

### 테스트 커버리지

기능 변경 후 테스트 커버리지를 확인합니다:

```bash
yarn coverage
```

목표 커버리지:

- 라인 커버리지: 최소 85%
- 함수 커버리지: 최소 90%
- 브랜치 커버리지: 최소 80%

## 풀 리퀘스트 제출

### 브랜치 전략

- `main`: 안정적인 프로덕션 코드
- `develop`: 개발 브랜치
- 기능 브랜치: `feature/feature-name`
- 버그 수정 브랜치: `fix/bug-name`

### 풀 리퀘스트 프로세스

1. 최신 `develop` 브랜치에서 새 브랜치를 만듭니다.
2. 코드 변경을 구현하고 테스트를 작성합니다.
3. 모든 테스트가 통과하는지 확인합니다.
4. 변경 사항을 커밋하고, 의미 있는 커밋 메시지를 작성합니다.
5. `develop` 브랜치로 풀 리퀘스트를 생성합니다.
6. 풀 리퀘스트 템플릿을 작성합니다.

### 커밋 메시지 규칙

커밋 메시지는 다음 형식을 따릅니다:

```
<유형>: <제목>

<본문>

<푸터>
```

유형:

- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 포맷팅
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드 프로세스/도구 변경

예시:

```
feat: 마켓 종료 후 보상 분배 메커니즘 추가

RangeBetManager에 승리한 빈의 토큰 보유자에게 보상을 분배하는
새로운 함수를 추가합니다. 보상은 토큰 보유 비율에 따라 분배됩니다.

Closes #123
```

## 이슈 보고

### 버그 보고

버그를 발견하면 GitHub 이슈에 보고해 주세요. 다음 정보를 포함해 주세요:

1. 버그 설명
2. 재현 단계
3. 예상 동작
4. 실제 동작
5. 환경 정보 (Node.js 버전, Hardhat 버전 등)
6. 가능한 경우 오류 로그

### 기능 요청

새 기능을 제안하려면 GitHub 이슈에 작성해 주세요. 다음 정보를 포함해 주세요:

1. 기능 설명
2. 사용 사례와 목적
3. 가능한 구현 방법에 대한 아이디어

## 문서화

### 코드 주석

모든 퍼블릭 함수와 컨트랙트에는 NatSpec/JSDoc 주석을 추가해야 합니다:

- `@title`: 컨트랙트/파일 제목
- `@notice`: 함수/컨트랙트가 무엇을 하는지 설명
- `@dev`: 개발자를 위한 추가 정보
- `@param`: 매개변수 설명
- `@return`: 반환값 설명

### API 문서

API 변경 시 `/docs/api/` 디렉토리의 해당 마크다운 파일을 업데이트해야 합니다.

### 아키텍처 문서

아키텍처 변경 시 `/docs/ARCHITECTURE.md` 파일을 업데이트해야 합니다.

## 보안 취약점

보안 취약점을 발견한 경우 GitHub 이슈에 공개적으로 보고하지 마세요. 대신 다음 이메일로 직접 연락해 주세요: security@example.com

## 라이선스

RangeBet 프로젝트는 MIT 라이선스로 제공됩니다. 코드 기여 시 이 라이선스 조건에 동의하는 것으로 간주합니다.

## 질문 및 지원

질문이 있거나 도움이 필요한 경우 GitHub 이슈에 질문을 작성하거나 Discord 채널에 참여해 주세요.

RangeBet 프로젝트에 기여해 주셔서 감사합니다!
