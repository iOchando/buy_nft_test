const nearAPI = require("near-api-js");
const BN = require("bn.js")
const {functionCall, createTransaction} = require("near-api-js/lib/transaction");
const {PublicKey} = require("near-api-js/lib/utils");
const { keyStores, KeyPair, Near, Account, utils, WalletConnection, ConnectedWalletAccount, Contract} = nearAPI;

const CONTRACT_NFT = "nft16.musicfeast.testnet"
const ACCOUNT_ID = "testramper.testnet"
const MNEMONIC = "marble example orient elevator exchange sample turn embark alpha march fiscal chapter"
const PRIVATE_KEY = "ed25519:4tFS8Sz2nwFzvfuJ8Vhk31UX54QNLoSJKZGrRF5fADHdFKrwoPq5exueQwkf9ZVC1uFVKCFdFkBXCk4BH3V9L1tF"
const TOKEN_SERIES_ID = "11|1|1"
const AMOUNT_DEPOSIT = 0.5

const keyStore = new keyStores.InMemoryKeyStore();

const keyPair = KeyPair.fromString(PRIVATE_KEY);
keyStore.setKey("testnet", ACCOUNT_ID, keyPair);

const connectionConfig = {
  networkId: "testnet",
  keyStore, // first create a key store 
  nodeUrl: "https://rpc.testnet.near.org",
  walletUrl: "https://wallet.testnet.near.org",
  helperUrl: "https://helper.testnet.near.org",
  explorerUrl: "https://explorer.testnet.near.org",
};

const near = new Near(connectionConfig);

const account = new Account(near.connection, ACCOUNT_ID);

buyNftRamper(4)

async function buyNftRamper(priceDollars) {
  console.log("BUY INIT!!")
  if (!priceDollars > 0) {
    return
  }
  const contract = new Contract(
    account, // the account object that is connecting
    CONTRACT_NFT,
    {
      viewMethods: ["get_tasa"], // view methods do not change state but usually return a value
      changeMethods: [], // change methods modify state
    }
  );

  const tasa = await contract.get_tasa();

  if (!tasa) return

  const amount = (priceDollars / tasa) + AMOUNT_DEPOSIT
  const trx = await createTransactionFn(
    CONTRACT_NFT,
    [
      await functionCall(
        "nft_buy",
        {
          token_series_id: TOKEN_SERIES_ID, 
          receiver_id: ACCOUNT_ID,
        }, 
        new BN("300000000000000"),
        new BN(utils.format.parseNearAmount(String(amount)))
      )
    ],
    ACCOUNT_ID,
    near
  );
  const result = await account.signAndSendTransaction(trx);

  if (!result.transaction.hash) return;

  console.log("********** TRANSACTION HASH **********")
  console.log(result.transaction.hash)
  console.log("BUY END!");
}

async function createTransactionFn(
  receiverId,
  actions,
  userAddress,
  near
) {
  const walletConnection = new WalletConnection(near, null);
  const wallet = new ConnectedWalletAccount(
    walletConnection,
    near.connection,
    userAddress
  );

  if (!wallet || !near) {
    throw new Error(`No active wallet or NEAR connection.`);
  }

  const localKey = await near?.connection.signer.getPublicKey(
    userAddress,
    near.connection.networkId
  );

  const accessKey = await wallet.accessKeyForTransaction(
    receiverId,
    actions,
    localKey
  );

  if (!accessKey) {
    throw new Error(
      `Cannot find matching key for transaction sent to ${receiverId}`
    );
  }

  const block = await near?.connection.provider.block({
    finality: "final",
  });

  if (!block) {
    throw new Error(`Cannot find block for transaction sent to ${receiverId}`);
  }

  const blockHash = utils.serialize.base_decode(block?.header?.hash);
  //const blockHash = nearAPI.utils.serialize.base_decode(accessKey.block_hash);

  const publicKey = PublicKey.from(accessKey.public_key);
  //const nonce = accessKey.access_key.nonce + nonceOffset
  const nonce = ++accessKey.access_key.nonce;

  return createTransaction(
    userAddress,
    publicKey,
    receiverId,
    nonce,
    actions,
    blockHash
  );
}