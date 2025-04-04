import { ethers, network } from "hardhat";

async function main() {
  console.log("배포를 시작합니다...");

  // 초기 발행량을 100만 토큰으로 설정
  const initialSupply = ethers.parseEther("1000000");

  // 배포 계정 가져오기
  const [deployer] = await ethers.getSigners();
  console.log("배포 계정:", deployer.address);

  // 배포 전 잔액 확인
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("배포 계정 잔액:", ethers.formatEther(balance), "ETH");

  // 컨트랙트 배포
  console.log("SampleToken 컨트랙트 배포 중...");
  const SampleToken = await ethers.getContractFactory("SampleToken");
  const token = await SampleToken.deploy(initialSupply);

  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("SampleToken 배포 완료:", tokenAddress);

  console.log("초기 발행량:", ethers.formatEther(initialSupply), "STKN");

  // 배포된 컨트랙트 정보 출력
  console.log("--------------------");
  console.log("배포 정보:");
  console.log("네트워크:", network.name);
  console.log("컨트랙트 주소:", tokenAddress);
  console.log("배포자:", deployer.address);
  console.log("--------------------");
}

// 스크립트 실행과 에러 핸들링
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
