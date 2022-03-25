import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { Contract, Signer } from 'ethers';
import { BigNumber } from 'ethers';
import { v2Fixture } from './shared/fixtures';
import { expandTo18Decimals } from './shared/utilities';
import { ethers } from 'hardhat';
import { JioswapRouter02 } from '../typechain/JioswapRouter02';
import { DeflatingErc20__factory } from '../typechain/factories/DeflatingErc20__factory';
import { Erc20 } from '../typechain/Erc20';
import { JioswapPair__factory } from '../typechain/factories/JioswapPair__factory';

chai.use(solidity);

const overrides = {
  gasLimit: 9999999,
};

describe('JioswapRouter02', () => {
  let token0: Erc20;
  let token1: Contract;
  let router: JioswapRouter02;
  let wallet: Signer;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    wallet = signers[0];
    const fixture = await v2Fixture(signers);
    token0 = fixture.token0;
    token1 = fixture.token1;
    router = fixture.router02;
  });

  it('quote', async () => {
    expect(await router.quote(BigNumber.from(1), BigNumber.from(100), BigNumber.from(200))).to.eq(BigNumber.from(2));
    expect(await router.quote(BigNumber.from(2), BigNumber.from(200), BigNumber.from(100))).to.eq(BigNumber.from(1));
    await expect(router.quote(BigNumber.from(0), BigNumber.from(100), BigNumber.from(200))).to.be.revertedWith(
      'JioswapLibrary: INSUFFICIENT_AMOUNT',
    );
    await expect(router.quote(BigNumber.from(1), BigNumber.from(0), BigNumber.from(200))).to.be.revertedWith(
      'JioswapLibrary: INSUFFICIENT_LIQUIDITY',
    );
    await expect(router.quote(BigNumber.from(1), BigNumber.from(100), BigNumber.from(0))).to.be.revertedWith(
      'JioswapLibrary: INSUFFICIENT_LIQUIDITY',
    );
  });

  it('getAmountOut', async () => {
    expect(await router.getAmountOut(BigNumber.from(2), BigNumber.from(100), BigNumber.from(100))).to.eq(
      BigNumber.from(1),
    );
    await expect(router.getAmountOut(BigNumber.from(0), BigNumber.from(100), BigNumber.from(100))).to.be.revertedWith(
      'JioswapLibrary: INSUFFICIENT_INPUT_AMOUNT',
    );
    await expect(router.getAmountOut(BigNumber.from(2), BigNumber.from(0), BigNumber.from(100))).to.be.revertedWith(
      'JioswapLibrary: INSUFFICIENT_LIQUIDITY',
    );
    await expect(router.getAmountOut(BigNumber.from(2), BigNumber.from(100), BigNumber.from(0))).to.be.revertedWith(
      'JioswapLibrary: INSUFFICIENT_LIQUIDITY',
    );
  });

  it('getAmountIn', async () => {
    expect(await router.getAmountIn(BigNumber.from(1), BigNumber.from(100), BigNumber.from(100))).to.eq(
      BigNumber.from(2),
    );
    await expect(router.getAmountIn(BigNumber.from(0), BigNumber.from(100), BigNumber.from(100))).to.be.revertedWith(
      'JioswapLibrary: INSUFFICIENT_OUTPUT_AMOUNT',
    );
    await expect(router.getAmountIn(BigNumber.from(1), BigNumber.from(0), BigNumber.from(100))).to.be.revertedWith(
      'JioswapLibrary: INSUFFICIENT_LIQUIDITY',
    );
    await expect(router.getAmountIn(BigNumber.from(1), BigNumber.from(100), BigNumber.from(0))).to.be.revertedWith(
      'JioswapLibrary: INSUFFICIENT_LIQUIDITY',
    );
  });

  it('getAmountsOut', async () => {
    await token0.approve(router.address, ethers.constants.MaxUint256);
    await token1.approve(router.address, ethers.constants.MaxUint256);
    await router.addLiquidity(
      token0.address,
      token1.address,
      BigNumber.from(10000),
      BigNumber.from(10000),
      0,
      0,
      await wallet.getAddress(),
      ethers.constants.MaxUint256,
      overrides,
    );

    await expect(router.getAmountsOut(BigNumber.from(2), [token0.address])).to.be.revertedWith(
      'JioswapLibrary: INVALID_PATH',
    );
    const path = [token0.address, token1.address];
    expect(await router.getAmountsOut(BigNumber.from(2), path)).to.deep.eq([BigNumber.from(2), BigNumber.from(1)]);
  });

  it('getAmountsIn', async () => {
    await token0.approve(router.address, ethers.constants.MaxUint256);
    await token1.approve(router.address, ethers.constants.MaxUint256);
    await router.addLiquidity(
      token0.address,
      token1.address,
      BigNumber.from(10000),
      BigNumber.from(10000),
      0,
      0,
      await wallet.getAddress(),
      ethers.constants.MaxUint256,
      overrides,
    );

    await expect(router.getAmountsIn(BigNumber.from(1), [token0.address])).to.be.revertedWith(
      'JioswapLibrary: INVALID_PATH',
    );
    const path = [token0.address, token1.address];
    expect(await router.getAmountsIn(BigNumber.from(1), path)).to.deep.eq([BigNumber.from(2), BigNumber.from(1)]);
  });
});

