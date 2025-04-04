// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SampleToken
 * @dev 간단한 ERC20 토큰 컨트랙트
 */
contract SampleToken is ERC20, Ownable {
    /**
     * @dev 컨트랙트 배포 시 초기 공급량을 소유자에게 발행합니다.
     * @param initialSupply 초기 토큰 공급량 (wei 단위)
     */
    constructor(uint256 initialSupply) ERC20("Sample Token", "STKN") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev 추가 토큰을 발행합니다. 소유자만 호출할 수 있습니다.
     * @param to 토큰을 받을 주소
     * @param amount 발행할 토큰 수량 (wei 단위)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
} 