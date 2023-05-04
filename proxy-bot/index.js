require("dotenv").config();

// Testnet
const NETWORK_URL =
  process.env.NETWORK_URL || "wss://test.finney.opentensor.ai:443";
// const NETWORK_URL = "";
const PROXY_ADDRESS =
  process.env.PROXY_ADDRESS ||
  "5G9Df1fBN89mJcgebcRpvJ2YThaWzEN94YZVptPio1a4SFLT";
const PROXY_SEED =
  process.env.PROXY_SEED ||
  "grace enact rigid title broccoli owner access update swarm alpha mail rookie";

const getProxyAccount = () => {
  return {};
};

const proxyBot = async () => {
  const { ApiPromise, WsProvider } = require("@polkadot/api");

  console.log("Connecting to network....");
  const wsProvider = new WsProvider(NETWORK_URL);

  const api = new ApiPromise({ provider: wsProvider });
  await api.isReady;

  console.log("API is ready");

  // Subscribe to system events via storage
  api.query.system.events((events) => {
    const now = new Date();
    console.log(
      `${now.toLocaleDateString()} ${now.toLocaleTimeString()}: Received ${
        events.length
      } event(s)`
    );
    events.forEach((record) => {
      // extract the phase, event and the event types
      const { event } = record;
      const { section, method, data } = event;

      if (section !== "balances" || method !== "Transfer") return;
      const from = data[0].toString();
      const to = data[1].toString();
      const amount = data[2].toString();
      if (to === PROXY_ADDRESS) {
        console.log(`Received ${amount} TAOs from ${from}`);
      }
    });
  });
};

proxyBot();