describe('fee-on-transfer tokens', () => {
  let DTT: Contract;
  let WETH: Contract;
  let router: Contract;
  let pair: Contract;
  let wallet: Signer;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    wallet = signers[0];
    const fixture = await v2Fixture(signers);
    WETH = fixture.WETH;
    router = fixture.router02;

    DTT = await new DeflatingErc20__factory(wallet).deploy(expandTo18Decimals(10000));

    // make a DTT<>WETH pair
    await fixture.factoryV2.createPair(DTT.address, WETH.address);
    const pairAddress = await fixture.factoryV2.getPair(DTT.address, WETH.address);
    pair = await new JioswapPair__factory(wallet).attach(pairAddress); // new Contract(pairAddress, JSON.stringify(IJioswapPair.abi), ethers.provider).connect(wallet);
  });

  afterEach(async function () {
    expect(await ethers.provider.getBalance(router.address)).to.eq(0);
  });

  async function addLiquidity(DTTAmount: BigNumber, WETHAmount: BigNumber) {
    await DTT.approve(router.address, ethers.constants.MaxUint256);
    await router.addLiquidityETH(
      DTT.address,
      DTTAmount,
      DTTAmount,
      WETHAmount,
      await wallet.getAddress(),
      ethers.constants.MaxUint256,
      {
        ...overrides,
        value: WETHAmount,
      },
    );
  }

  it('removeLiquidityETHSupportingFeeOnTransferTokens', async () => {
    const DTTAmount = expandTo18Decimals(1);
    const ETHAmount = expandTo18Decimals(4);
    await addLiquidity(DTTAmount, ETHAmount);

    const DTTInPair = await DTT.balanceOf(pair.address);
    const WETHInPair = await WETH.balanceOf(pair.address);
    const liquidity = await pair.balanceOf(await wallet.getAddress());
    const totalSupply = await pair.totalSupply();
    const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply);
    const WETHExpected = WETHInPair.mul(liquidity).div(totalSupply);

    await pair.approve(router.address, ethers.constants.MaxUint256);
    await router.removeLiquidityETHSupportingFeeOnTransferTokens(
      DTT.address,
      liquidity,
      NaiveDTTExpected,
      WETHExpected,
      await wallet.getAddress(),
      ethers.constants.MaxUint256,
      overrides,
    );
  });

  describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
    const DTTAmount = expandTo18Decimals(5).mul(100).div(99);
    const ETHAmount = expandTo18Decimals(10);
    const amountIn = expandTo18Decimals(1);

    beforeEach(async () => {
      await addLiquidity(DTTAmount, ETHAmount);
    });

    it('DTT -> WETH', async () => {
      await DTT.approve(router.address, ethers.constants.MaxUint256);

      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [DTT.address, WETH.address],
        await wallet.getAddress(),
        ethers.constants.MaxUint256,
        overrides,
      );
    });

    // WETH -> DTT
    it('WETH -> DTT', async () => {
      await WETH.deposit({ value: amountIn }); // mint WETH
      await WETH.approve(router.address, ethers.constants.MaxUint256);

      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [WETH.address, DTT.address],
        await wallet.getAddress(),
        ethers.constants.MaxUint256,
        overrides,
      );
    });
  });

  // ETH -> DTT
  it('swapExactETHForTokensSupportingFeeOnTransferTokens', async () => {
    const DTTAmount = expandTo18Decimals(10).mul(100).div(99);
    const ETHAmount = expandTo18Decimals(5);
    const swapAmount = expandTo18Decimals(1);
    await addLiquidity(DTTAmount, ETHAmount);

    await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      [WETH.address, DTT.address],
      await wallet.getAddress(),
      ethers.constants.MaxUint256,
      {
        ...overrides,
        value: swapAmount,
      },
    );
  });

  // DTT -> ETH
  it('swapExactTokensForETHSupportingFeeOnTransferTokens', async () => {
    const DTTAmount = expandTo18Decimals(5).mul(100).div(99);
    const ETHAmount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);

    await addLiquidity(DTTAmount, ETHAmount);
    await DTT.approve(router.address, ethers.constants.MaxUint256);

    await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
      swapAmount,
      0,
      [DTT.address, WETH.address],
      await wallet.getAddress(),
      ethers.constants.MaxUint256,
      overrides,
    );
  });
});

describe('fee-on-transfer tokens: reloaded', () => {
  let DTT: Contract;
  let DTT2: Contract;
  let router: Contract;
  let wallet: Signer;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    wallet = signers[0];
    const fixture = await v2Fixture(signers);

    router = fixture.router02;

    DTT = await new DeflatingErc20__factory(wallet).deploy(expandTo18Decimals(10000));
    DTT2 = await new DeflatingErc20__factory(wallet).deploy(expandTo18Decimals(10000));

    // make a DTT<>WETH pair
    await fixture.factoryV2.createPair(DTT.address, DTT2.address);
    await fixture.factoryV2.getPair(DTT.address, DTT2.address);
  });

  afterEach(async function () {
    expect(await ethers.provider.getBalance(router.address)).to.eq(0);
  });

  async function addLiquidity(DTTAmount: BigNumber, DTT2Amount: BigNumber) {
    await DTT.approve(router.address, ethers.constants.MaxUint256);
    await DTT2.approve(router.address, ethers.constants.MaxUint256);
    await router.addLiquidity(
      DTT.address,
      DTT2.address,
      DTTAmount,
      DTT2Amount,
      DTTAmount,
      DTT2Amount,
      await wallet.getAddress(),
      ethers.constants.MaxUint256,
      overrides,
    );
  }

  describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
    const DTTAmount = expandTo18Decimals(5).mul(100).div(99);
    const DTT2Amount = expandTo18Decimals(5);
    const amountIn = expandTo18Decimals(1);

    beforeEach(async () => {
      await addLiquidity(DTTAmount, DTT2Amount);
    });

    it('DTT -> DTT2', async () => {
      await DTT.approve(router.address, ethers.constants.MaxUint256);

      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [DTT.address, DTT2.address],
        await wallet.getAddress(),
        ethers.constants.MaxUint256,
        overrides,
      );
    });
  });
});
