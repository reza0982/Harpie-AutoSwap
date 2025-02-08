const axios = require('axios');
const headers = require('./headers');

async function verifyAccountIdentity(walletAddress) {
  const url = `https://rpc.walletconnect.org/v1/identity/${walletAddress}?projectId=c4c07616f2ce534e3f61779c51f3d3aa&sender=${walletAddress}`;
  try {
    await Promise.race([
      axios.get(url, { headers }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);
  } catch (error) {

  }
}

module.exports = {
  verifyAccountIdentity
};