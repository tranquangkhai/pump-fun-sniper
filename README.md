# PUMP FUN SNIPER

## Overview

Pump Fun Sniper is a tool designed to simulate token transactions on the Solana blockchain. It supports buying and selling tokens on localnet, devnet. The project is currently being extended to work with Jito Low Latency and PumpFun.

## Features

- [x] **Buy/Sell on localnet/devnet**: DONE
- [ ] **Work with Jito Low Latency**: IN PROGRESS
- [ ] **Work with PumpFun**: IN PROGRESS
- [ ] **Retry logic**: NOT YET

## Getting Started

### Prerequisites

- Node.js
- npm
- Solana CLI

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/tranquangkhai/pump-fun-sniper.git
    cd pump-fun-sniper
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Create a  file based on the :
    ```sh
    cp env_example .env
    ```

4. Update the  file with your configuration.

### Usage

1. Run the sniper script:
    ```sh
    ts-node sniper.js
    ```

### Configuration

The configuration is managed through the  file. Here are the key variables:

- `RPC_URL`: URL of the Solana RPC server.

The following Private Key will be automatically generated.
- `PARENT_WALLET`: Private key of the parent wallet.
- `CHILD_WALLET_0`, `CHILD_WALLET_1`, etc: Private keys of the child wallets.
- `SELLER_WALLET`: Private key of the seller wallet.
- `BUYER_WALLET`: Private key of the buyer wallet.

### Simulation

To simulate a token purchase and sell, run the  script. The script will:

1. Create a mint token with the seller wallet.
2. Simulate a token purchase where the parent wallet buys tokens from the seller wallet.
3. Simulate a token sell where the parent wallet sells tokens to the buyer wallet.

### License

This project is licensed under the MIT License.