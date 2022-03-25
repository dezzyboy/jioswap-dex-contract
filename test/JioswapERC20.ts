import chai, { expect } from 'chai';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { hexlify, keccak256, defaultAbiCoder, toUtf8Bytes } from 'ethers/lib/utils';
import { solidity } from 'ethereum-waffle';
import { ecsign } from 'ethereumjs-util';
import { expandTo18Decimals, getApprovalDigest } from './shared/utilities';
import { Erc20 } from '../typechain/Erc20';
import { Erc20__factory } from '../typechain/factories/Erc20__factory';
import { accounts } from './shared/accounts';

chai.use(solidity);

const TOTAL_SUPPLY = expandTo18Decimals(10000);
const TEST_AMOUNT = expandTo18Decimals(10);

describe('JioswapERC20', () => {
  let wallet: Signer;
  let other: Signer;
  let token: Erc20;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    wallet = signers[0];
    other = signers[1];
    token = await new Erc20__factory(wallet).deploy(TOTAL_SUPPLY);
  });

  it('name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH', async () => {
    const name = await token.name();
    expect(name).to.eq('JioswapDex');
    expect(await token.symbol()).to.eq('JioDex');
    expect(await token.decimals()).to.eq(18);
    expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY);
    expect(await token.balanceOf(await wallet.getAddress())).to.eq(TOTAL_SUPPLY);
    expect(await token.DOMAIN_SEPARATOR()).to.eq(
      keccak256(
        defaultAbiCoder.encode(
          ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
          [
            keccak256(
              toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
            ),
            keccak256(toUtf8Bytes(name)),
            keccak256(toUtf8Bytes('1')),
            ethers.provider.network.chainId,
            token.address,
          ],
        ),
      ),
    );
    expect(await token.PERMIT_TYPEHASH()).to.eq(
      keccak256(toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')),
    );
  });

  it('approve', async () => {
    await expect(token.approve(await other.getAddress(), TEST_AMOUNT))
      .to.emit(token, 'Approval')
      .withArgs(await wallet.getAddress(), await other.getAddress(), TEST_AMOUNT);
    expect(await token.allowance(await wallet.getAddress(), await other.getAddress())).to.eq(TEST_AMOUNT);
  });

  it('transfer', async () => {
    await expect(token.transfer(await other.getAddress(), TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(await wallet.getAddress(), await other.getAddress(), TEST_AMOUNT);
    expect(await token.balanceOf(await wallet.getAddress())).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(await other.getAddress())).to.eq(TEST_AMOUNT);
  });

  it('transfer:fail', async () => {
    await expect(token.transfer(await other.getAddress(), TOTAL_SUPPLY.add(1))).to.be.reverted; // ds-math-sub-underflow
    await expect(token.connect(other).transfer(await wallet.getAddress(), 1)).to.be.reverted; // ds-math-sub-underflow
  });

  it('transferFrom', async () => {
    await token.approve(await other.getAddress(), TEST_AMOUNT);
    await expect(token.connect(other).transferFrom(await wallet.getAddress(), await other.getAddress(), TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(await wallet.getAddress(), await other.getAddress(), TEST_AMOUNT);
    expect(await token.allowance(await wallet.getAddress(), await other.getAddress())).to.eq(0);
    expect(await token.balanceOf(await wallet.getAddress())).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(await other.getAddress())).to.eq(TEST_AMOUNT);
  });

  it('transferFrom:max', async () => {
    await token.approve(await other.getAddress(), ethers.constants.MaxUint256);
    await expect(token.connect(other).transferFrom(await wallet.getAddress(), await other.getAddress(), TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(await wallet.getAddress(), await other.getAddress(), TEST_AMOUNT);
    expect(await token.allowance(await wallet.getAddress(), await other.getAddress())).to.eq(
      ethers.constants.MaxUint256,
    );
    expect(await token.balanceOf(await wallet.getAddress())).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    expect(await token.balanceOf(await other.getAddress())).to.eq(TEST_AMOUNT);
  });

  it('permit', async () => {
    const nonce = await token.nonces(await wallet.getAddress());
    const deadline = ethers.constants.MaxUint256;
    const digest = await getApprovalDigest(
      token,
      { owner: await wallet.getAddress(), spender: await other.getAddress(), value: TEST_AMOUNT },
      nonce,
      deadline,
      ethers.provider.network.chainId,
    );

    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), 'hex'),
      Buffer.from(accounts[0].privateKey.slice(2), 'hex'),
    );

    await expect(
      token.permit(
        await wallet.getAddress(),
        await other.getAddress(),
        TEST_AMOUNT,
        deadline,
        v,
        hexlify(r),
        hexlify(s),
      ),
    )
      .to.emit(token, 'Approval')
      .withArgs(await wallet.getAddress(), await other.getAddress(), TEST_AMOUNT);
    expect(await token.allowance(await wallet.getAddress(), await other.getAddress())).to.eq(TEST_AMOUNT);
    expect(await token.nonces(await wallet.getAddress())).to.eq(ethers.BigNumber.from(1));
  });
});
