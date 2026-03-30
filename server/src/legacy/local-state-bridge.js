const { readState, writeState } = require("../state-store");

async function readLegacyBridgeState() {
  return readState();
}

async function writeLegacyBridgeState(state) {
  return writeState(state);
}

module.exports = {
  readLegacyBridgeState,
  writeLegacyBridgeState
};
