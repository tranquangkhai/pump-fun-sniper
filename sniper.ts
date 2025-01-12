import { initializeKeypair, getExplorerLink } from "@solana-developers/helpers";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { searcherClient } from "jito-ts/src/sdk/block-engine/searcher";

import { createMint, getOrCreateAssociatedTokenAccount, mintTo, createTransferInstruction, Account } from "@solana/spl-token";

dotenv.config();

async function createTokenWithSellerAndMint(
  connection: Connection,
  sellerWallet: Keypair,
  amount: number
): Promise<PublicKey> {

  const decimals = 9;
  const MINOR_UNITS_PER_MAJOR_UNITS = 10 ** decimals;

  // Create the token mint with sellerWallet as the authority
  const mint = await createMint(
    connection,
    sellerWallet, // Fee payer
    sellerWallet.publicKey, // Mint authority
    null, // Freeze authority (optional)
    decimals // Decimals
  );

  const mintLink = getExplorerLink("address", mint.toString(), "localnet");
  console.log(`✅ Success! Created Mint Token: ${mintLink}`);

  // Create the seller's token account
  const sellerTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sellerWallet,
    mint,
    sellerWallet.publicKey
  );

  // Mint tokens to the seller's token account
  const signature = await mintTo(
    connection,
    sellerWallet, // Fee payer and mint authority
    mint,
    sellerTokenAccount.address,
    sellerWallet, // Mint authority
    amount * MINOR_UNITS_PER_MAJOR_UNITS // Amount in the smallest unit
  );

  const transactionLink = getExplorerLink("transaction", signature, "localnet");
  console.log(`✅ Success! Mint Token Transaction: ${transactionLink}`);

  return mint;
}

async function simulateTokenPurchase(
  connection: Connection,
  mint: PublicKey,
  buyerWallet: Keypair,
  childWallets: Keypair[],
  sellerWallet: Keypair,
  solIn: number,
  pricePerToken: number
) {
  // Step 1: Calculate the number of tokens the buyer can buy
  const totalTokens = Math.floor(solIn / pricePerToken);

  if (totalTokens === 0) {
    throw new Error("Provided SOL is not enough to purchase any tokens.");
  }

  // Step 2: Create associated token accounts for buyer and seller
  const sellerTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sellerWallet,
    mint,
    sellerWallet.publicKey
  );

  const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    buyerWallet,
    mint,
    buyerWallet.publicKey
  );

  // Step 3: Create a transaction
  const transaction = new Transaction();

  // Add SOL transfer instruction (buyer -> seller)
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: buyerWallet.publicKey,
      toPubkey: sellerWallet.publicKey,
      lamports: solIn * LAMPORTS_PER_SOL,
    })
  );

  // Add Token transfer instruction (seller -> buyer)
  transaction.add(
    createTransferInstruction(
      sellerTokenAccount.address,
      buyerTokenAccount.address,
      sellerWallet.publicKey,
      totalTokens
    )
  );

  // Step 4: Distribute tokens among child wallets
  let remainingAmount = totalTokens;
  for (const childWallet of childWallets) {
    const childTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      buyerWallet,
      mint,
      childWallet.publicKey
    );

    const transferAmount = Math.min(remainingAmount, Math.ceil(totalTokens / childWallets.length));
    transaction.add(
      createTransferInstruction(
        buyerTokenAccount.address,
        childTokenAccount.address,
        buyerWallet.publicKey,
        transferAmount
      )
    );
    remainingAmount -= transferAmount;

    if (remainingAmount <= 0) break;
  }

  // Step 5: Sign and send the transaction
  const signature = await sendAndConfirmTransaction(connection, transaction, [buyerWallet, sellerWallet]);

  const transactionLink = getExplorerLink("transaction", signature, "localnet");
  console.log(`✅ Success! Buy Transaction: ${transactionLink}`);
}

