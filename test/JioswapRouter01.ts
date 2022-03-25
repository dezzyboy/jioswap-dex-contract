import { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';

import { expandTo18Decimals, MINIMUM_LIQUIDITY } from './shared/utilities';
import { v2Fixture } from './shared/fixtures';
import { JioswapRouter02 } from '../typechain/JioswapRouter02';
import { JioswapFactory } from '../typechain/JioswapFactory';

chai.use(solidity);

const overrides = {
  gasLimit: 9999999,
};

describe('JioswapRouter{01,02}', () => {
  let token0: Contract;
  let token1: Contract;
  let WETH: Contract;
  let WETHPartner: Contract;
  let factory: JioswapFactory;
  let router: Contract;
  let router02: JioswapRouter02;
  let pair: Contract;
  let WETHPair: Contract;
  let wallet: Signer;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    wallet = signers[0];
    const fixture = await v2Fixture(signers);
    token0 = fixture.token0;
    token1 = fixture.token1;
    WETH = fixture.WETH;
    WETHPartner = fixture.WETHPartner;
    factory = fixture.factoryV2;
    router02 = fixture.router02;
    router = fixture.router02;
    pair = fixture.pair;
    WETHPair = fixture.WETHPair;
  });

  afterEach(async function () {
    expect(await ethers.provider.getBalance(router.address)).to.eq(ethers.constants.Zero);
  });

  describe('JioswapRouter02', () => {
    it('factory, WETH', async () => {
      expect(await router.factory()).to.eq(factory.address);
      expect(await router.WETH()).to.eq(WETH.address);
    });

    it('addLiquidity', async () => {
      const router = router02;
      const token0Amount = expandTo18Decimals(1);
      const token1Amount = expandTo18Decimals(4);

      const expectedLiquidity = expandTo18Decimals(2);
      await token0.approve(router.address, ethers.constants.MaxUint256);
      await token1.approve(router.address, ethers.constants.MaxUint256);

      await expect(
        router.addLiquidity(
          token0.address,
          token1.address,
          token0Amount,
          token1Amount,
          0,
          0,
          await wallet.getAddress(),
          ethers.constants.MaxUint256,
          overrides,
        ),
      )
        .to.emit(token0, 'Transfer')
        .withArgs(await wallet.getAddress(), pair.address, token0Amount)
        .to.emit(token1, 'Transfer')
        .withArgs(await wallet.getAddress(), pair.address, token1Amount)
        .to.emit(pair, 'Transfer')
        .withArgs(ethers.constants.AddressZero, ethers.constants.AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pair, 'Transfer')
        .withArgs(ethers.constants.AddressZero, await wallet.getAddress(), expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        .to.emit(pair, 'Sync')
        .withArgs(token0Amount, token1Amount)
        .to.emit(pair, 'Mint')
        .withArgs(router.address, token0Amount, token1Amount);

      expect(await pair.balanceOf(await wallet.getAddress())).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY));
    });

    it('addLiquidityETH', async () => {
      const WETHPartnerAmount = expandTo18Decimals(1);
      const ETHAmount = expandTo18Decimals(4);

      const expectedLiquidity = expandTo18Decimals(2);
      const WETHPairToken0 = await WETHPair.token0();
      await WETHPartner.approve(router.address, ethers.constants.MaxUint256);
      await expect(
        router.addLiquidityETH(
          WETHPartner.address,
          WETHPartnerAmount,
          WETHPartnerAmount,
          ETHAmount,
          await wallet.getAddress(),
          ethers.constants.MaxUint256,
          { ...overrides, value: ETHAmount },
        ),
      )
        .to.emit(WETHPair, 'Transfer')
        .withArgs(ethers.constants.AddressZero, ethers.constants.AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(WETHPair, 'Transfer')
        .withArgs(ethers.constants.AddressZero, await wallet.getAddress(), expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        .to.emit(WETHPair, 'Sync')
        .withArgs(
          WETHPairToken0 === WETHPartner.address ? WETHPartnerAmount : ETHAmount,
          WETHPairToken0 === WETHPartner.address ? ETHAmount : WETHPartnerAmount,
        )
        .to.emit(WETHPair, 'Mint')
        .withArgs(
          router.address,
          WETHPairToken0 === WETHPartner.address ? WETHPartnerAmount : ETHAmount,
          WETHPairToken0 === WETHPartner.address ? ETHAmount : WETHPartnerAmount,
        );

      expect(await WETHPair.balanceOf(await wallet.getAddress())).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY));
    });

    async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
      await token0.transfer(pair.address, token0Amount);
      await token1.transfer(pair.address, token1Amount);
      await pair.mint(await wallet.getAddress(), overrides);
    }
    it('removeLiquidity', async () => {
      const token0Amount = expandTo18Decimals(1);
      const token1Amount = expandTo18Decimals(4);
      await addLiquidity(token0Amount, token1Amount);

      const expectedLiquidity = expandTo18Decimals(2);
      await pair.approve(router.address, ethers.constants.MaxUint256);
      await expect(
        router.removeLiquidity(
          token0.address,
          token1.address,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY),
          0,
          0,
          await wallet.getAddress(),
          ethers.constants.MaxUint256,
          overrides,
        ),
      )
        .to.emit(pair, 'Transfer')
        .withArgs(await wallet.getAddress(), pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        .to.emit(pair, 'Transfer')
        .withArgs(pair.address, ethers.constants.AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        .to.emit(token0, 'Transfer')
        .withArgs(pair.address, await wallet.getAddress(), token0Amount.sub(500))
        .to.emit(token1, 'Transfer')
        .withArgs(pair.address, await wallet.getAddress(), token1Amount.sub(2000))
        .to.emit(pair, 'Sync')
        .withArgs(500, 2000)
        .to.emit(pair, 'Burn')
        .withArgs(router.address, token0Amount.sub(500), token1Amount.sub(2000), await wallet.getAddress());

      expect(await pair.balanceOf(await wallet.getAddress())).to.eq(0);
      const totalSupplyToken0 = await token0.totalSupply();
      const totalSupplyToken1 = await token1.totalSupply();
      expect(await token0.balanceOf(await wallet.getAddress())).to.eq(totalSupplyToken0.sub(500));
      expect(await token1.balanceOf(await wallet.getAddress())).to.eq(totalSupplyToken1.sub(2000));
    });

    it('removeLiquidityETH', async () => {
      const WETHPartnerAmount = expandTo18Decimals(1);
      const ETHAmount = expandTo18Decimals(4);
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount);
      await WETH.deposit({ value: ETHAmount });
      await WETH.transfer(WETHPair.address, ETHAmount);
      await WETHPair.mint(await wallet.getAddress(), overrides);

      const expectedLiquidity = expandTo18Decimals(2);
      const WETHPairToken0 = await WETHPair.token0();
      await WETHPair.approve(router.address, ethers.constants.MaxUint256);
      await expect(
        router.removeLiquidityETH(
          WETHPartner.address,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY),
          0,
          0,
          await wallet.getAddress(),
          ethers.constants.MaxUint256,
          overrides,
        ),
      )
        .to.emit(WETHPair, 'Transfer')
        .withArgs(await wallet.getAddress(), WETHPair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        .to.emit(WETHPair, 'Transfer')
        .withArgs(WETHPair.address, ethers.constants.AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        .to.emit(WETH, 'Transfer')
        .withArgs(WETHPair.address, router.address, ETHAmount.sub(2000))
        .to.emit(WETHPartner, 'Transfer')
        .withArgs(WETHPair.address, router.address, WETHPartnerAmount.sub(500))
        .to.emit(WETHPartner, 'Transfer')
        .withArgs(router.address, await wallet.getAddress(), WETHPartnerAmount.sub(500))
        .to.emit(WETHPair, 'Sync')
        .withArgs(
          WETHPairToken0 === WETHPartner.address ? 500 : 2000,
          WETHPairToken0 === WETHPartner.address ? 2000 : 500,
        )
        .to.emit(WETHPair, 'Burn')
        .withArgs(
          router.address,
          WETHPairToken0 === WETHPartner.address ? WETHPartnerAmount.sub(500) : ETHAmount.sub(2000),
          WETHPairToken0 === WETHPartner.address ? ETHAmount.sub(2000) : WETHPartnerAmount.sub(500),
          router.address,
        );

      expect(await WETHPair.balanceOf(await wallet.getAddress())).to.eq(0);
      const totalSupplyWETHPartner = await WETHPartner.totalSupply();
      const totalSupplyWETH = await WETH.totalSupply();
      expect(await WETHPartner.balanceOf(await wallet.getAddress())).to.eq(totalSupplyWETHPartner.sub(500));
      expect(await WETH.balanceOf(await wallet.getAddress())).to.eq(totalSupplyWETH.sub(2000));
    });

    describe('swapExactTokensForTokens', () => {
      const token0Amount = expandTo18Decimals(5);
      const token1Amount = expandTo18Decimals(10);
      const swapAmount = expandTo18Decimals(1);
      const expectedOutputAmount = BigNumber.from('1662497915624478906');

      beforeEach(async () => {
        await addLiquidity(token0Amount, token1Amount);
        await token0.approve(router.address, ethers.constants.MaxUint256);
      });

      it('happy path', async () => {
        await expect(
          router.swapExactTokensForTokens(
            swapAmount,
            0,
            [token0.address, token1.address],
            await wallet.getAddress(),
            ethers.constants.MaxUint256,
            overrides,
          ),
        )
          .to.emit(token0, 'Transfer')
          .withArgs(await wallet.getAddress(), pair.address, swapAmount)
          .to.emit(token1, 'Transfer')
          .withArgs(pair.address, await wallet.getAddress(), expectedOutputAmount)
          .to.emit(pair, 'Sync')
          .withArgs(token0Amount.add(swapAmount), token1Amount.sub(expectedOutputAmount))
          .to.emit(pair, 'Swap')
          .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmount, await wallet.getAddress());
      });
    });

    describe('swapTokensForExactTokens', () => {
      const token0Amount = expandTo18Decimals(5);
      const token1Amount = expandTo18Decimals(10);
      const expectedSwapAmount = BigNumber.from('557227237267357629');
      const outputAmount = expandTo18Decimals(1);

      beforeEach(async () => {
        await addLiquidity(token0Amount, token1Amount);
      });

      it('happy path', async () => {
        await token0.approve(router.address, ethers.constants.MaxUint256);
        await expect(
          router.swapTokensForExactTokens(
            outputAmount,
            ethers.constants.MaxUint256,
            [token0.address, token1.address],
            await wallet.getAddress(),
            ethers.constants.MaxUint256,
            overrides,
          ),
        )
          .to.emit(token0, 'Transfer')
          .withArgs(await wallet.getAddress(), pair.address, expectedSwapAmount)
          .to.emit(token1, 'Transfer')
          .withArgs(pair.address, await wallet.getAddress(), outputAmount)
          .to.emit(pair, 'Sync')
          .withArgs(token0Amount.add(expectedSwapAmount), token1Amount.sub(outputAmount))
          .to.emit(pair, 'Swap')
          .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, await wallet.getAddress());
      });
    });

    describe('swapExactETHForTokens', () => {
      const WETHPartnerAmount = expandTo18Decimals(10);
      const ETHAmount = expandTo18Decimals(5);
      const swapAmount = expandTo18Decimals(1);
      const expectedOutputAmount = BigNumber.from('1662497915624478906');

      beforeEach(async () => {
        await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount);
        await WETH.deposit({ value: ETHAmount });
        await WETH.transfer(WETHPair.address, ETHAmount);
        await WETHPair.mint(await wallet.getAddress(), overrides);

        await token0.approve(router.address, ethers.constants.MaxUint256);
      });

      it('happy path', async () => {
        const WETHPairToken0 = await WETHPair.token0();
        await expect(
          router.swapExactETHForTokens(
            0,
            [WETH.address, WETHPartner.address],
            await wallet.getAddress(),
            ethers.constants.MaxUint256,
            {
              ...overrides,
              value: swapAmount,
            },
          ),
        )
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPair.address, swapAmount)
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(WETHPair.address, await wallet.getAddress(), expectedOutputAmount)
          .to.emit(WETHPair, 'Sync')
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerAmount.sub(expectedOutputAmount)
              : ETHAmount.add(swapAmount),
            WETHPairToken0 === WETHPartner.address
              ? ETHAmount.add(swapAmount)
              : WETHPartnerAmount.sub(expectedOutputAmount),
          )
          .to.emit(WETHPair, 'Swap')
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
            WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
            WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
            await wallet.getAddress(),
          );
      });
    });

    describe('swapTokensForExactETH', () => {
      const WETHPartnerAmount = expandTo18Decimals(5);
      const ETHAmount = expandTo18Decimals(10);
      const expectedSwapAmount = BigNumber.from('557227237267357629');
      const outputAmount = expandTo18Decimals(1);

      beforeEach(async () => {
        await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount);
        await WETH.deposit({ value: ETHAmount });
        await WETH.transfer(WETHPair.address, ETHAmount);
        await WETHPair.mint(await wallet.getAddress(), overrides);
      });

      it('happy path', async () => {
        await WETHPartner.approve(router.address, ethers.constants.MaxUint256);
        const WETHPairToken0 = await WETHPair.token0();
        await expect(
          router.swapTokensForExactETH(
            outputAmount,
            ethers.constants.MaxUint256,
            [WETHPartner.address, WETH.address],
            await wallet.getAddress(),
            ethers.constants.MaxUint256,
            overrides,
          ),
        )
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(await wallet.getAddress(), WETHPair.address, expectedSwapAmount)
          .to.emit(WETH, 'Transfer')
          .withArgs(WETHPair.address, router.address, outputAmount)
          .to.emit(WETHPair, 'Sync')
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerAmount.add(expectedSwapAmount)
              : ETHAmount.sub(outputAmount),
            WETHPairToken0 === WETHPartner.address
              ? ETHAmount.sub(outputAmount)
              : WETHPartnerAmount.add(expectedSwapAmount),
          )
          .to.emit(WETHPair, 'Swap')
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
            WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
            WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
            router.address,
          );
      });
    });

    describe('swapExactTokensForETH', () => {
      const WETHPartnerAmount = expandTo18Decimals(5);
      const ETHAmount = expandTo18Decimals(10);
      const swapAmount = expandTo18Decimals(1);
      const expectedOutputAmount = BigNumber.from('1662497915624478906');

      beforeEach(async () => {
        await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount);
        await WETH.deposit({ value: ETHAmount });
        await WETH.transfer(WETHPair.address, ETHAmount);
        await WETHPair.mint(await wallet.getAddress(), overrides);
      });

      it('happy path', async () => {
        await WETHPartner.approve(router.address, ethers.constants.MaxUint256);
        const WETHPairToken0 = await WETHPair.token0();
        await expect(
          router.swapExactTokensForETH(
            swapAmount,
            0,
            [WETHPartner.address, WETH.address],
            await wallet.getAddress(),
            ethers.constants.MaxUint256,
            overrides,
          ),
        )
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(await wallet.getAddress(), WETHPair.address, swapAmount)
          .to.emit(WETH, 'Transfer')
          .withArgs(WETHPair.address, router.address, expectedOutputAmount)
          .to.emit(WETHPair, 'Sync')
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerAmount.add(swapAmount)
              : ETHAmount.sub(expectedOutputAmount),
            WETHPairToken0 === WETHPartner.address
              ? ETHAmount.sub(expectedOutputAmount)
              : WETHPartnerAmount.add(swapAmount),
          )
          .to.emit(WETHPair, 'Swap')
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
            WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
            router.address,
          );
      });
    });

    describe('swapETHForExactTokens', () => {
      const WETHPartnerAmount = expandTo18Decimals(10);
      const ETHAmount = expandTo18Decimals(5);
      const expectedSwapAmount = BigNumber.from('557227237267357629');
      const outputAmount = expandTo18Decimals(1);

      beforeEach(async () => {
        await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount);
        await WETH.deposit({ value: ETHAmount });
        await WETH.transfer(WETHPair.address, ETHAmount);
        await WETHPair.mint(await wallet.getAddress(), overrides);
      });

      it('happy path', async () => {
        const WETHPairToken0 = await WETHPair.token0();
        await expect(
          router.swapETHForExactTokens(
            outputAmount,
            [WETH.address, WETHPartner.address],
            await wallet.getAddress(),
            ethers.constants.MaxUint256,
            {
              ...overrides,
              value: expectedSwapAmount,
            },
          ),
        )
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPair.address, expectedSwapAmount)
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(WETHPair.address, await wallet.getAddress(), outputAmount)
          .to.emit(WETHPair, 'Sync')
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerAmount.sub(outputAmount)
              : ETHAmount.add(expectedSwapAmount),
            WETHPairToken0 === WETHPartner.address
              ? ETHAmount.add(expectedSwapAmount)
              : WETHPartnerAmount.sub(outputAmount),
          )
          .to.emit(WETHPair, 'Swap')
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
            WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
            WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
            await wallet.getAddress(),
          );
      });
    });
  });
});
