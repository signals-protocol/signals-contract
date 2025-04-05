# Rootstock Testnet 배포 안내서

이 문서는 Rootstock 테스트넷에 스마트 컨트랙트를 배포하는 방법을 설명합니다.

## 사전 준비

1. **지갑 설정**

   - Metamask와 같은 지갑에서 개인키를 확보하세요.
   - Rootstock 테스트넷을 지갑에 추가하세요:
     - 네트워크 이름: Rootstock Testnet
     - RPC URL: https://public-node.testnet.rsk.co
     - 체인 ID: 31
     - 통화 기호: tRBTC

2. **테스트넷 RBTC 획득**
   - [Rootstock Faucet](https://faucet.rootstock.io/)에서 테스트넷 RBTC를 받으세요.

## 환경 설정

1. `.env` 파일 설정:
   ```
   ROOTSTOCK_TESTNET_URL="https://public-node.testnet.rsk.co"
   ROOTSTOCK_TESTNET_PRIVATE_KEY="YOUR_PRIVATE_KEY_HERE"
   ```
   - `YOUR_PRIVATE_KEY_HERE`를 실제 개인키로 변경하세요.

## 배포 방법

1. 의존성 패키지 설치:

   ```bash
   yarn install
   ```

2. Rootstock 테스트넷에 컨트랙트 배포:

   ```bash
   yarn deploy:rsk
   ```

3. 배포 후 출력된 컨트랙트 주소를 기록해 두세요.

4. [Rootstock Explorer](https://explorer.testnet.rootstock.io/)에서 배포된 컨트랙트 확인:
   - 배포된 컨트랙트 주소를 탐색기에서 검색하세요.

## 컨트랙트 상호작용 방법

배포된 컨트랙트와 상호작용하기 위해 아래 명령어를 사용합니다:

```bash
yarn interact:rsk <rangeBetManagerAddress> <rangeBetTokenAddress> <collateralTokenAddress>
```

예시:

```bash
yarn interact:rsk 0x1234567890abcdef1234567890abcdef12345678 0xabcdef1234567890abcdef1234567890abcdef12 0x7890abcdef1234567890abcdef1234567890abcd
```

이 스크립트는 다음 작업을 수행합니다:

1. 사용자에게 토큰 전송
2. 컨트랙트 승인
3. 베팅 수행
4. 마켓 닫기
5. 보상 청구

## 주의사항

- 테스트넷 RBTC는 실제 가치가 없습니다.
- 실제 개인키를 .env 파일에 저장할 때는 보안에 주의하세요.
- 이 파일을 Git에 커밋하지 마세요.

## 문제 해결

- 가스비 이슈: 트랜잭션이 실패하면 가스 가격을 조정해 보세요.
