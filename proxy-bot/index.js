require("dotenv").config();

const { ApiPromise, WsProvider, Keyring } = require("@polkadot/api");
const { ContractPromise } = require("@polkadot/api-contract");
const { BN, BN_ONE } = require("@polkadot/util");

// Testnet
const URL_BITTENSOR_NETWORK =
  process.env.URL_BITTENSOR_NETWORK || "wss://test.finney.opentensor.ai:443";
const URL_CONTRACT_NODE =
  process.env.URL_CONTRACT_NODE || "wss://rpc.shibuya.astar.network";
const STTAO_CONTACT_ADDRESS =
  process.env.STTAO_CONTACT_ADDRESS ||
  "YCLgHfwAS4B1jUbF6UDbTRP29PafGkxBvA1BdbdfEFfx1wy";
const PROXY_SEED =
  process.env.PROXY_SEED ||
  "young describe sugar civil bench dizzy salt submit balance trade appear frozen";
const NI_HOTKEY =
  process.env.NI_HOTKEY || "5GcBK8PDrVifV1xAf4Qkkk6KsbsmhDdX9atvk8vyKU8xdU63";

const proxyBot = async () => {
  // Connect to Bittensor network
  console.log("Connecting to Bittensor network....");
  const api = new ApiPromise({
    provider: new WsProvider(URL_BITTENSOR_NETWORK),
  });
  await api.isReady;
  console.log("API is ready");

  // existential deposit on bitensor network
  const existentialDeposit = api.consts.balances.existentialDeposit;

  // Connect to contracts node
  console.log("Connecting to contracts node");
  const contractApi = new ApiPromise({
    provider: new WsProvider(URL_CONTRACT_NODE),
  });
  await contractApi.isReady;
  console.log("Contact API is ready");

  const abi = require("./assets/contract.json");
  const stTao = new ContractPromise(contractApi, abi, STTAO_CONTACT_ADDRESS);

  const keyringBt = new Keyring({
    ss58Format: api.registry.chainSS58,
    type: "sr25519",
  });
  const keyringCN = new Keyring({
    ss58Format: contractApi.registry.chainSS58,
    type: "sr25519",
  });
  const proxyOnBt = keyringBt.createFromUri(PROXY_SEED);
  const proxyOnCN = keyringCN.createFromUri(PROXY_SEED);

  // get nonce
  const { nonce } = await contractApi.query.system.account(proxyOnCN.address);
  let activeNonce = nonce;

  const mintTokens = async (to, amount) => {
    const MAX_CALL_WEIGHT = new BN(5_000_000_000_000).isub(BN_ONE);
    const PROOFSIZE = new BN(1_000_000);
    const { gasRequired } = await stTao.query.mint(
      proxyOnCN.address,
      {
        gasLimit: contractApi.registry.createType("WeightV2", {
          refTime: MAX_CALL_WEIGHT,
          proofSize: PROOFSIZE,
        }),
        storageDepositLimit: null,
      },
      to,
      amount
    );
    const gasLimit = api.registry.createType("WeightV2", gasRequired);
    stTao.tx
      .mint({ gasLimit, storageDepositLimit: null }, to, amount)
      .signAndSend(proxyOnCN, { nonce: activeNonce }, async (res) => {
        if (res.status.isInBlock) {
          // console.log(`Minting ${amount} stTAOs to ${to}`);
        } else if (res.status.isFinalized) {
          console.log(`Successfully minted ${amount} stTAOs to ${to}`);
        }
      });
    ++activeNonce;
  };

  // Subscribe to system events via storage
  api.query.system.events((events) => {
    const now = new Date();
    events.forEach((record) => {
      const { event } = record;
      const { section, method, data } = event;

      if (section !== "balances" || method !== "Transfer") return;
      const from = data[0].toString();
      const to = data[1].toString();
      const amount = data[2].toString();
      if (to === proxyOnBt.address) {
        console.log(
          `${now.toLocaleDateString()} ${now.toLocaleTimeString()}: Received ${amount} TAOs from ${from}`
        );
        // The proxy bot should mint stTAO tokens to the sender
        mintTokens(
          keyringCN.encodeAddress(keyringBt.decodeAddress(from)),
          amount
        );
      }
    });
  });

  api.query.system.account(proxyOnBt.address, ({ data: { free } }) => {
    if (!free.gt(existentialDeposit)) return;
    const stakable = free - existentialDeposit;
    // call
    api.tx.subtensorModule
      .addStake(NI_HOTKEY, stakable)
      .signAndSend(proxyOnBt, (res) => {
        const error = res.events.filter(
          ({ event: { section, method } }) =>
            section === "system" && method === "ExtrinsicFailed"
        );
        if (error.length) console.error(error[0].toHuman());
        if (res.isFinalized)
          console.log(`Successfully staked ${stakable.toString()} TAOs`);
      });
  });
};

proxyBot();
