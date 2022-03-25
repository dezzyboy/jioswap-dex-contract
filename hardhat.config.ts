import { HardhatUserConfig } from 'hardhat/types';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-deploy-ethers';
import 'hardhat-deploy';
import 'hardhat-typechain';
import '@typechain/ethers-v5';

import * as dotenv from 'dotenv';
import { accounts } from './test/shared/accounts';

dotenv.config();

const secret: string = process.env.PRIVATE_KEY as string;
const etherscanKey: string = process.env.ETHERSCAN_API_KEY as string;

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.6.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },
        },
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      gas: 99999999,
      gasPrice: 875000000,
      blockGasLimit: 999999999,
      allowUnlimitedContractSize: false,
      accounts: accounts,
    },
    godwoken: {
      url: 'https://godwoken-testnet-web3-v1-rpc.ckbapp.dev',
      accounts: [secret],
    },
    // ropsten: {
    //   url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
    //   accounts: [secret],
    // },
    // mainnet: {
    //   url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    //   accounts: [secret],
    // },
    // kovan: {
    //   url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
    //   accounts: [secret],
    // },
    coverage: {
      url: 'http://127.0.0.1:8555', // Coverage launches its own ganache-cli client
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: etherscanKey,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
};
export default config;
