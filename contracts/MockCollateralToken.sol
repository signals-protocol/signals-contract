// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockCollateralToken
 * @dev A simple ERC20 token to be used as collateral in tests
 */
contract MockCollateralToken is ERC20, Ownable {
    uint8 private _decimals;

    // Events
    event TokensRequested(address indexed to, uint256 amount);

    /**
     * @dev Constructor that gives the msg.sender all of existing tokens.
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial supply of tokens
     */
    constructor(string memory name, string memory symbol, uint256 initialSupply) 
        ERC20(name, symbol) 
        Ownable(msg.sender)
    {
        _decimals = 18;
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev Function to mint tokens.
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Allows anyone to request tokens for testing purposes.
     * @param amount The amount of tokens to request
     */
    function requestTokens(uint256 amount) external {
        _mint(msg.sender, amount);
        emit TokensRequested(msg.sender, amount);
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
} 