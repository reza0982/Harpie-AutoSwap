const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');
const contractABI = require('./src/abi');
const config = require('./config');
const headers = require('./src/headers');

const rpcUrl = "https://rpc-polygon.harpie.io";
const web3 = new Web3(new Web3.HTTPProvider(rpcUrl));  // Fixed Web3 Provider
const wpolABI = require('./src/wpol'); // Assuming wpol.js exports ABI
const wpolAddress = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
const wpolContract = new web3.eth.Contract(wpolABI, wpolAddress);  // Fixed WPOL Contract Initialization

const contractAddress = '0x1Cd0cd01c8C902AdAb3430ae04b9ea32CB309CF1';
const spenderAddress = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const contract = new web3.eth.Contract(contractABI, contractAddress);
const amount = web3.utils.toWei(config.amountToWrap.toString(), 'ether');

async function approveWPOLIfNeeded(account, walletNumber) {
  try {
    const allowance = await wpolContract.methods.allowance(account.address, spenderAddress).call();
    const maxUint256 = '1461501637330902918203684832716283019655932542975';

    if (web3.utils.toBN(allowance).lt(web3.utils.toBN(amount))) {  // Fixed BN comparison
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Approving WPOL...`);
      const data = wpolContract.methods.approve(spenderAddress, maxUint256).encodeABI();
      const tx = {
        from: account.address,
        to: wpolContract.options.address,
        gas: 100000,
        data: data
      };

      const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m WPOL approved with hash: \x1b[33m${receipt.transactionHash}\x1b[0m`);
    } else {
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Sufficient WPOL allowance available.`);
    }
  } catch (error) {
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error approving WPOL:`, error);
  }
}

async function isBalanceSufficient(account, requiredAmount, walletNumber) {
  try {
    const balance = await web3.eth.getBalance(account.address);
    const gasPrice = await web3.eth.getGasPrice();
    const estimatedGas = 2000000;
    const requiredGasFee = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(estimatedGas));

    if (web3.utils.toBN(balance).lt(web3.utils.toBN(requiredAmount).add(requiredGasFee))) {
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Insufficient balance or gas fee for \x1b[33m${account.address}\x1b[0m. Skipping transaction.`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error checking balance:`, error);
    return false;
  }
}

async function wrapTokens(account, walletNumber, numTransactions) {
  try {
    await approveWPOLIfNeeded(account, walletNumber);

    for (let i = 0; i < numTransactions; i++) {
      if (!(await isBalanceSufficient(account, amount, walletNumber))) {
        continue;
      }

      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Executing transaction ${i + 1} of ${numTransactions}`);
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Converting ${web3.utils.fromWei(amount, 'ether')} WPOL to tPOL`);

      const data = contract.methods.wrap(amount, account.address).encodeABI();
      const tx = {
        from: account.address,
        to: contractAddress,
        gas: 2000000,
        data: data
      };

      const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log(`\x1b[36m[${walletNumber}]\x1b[0m Transaction successful with hash: \x1b[33m${receipt.transactionHash}\x1b[0m`);

      const gasUsed = receipt.gasUsed;
      const gasPrice = await web3.eth.getGasPrice();
      const gasFeeAmount = web3.utils.toBN(gasUsed).mul(web3.utils.toBN(gasPrice)).toString();
    }
  } catch (error) {
    console.error(`\x1b[36m[${walletNumber}]\x1b[0m Error executing transaction:`, error);
  }
}

async function executeMultipleTransactions(initialChoice = null, initialNumTransactions = 1, initialPolAmount = 0) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  await processTransactions(rl, initialChoice, initialNumTransactions, initialPolAmount);
}

async function processTransactions(rl, initialChoice = null, initialNumTransactions = 1, initialPolAmount = 0) {
  let numTransactions = initialNumTransactions;
  let polAmount = initialPolAmount;

  numTransactions = config.repeat;

  const privateKeys = fs.readFileSync(path.join(__dirname, 'priv.txt'), 'utf-8')
    .split('\n')
    .map(key => key.trim())
    .map(key => key.startsWith('0x') ? key.slice(2) : key)
    .filter(key => key.length === 64);

  if (privateKeys.length === 0) {
    console.error('No valid private keys found in priv.txt.');
    rl.close();
    return;
  }

  for (const [index, privateKey] of privateKeys.entries()) {
    const walletNumber = index + 1;
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);

    console.log(`\x1b[36m[${walletNumber}]\x1b[0m Processing transactions for account: \x1b[32m${account.address}\x1b[0m`);
    await wrapTokens(account, walletNumber, numTransactions);
  }
}

executeMultipleTransactions();
