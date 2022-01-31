import { config as dotEnvConfig } from 'dotenv';
dotEnvConfig({ path: '../../.env' });

import { HardhatUserConfig } from 'hardhat/types';

import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-etherscan';
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';

process.env.REPORT_GAS = 'y';

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const INFURA_PROJECT_ID = process.env.NEXT_PUBLIC_INFURA_PROJECT_ID;
const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;

const PRIVATE_KEY = process.env.PRIVATE_KEY || undefined;

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      chainId: 1337,
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
        blockNumber: 14090042
      }
    },
    localhost: {
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  typechain: {
    outDir: '../web/types/typechain-types'
  },
  gasReporter: {
    currency: 'USD',
    coinmarketcap: '181841aa-db2a-4825-8359-f0dcce4d0db5'
  }
};

export default config;
