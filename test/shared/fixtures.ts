import { Contract, Signer } from 'ethers';
import { expandTo18Decimals } from './utilities';
import { JioswapRouter02__factory } from '../../typechain/factories/JioswapRouter02__factory';
import { JioswapRouter02 } from '../../typechain/JioswapRouter02';
import { JioswapFactory } from '../../typechain/JioswapFactory';
import { JioswapFactory__factory } from '../../typechain/factories/JioswapFactory__factory';
import { JioswapPair__factory } from '../../typechain/factories/JioswapPair__factory';
import { JioswapPair } from '../../typechain/JioswapPair';
import { Erc20__factory } from '../../typechain/factories/Erc20__factory';
import { RouterEventEmitter__factory } from '../../typechain/factories/RouterEventEmitter__factory';
import { Weth9__factory } from '../../typechain/factories/Weth9__factory';
import { Erc20 } from '../../typechain/Erc20';

const TOTAL_SUPPLY = expandTo18Decimals(10000);

interface FactoryFixture {
  factory: JioswapFactory;
}

interface PairFixture extends FactoryFixture {
  token0: Contract;
  token1: Contract;
  pair: JioswapPair;
}

export interface V2Fixture {
  wallet: Signer;
  other: Signer;
  trader: Signer;
  token0: Erc20;
  token1: Erc20;
  WETH: Contract;
  WETHPartner: Contract;
  factoryV2: JioswapFactory;
  router02: JioswapRouter02;
  routerEventEmitter: Contract;
  router: Contract;
  pair: JioswapPair;
  WETHPair: Contract;
}

const overrides = {
  gasLimit: 9999999,
  gasPrice: 875000000,
};

export async function factoryFixture([wallet]: Signer[]): Promise<FactoryFixture> {
  const factory = await new JioswapFactory__factory(wallet).deploy(await wallet.getAddress(), overrides);
  return { factory };
}

export async function pairFixture(signers: Signer[]): Promise<PairFixture> {
  const wallet = signers[0];
  const { factory } = await factoryFixture(signers);

  const tokenA = await new Erc20__factory(wallet).deploy(TOTAL_SUPPLY, overrides);
  const tokenB = await new Erc20__factory(wallet).deploy(TOTAL_SUPPLY, overrides);

  await factory.createPair(tokenA.address, tokenB.address, overrides);
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address);
  const pair = new JioswapPair__factory(wallet).attach(pairAddress);

  const token0Address = await pair.token0();
  const token0 = tokenA.address === token0Address ? tokenA : tokenB;
  const token1 = tokenA.address === token0Address ? tokenB : tokenA;

  const pairFixture: PairFixture = { factory, token0, token1, pair };
  return pairFixture;
}

export async function v2Fixture(
  signers: Signer[],
  // totalSupply: BigNumberish = expandTo18Decimals(10000),
): Promise<V2Fixture> {
  const wallet = signers[0];
  const other = signers[1];
  const trader = signers[2];
  // deploy tokens
  const tokenA = await new Erc20__factory(wallet).deploy(TOTAL_SUPPLY, overrides);
  const tokenB = await new Erc20__factory(wallet).deploy(TOTAL_SUPPLY, overrides);
  const WETH = await new Weth9__factory(wallet).deploy(overrides);
  const WETHPartner = await new Erc20__factory(wallet).deploy(TOTAL_SUPPLY, overrides);

  // deploy V2
  const { factory } = await factoryFixture([wallet]);

  // deploy routers
  // const router01 = await deployContract(wallet, JioswapRouter01, [factory.address, WETH.address], overrides);
  const routerFactory: JioswapRouter02__factory = new JioswapRouter02__factory(wallet);
  const router02 = await routerFactory.deploy(factory.address, WETH.address, overrides);

  // event emitter for testing
  const routerEventEmitter = await new RouterEventEmitter__factory(wallet).deploy(overrides);

  // initialize V2
  await factory.createPair(tokenA.address, tokenB.address);
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address);
  const pair = new JioswapPair__factory(wallet).attach(pairAddress);

  const token0Address = await pair.token0();
  const token0 = tokenA.address === token0Address ? tokenA : tokenB;
  const token1 = tokenA.address === token0Address ? tokenB : tokenA;

  await factory.createPair(WETH.address, WETHPartner.address);
  const WETHPairAddress = await factory.getPair(WETH.address, WETHPartner.address);
  const WETHPair = await new JioswapPair__factory(wallet).attach(WETHPairAddress); // new Contract(WETHPairAddress, JSON.stringify(IJioswapPair.abi), provider).connect(wallet);

  const v2Fixture: V2Fixture = {
    wallet,
    trader,
    other,
    token0,
    token1,
    WETH,
    WETHPartner,
    factoryV2: factory,
    router02,
    router: router02, // the default router, 01 had a minor bug
    routerEventEmitter,
    pair,
    WETHPair,
  };
  return v2Fixture;
}
