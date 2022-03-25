import chai, { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { solidity } from 'ethereum-waffle';

import { getCreate2Address } from './shared/utilities';
import { factoryFixture } from './shared/fixtures';
import { JioswapFactory } from '../typechain/JioswapFactory';
import JioswapPair from '../artifacts/contracts/JioswapPair.sol/JioswapPair.json';
import { ethers } from 'hardhat';
import { JioswapPair__factory } from '../typechain/factories/JioswapPair__factory';

chai.use(solidity);

const TEST_ADDRESSES: [string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000',
];

describe('JioswapFactory', () => {
  let factory: JioswapFactory;
  let wallet: Signer;
  beforeEach(async () => {
    const signers = await ethers.getSigners();
    wallet = signers[0];
    const fixture = await factoryFixture(signers);
    factory = fixture.factory;
  });

  it('feeToSetter, allPairsLength', async () => {
    expect(await factory.feeToSetter()).to.eq(await wallet.getAddress());
    expect(await factory.allPairsLength()).to.eq(0);
  });

  async function createPair(tokens: [string, string]) {
    const _factory: Contract = factory;
    const bytecode = JioswapPair.bytecode;
    const create2Address = getCreate2Address(_factory.address, tokens, bytecode);
    await expect(_factory.createPair(...tokens))
      .to.emit(_factory, 'PairCreated')
      .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address, ethers.BigNumber.from(1));

    await expect(_factory.createPair(...tokens)).to.be.reverted; // Jioswap: PAIR_EXISTS
    await expect(_factory.createPair(...tokens.slice().reverse())).to.be.reverted; // Jioswap: PAIR_EXISTS
    expect(await _factory.getPair(...tokens)).to.eq(create2Address);
    expect(await _factory.getPair(...tokens.slice().reverse())).to.eq(create2Address);
    expect(await _factory.allPairs(0)).to.eq(create2Address);
    expect(await _factory.allPairsLength()).to.eq(1);

    const pair = await new JioswapPair__factory(wallet).attach(create2Address);
    expect(await pair.factory()).to.eq(factory.address);
    expect(await pair.token0()).to.eq(TEST_ADDRESSES[0]);
    expect(await pair.token1()).to.eq(TEST_ADDRESSES[1]);
  }

  it('createPair', async () => {
    await createPair(TEST_ADDRESSES);
  });

  it('createPair:reverse', async () => {
    await createPair(TEST_ADDRESSES.slice().reverse() as [string, string]);
  });

  it('createPair:gas', async () => {
    const tx = await factory.createPair(...TEST_ADDRESSES);
    const receipt = await tx.wait();
    expect(receipt.gasUsed).to.eq(2478001);
  });

  it('getCreationCode', async () => {
    // Notice! If creation code changes, JioswapLibrary.pairFor code should be changed too.
    expect(await factory.getCreationCode()).to.be.eq(
      '0x4d2aa46a43c997a6659df1acaaa2771acdbfcba47edb77e97a97903a44c49d80',
    );
  });
});