async function simulateTokenSell(
  connection: Connection,
  mint: PublicKey,
  sellerWallet: Keypair,
  childWallets: Keypair[],
  buyerWallet: Keypair,
  amount: number,
  pricePerToken: number
) {

  // Step 1: Create associated token accounts for buyer
  const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    buyerWallet,
    mint,
    buyerWallet.publicKey
  );


  // Step 2: Create a transaction
  const transaction = new Transaction();

  let remainingAmount = amount;
  for (const childWallet of childWallets) {
    const childTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      sellerWallet,
      mint,
      childWallet.publicKey
    );

    const maxTransferable = Math.min(Number(childTokenAccount.amount), remainingAmount);
    if (maxTransferable <= 0) continue;
    const childEarned = Math.floor(maxTransferable * pricePerToken);
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: buyerWallet.publicKey,
        toPubkey: childWallet.publicKey,
        lamports: childEarned * LAMPORTS_PER_SOL,
      })
    );

    transaction.add(
      createTransferInstruction(
        childTokenAccount.address,
        buyerTokenAccount.address,
        childWallet.publicKey,
        maxTransferable
      )
    );

    remainingAmount -= maxTransferable;

    if (remainingAmount <= 0) break;
  }

  transaction.feePayer = sellerWallet.publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  // Step 6: Sign and send the transaction
  const signature = await sendAndConfirmTransaction(connection, transaction, [buyerWallet, sellerWallet, ...childWallets]);

  const transactionLink = getExplorerLink("transaction", signature, "localnet");
  console.log(`✅ Success! Sell Transaction: ${transactionLink}`);
}

// Create a main function.

async function main() {
  // Connect to a solana cluster.
  const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com', "confirmed");

  // Create parent wallet and add it to the environment file
  const parentWallet = await initializeKeypair(connection, {
    envVariableName: "PARENT_WALLET",
    airdropAmount: LAMPORTS_PER_SOL * 2.0,
    minimumBalance: LAMPORTS_PER_SOL * 0.01,
  }
  );

  console.log("Parent wallet address: ", parentWallet.publicKey.toBase58());

  // Create 2 child wallets and add them to the environment file
  const childWallets = [];
  for (let i = 0; i < 2; i++) {
    const childWallet = await initializeKeypair(connection, {
      envVariableName: `CHILD_WALLET_${i}`,
      minimumBalance: LAMPORTS_PER_SOL * 0.0,
    }
    ) 
    console.log(`Child wallet ${i} address: `, childWallet.publicKey.toBase58());
    childWallets.push(childWallet);
  }

  // Simulation
  // We will use seller wallet/buyer wallet to simulate PUMPFUN.
  // We will create a mint token as a coin in PUMPFUN and simulate the token purchase and sell.
  // The simulation consists of three steps:
  // 1. Create a mint token with a seller wallet
  // 2. Simulate a token purchase where parent wallet buys tokens from seller wallet. 
  //    Try to make it like PUMPFUN as possible to extend it later easily.
  // 3. Simulate a token sell where parent wallet sells tokens to buyer wallet
  //    Try to make it like PUMPFUN as possible to extend it later easily.

  // Create a seller wallet
  const sellerWallet = await initializeKeypair(connection, {
    envVariableName: "SELLER_WALLET",
    airdropAmount: LAMPORTS_PER_SOL * 2.0,
    minimumBalance: LAMPORTS_PER_SOL * 0.01,
  }
  )

  console.log("Seller wallet address: ", sellerWallet.publicKey.toBase58());

  // Create a mint token
  const mint = await createTokenWithSellerAndMint(connection, sellerWallet, 10);

  // Token purchase simulation: parent wallet buys tokens from seller wallet
  await simulateTokenPurchase(
    connection,
    mint,
    parentWallet,
    childWallets,
    sellerWallet,
    0.005,
    0.0001
  );

  // Create a buyer wallet
  const buyerWallet = await initializeKeypair(connection, {
    envVariableName: "BUYER_WALLET",
    airdropAmount: LAMPORTS_PER_SOL * 2.0,
    minimumBalance: LAMPORTS_PER_SOL * 0.01,
  }
  )
  console.log("Buyer wallet address: ", buyerWallet.publicKey.toBase58());

  // Token sell simulation: parent wallet sells tokens to buyer wallet
  await simulateTokenSell(
    connection,
    mint,
    parentWallet,
    childWallets,
    buyerWallet,
    50,
    0.0001
  );

}

// Call the main function.
main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  }
);