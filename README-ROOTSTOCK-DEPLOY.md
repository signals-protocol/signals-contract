# Rootstock Testnet Deployment Guide

This document explains how to deploy smart contracts to the Rootstock Testnet.

## Prerequisites

1. **Wallet Setup**

   - Secure a private key from a wallet such as Metamask.
   - Add Rootstock Testnet to your wallet:
     - Network Name: Rootstock Testnet
     - RPC URL: https://public-node.testnet.rsk.co
     - Chain ID: 31
     - Currency Symbol: tRBTC

2. **Obtain Testnet RBTC**
   - Get testnet RBTC from the [Rootstock Faucet](https://faucet.rootstock.io/).

## Environment Setup

1. Set up the `.env` file:
   ```
   ROOTSTOCK_TESTNET_URL="https://public-node.testnet.rsk.co"
   ROOTSTOCK_TESTNET_PRIVATE_KEY="YOUR_PRIVATE_KEY_HERE"
   ```
   - Replace `YOUR_PRIVATE_KEY_HERE` with your actual private key.

## Deployment Process

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Deploy contracts to Rootstock Testnet:

   ```bash
   yarn deploy:rsk
   ```

3. Note the contract addresses output after deployment.

4. Verify deployed contracts on [Rootstock Explorer](https://explorer.testnet.rootstock.io/):
   - Search for your deployed contract addresses in the explorer.

## How to Interact with Contracts

Use the following command to interact with deployed contracts:

```bash
yarn interact:rsk <rangeBetManagerAddress> <rangeBetTokenAddress> <collateralTokenAddress>
```

Example:

```bash
yarn interact:rsk 0x1234567890abcdef1234567890abcdef12345678 0xabcdef1234567890abcdef1234567890abcdef12 0x7890abcdef1234567890abcdef1234567890abcd
```

This script performs the following actions:

1. Transfer tokens to users
2. Approve the contract
3. Place bets
4. Close markets
5. Claim rewards

## Precautions

- Testnet RBTC has no real value.
- Be cautious with security when storing real private keys in .env files.
- Do not commit this file to Git.

## Troubleshooting

- Gas issues: If transactions fail, try adjusting the gas price.
