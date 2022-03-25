import { ethers } from 'hardhat';
import { JioswapFactory__factory } from '../typechain/factories/JioswapFactory__factory';
import { JioswapRouter02__factory } from '../typechain/factories/JioswapRouter02__factory';

async function main() {
  const signers = await ethers.getSigners();
  const wallet = signers[0];
  const provider = wallet.provider;
  const network = await provider?.getNetwork();
  const networkName = network?.name;

  console.log('Deploy');
  console.log(await wallet.getAddress());
  const factoryContract = await new JioswapFactory__factory(wallet).deploy(await wallet.getAddress());

  console.log('Factory deployed');
  const WETHaddress = '0x86efaff75201Ed513c2c9061f2913eec850af56C';
  console.log(networkName);
  // if (network?.name === 'godwoken') {
  //   WETHaddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; //Mainnet
  // } else if (network?.name === 'rinkeby') {
  //   WETHaddress = '0x2fcc4dba284dcf665091718e4d0dab53a416dfe7'; //Rinkeby
  // } else if (network?.name === 'ropsten') {
  //   WETHaddress = '0x0a180a76e4466bf68a7f86fb029bed3cccfaaac5'; //Ropsten
  // }

  const router02Contract = await new JioswapRouter02__factory(wallet).deploy(factoryContract.address, WETHaddress);

  console.log('factory:', factoryContract.address);
  console.log('Router:', router02Contract.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
