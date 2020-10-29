import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { AddressZero, Zero, MaxUint256 } from '@ethersproject/constants'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'
import { pack as solidityPack } from '@ethersproject/solidity'
import { keccak256 } from '@ethersproject/keccak256'
import { toUtf8Bytes } from '@ethersproject/strings'

import { expandTo18Decimals, getApprovalDigest, mineBlock, MINIMUM_LIQUIDITY } from './shared/utilities'
import { Fixture } from './shared/fixtures'
import IWSProxy from '../build/IWSProxy.json'
import IWSUpdate from '../build/IWSUpdate.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

const FACTORY_TYPE = 1
const PAIR_TYPE = 2
const ROUTER_TYPE = 3
const ADMIN_UPDATE = 999
const UPDATE_ID = 360894

describe('WSController', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    }
  })
  const [wallet, otherWallet] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let router: Contract
  let pair: Contract
  let controller: Contract
  let pairLogic: Contract
  let updateContract: Contract
  let updatePairContract: Contract
  beforeEach(async function() {
    const fixture = await loadFixture(Fixture)
    router = fixture.router
    pair = fixture.pair
    controller = fixture.controller
    pairLogic = fixture.pairLogic
    updatePairContract = fixture.updatePairContract
  })

  it('fixtures', async () => {
    expect(await controller.getCurrentAdmin()).to.eq(controller.address)
    expect(await controller.getLogicForPair()).to.eq(pairLogic.address)
  })

  it('update admin', async () => {
    const controllerOtherSigner = controller.connect(otherWallet)
    await expect(controllerOtherSigner.updateCurrentAdmin(wallet.address, overrides)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    )
    expect(await controller.getCurrentAdmin()).to.eq(controller.address)
    await expect(controller.updateCurrentAdmin(wallet.address))
      .to.emit(controller, 'NewAdmin')
      .withArgs(wallet.address)
    expect(await controller.getCurrentAdmin()).to.eq(wallet.address)

    await controllerOtherSigner.setAdminForProxy(router.address, overrides)
    let routerProxy = new Contract(router.address, JSON.stringify(IWSProxy.abi), provider).connect(wallet)
    expect(await routerProxy.callStatic.admin()).to.eq(wallet.address)
  })

  it('update pair proxy', async () => {
    const controllerOtherSigner = controller.connect(otherWallet)
    await expect(controllerOtherSigner.updatePairLogic(updatePairContract.address, overrides)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    )

    await expect(controller.updatePairLogic(updatePairContract.address))
      .to.emit(controller, 'NewPairLogic')
      .withArgs(updatePairContract.address)

    expect(await controller.getLogicForPair()).to.eq(updatePairContract.address)
    await expect(controller.updateProxyPair(pair.address))
      .to.emit(controller, 'UpdateProxy')
      .withArgs(pair.address, updatePairContract.address)

    let updatedContract = new Contract(pair.address, JSON.stringify(IWSUpdate.abi), provider).connect(wallet)
    expect(await updatedContract.callStatic.isUpdated(overrides)).to.eq(UPDATE_ID)
  })
})
