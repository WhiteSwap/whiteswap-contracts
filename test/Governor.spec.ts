import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { keccak256 } from '@ethersproject/keccak256'
import { defaultAbiCoder } from '@ethersproject/abi'
import { expandTo18Decimals, mineBlock, minerStop, minerStart, getDelegateDigest } from './shared/utilities'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'
import { ecsign } from 'ethereumjs-util'

import { GovernanceFixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

const states: Record<string, number> = {
  Pending: 0,
  Active: 1,
  Canceled: 2,
  Defeated: 3,
  Succeeded: 4,
  Queued: 5,
  Expired: 6,
  Executed: 7
}

describe('Governor', async () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    }
  })
  const [wallet, a1, a2] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let govToken: Contract
  let governor: Contract
  let token: Contract
  let timelock: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(GovernanceFixture)
    govToken = fixture.govToken
    token = fixture.token
    governor = fixture.governor
    timelock = fixture.timelock
  })

  describe('GovernorAlpha#state/1', () => {
    let govTokenA1: Contract
    let govA1: Contract
    const targets = [wallet.address]
    const signatures = ['getBalanceOf(address)']
    const values = [expandTo18Decimals(0)]
    const callDatas = [defaultAbiCoder.encode(['address'], [a1.address])]
    let proposalId: BigNumber
    let trivialProposal: any

    beforeEach(async () => {
      await govToken.transfer(a1.address, expandTo18Decimals(40000000))
      govTokenA1 = govToken.connect(a1)
      await govTokenA1.delegate(a1.address)
      govA1 = governor.connect(a1)
      await govA1.propose(targets, values, signatures, callDatas, 'do nothing')
      proposalId = await governor.callStatic.latestProposalIds(a1.address)
      trivialProposal = await governor.callStatic.proposals(proposalId)
    })

    it('Invalid for proposal not found', async () => {
      await expect(governor.state(5)).to.be.revertedWith('GovernorAlpha::state: invalid proposal id')
    })

    it('Pending', async () => {
      expect(await governor.state(trivialProposal.id)).to.eq(states['Pending'])
    })

    it('Active', async () => {
      await mineBlock(provider)
      await mineBlock(provider)
      expect(await governor.state(trivialProposal.id)).to.eq(states['Active'])
    })

    it('Canceled', async () => {
      // send away the delegates
      await govTokenA1.delegate(wallet.address)
      await governor.cancel(proposalId)

      expect(await governor.state(trivialProposal.id)).to.eq(states['Canceled'])
    })

    it('Defeated', async () => {
      await mineBlock(provider)
      await mineBlock(provider, Math.floor(Date.now() / 1000) + 604_801)
      expect(await governor.state(trivialProposal.id)).to.eq(states['Defeated'])
    })

    it('Succeeded', async () => {
      await mineBlock(provider)
      await mineBlock(provider)
      await govA1.castVote(trivialProposal.id, true)
      await mineBlock(provider, Math.floor(Date.now() / 1000) + 604_801)

      expect(await governor.callStatic.state(proposalId)).to.eq(states['Succeeded'])
    })

    it('Queued', async () => {
      await mineBlock(provider)
      await mineBlock(provider)
      await govA1.castVote(trivialProposal.id, true)
      await mineBlock(provider, Math.floor(Date.now() / 1000) + 604_801)

      await governor.queue(proposalId)
      expect(await governor.callStatic.state(proposalId)).to.eq(states['Queued'])
    })

    it('Expired', async () => {
      await mineBlock(provider)
      await mineBlock(provider)
      await govA1.castVote(trivialProposal.id, true)
      await mineBlock(provider, Math.floor(Date.now() / 1000) + 604_801)

      await governor.queue(proposalId)
      expect(await governor.callStatic.state(proposalId)).to.eq(states['Queued'])

      let gracePeriod = await timelock.callStatic.GRACE_PERIOD()
      let proposal = await governor.proposals(proposalId)
      let eta = proposal.eta

      await mineBlock(
        provider,
        eta
          .add(gracePeriod)
          .sub(1)
          .toNumber()
      )
      expect(await governor.callStatic.state(proposalId)).to.eq(states['Queued'])

      await mineBlock(provider, eta.add(gracePeriod).toNumber())
      expect(await governor.callStatic.state(proposalId)).to.eq(states['Expired'])
    })

    it('Executed', async () => {
      await mineBlock(provider)
      await mineBlock(provider)
      await govA1.castVote(trivialProposal.id, true)
      await mineBlock(provider, Math.floor(Date.now() / 1000) + 604_801)

      await governor.queue(proposalId)
      expect(await governor.callStatic.state(proposalId)).to.eq(states['Queued'])

      let gracePeriod = await timelock.callStatic.GRACE_PERIOD()
      let proposal = await governor.proposals(proposalId)
      let eta = proposal.eta

      await mineBlock(
        provider,
        eta
          .add(gracePeriod)
          .sub(1)
          .toNumber()
      )
      await governor.execute(proposalId)

      expect(await governor.callStatic.state(proposalId)).to.eq(states['Executed'])

      // still executed even though would be expired
      await mineBlock(provider, eta.add(gracePeriod).toNumber())
      expect(await governor.callStatic.state(proposalId)).to.eq(states['Executed'])
    })
  })

  describe('GovernorAlpha#queue/1', async () => {
    describe('overlapping actions', () => {
      it('reverts on queueing overlapping actions in same proposal', async () => {
        await govToken.transfer(a1.address, expandTo18Decimals(40000000))
        let govTokenA1 = govToken.connect(a1)
        await govTokenA1.delegate(a1.address)
        let govA1 = governor.connect(a1)

        const targets = [govToken.address, govToken.address]
        const values = [expandTo18Decimals(0), expandTo18Decimals(0)]
        const signatures = ['getBalanceOf(address)', 'getBalanceOf(address)']
        const calldatas = [
          defaultAbiCoder.encode(['address'], [wallet.address]),
          defaultAbiCoder.encode(['address'], [wallet.address])
        ]

        await govA1.propose(targets, values, signatures, calldatas, 'do nothing')
        let proposalId = await governor.callStatic.latestProposalIds(a1.address)
        await mineBlock(provider)
        await mineBlock(provider)

        await govA1.castVote(proposalId, true)
        await mineBlock(provider, Math.floor(Date.now() / 1000) + 604_801)

        await expect(governor.queue(proposalId)).to.be.revertedWith(
          'GovernorAlpha::_queueOrRevert: proposal action already queued at eta'
        )
      })

      it('reverts on queueing overlapping actions in different proposals, works if waiting', async () => {
        let govA1 = governor.connect(a1)
        let govA2 = governor.connect(a2)
        let govTokenA1 = govToken.connect(a1)
        let govTokenA2 = govToken.connect(a2)
        await govToken.transfer(a1.address, expandTo18Decimals(40000000))
        await govToken.transfer(a2.address, expandTo18Decimals(40000000))
        await govTokenA1.delegate(a1.address)
        await govTokenA2.delegate(a2.address)

        const targets = [govToken.address]
        const values = [expandTo18Decimals(0)]
        const signatures = ['getBalanceOf(address)']
        const calldatas = [defaultAbiCoder.encode(['address'], [wallet.address])]

        await govA1.propose(targets, values, signatures, calldatas, 'do nothing')
        await govA2.propose(targets, values, signatures, calldatas, 'do nothing')
        let proposalId1 = governor.latestProposalIds(a1.address)
        let proposalId2 = governor.latestProposalIds(a2.address)
        await mineBlock(provider)
        await mineBlock(provider)

        await govA1.castVote(proposalId1, true)
        await govA2.castVote(proposalId2, true)

        await mineBlock(provider, Math.floor(Date.now() / 1000) + 604_801)

        await governor.queue(proposalId1)
        await expect(governor.queue(proposalId2)).to.be.revertedWith(
          'GovernorAlpha::_queueOrRevert: proposal action already queued at eta'
        )

        await mineBlock(provider, Math.floor(Date.now() / 1000) + 604_810)
        await governor.queue(proposalId2)
      })
    })
  })

  describe('GovernorAlpha#propose/5', async () => {
    let targets: any
    let values: any
    let signatures: any
    let callDatas: any
    let proposalId: BigNumber
    let trivialProposal: any
    let propolsalCreateTimestamp: number
    beforeEach(async () => {
      targets = [wallet.address]
      values = [expandTo18Decimals(0)]
      signatures = ['getBalanceOf(address)']
      callDatas = [defaultAbiCoder.encode(['address'], [a1.address])]
      await govToken.delegate(wallet.address)
      await minerStop(provider)
      await governor.propose(targets, values, signatures, callDatas, 'do nothing')
      propolsalCreateTimestamp = Math.floor(Date.now() / 1000)
      await mineBlock(provider, propolsalCreateTimestamp)
      await minerStart(provider)

      proposalId = await governor.callStatic.latestProposalIds(wallet.address)
      trivialProposal = await governor.proposals(proposalId)
    })

    describe('simple initialization', async () => {
      it('ID is set to a globally unique identifier', async () => {
        expect(trivialProposal.id).to.eq(proposalId)
      })

      it('Proposer is set to the sender', async () => {
        expect(trivialProposal.proposer).to.eq(wallet.address)
      })

      it('End timestamp is set to the current time plus vote period', async () => {
        expect(trivialProposal.endTimestamp).to.eq(propolsalCreateTimestamp + 604800)
      })

      it('ForVotes and AgainstVotes are initialized to zero', async () => {
        expect(trivialProposal.forVotes).to.eq(0)
        expect(trivialProposal.againstVotes).to.eq(0)
      })

      it('Executed and Canceled flags are initialized to false', async () => {
        expect(trivialProposal.canceled).to.eq(false)
        expect(trivialProposal.executed).to.eq(false)
      })

      it('ETA is initialized to zero', async () => {
        expect(trivialProposal.eta).to.eq(0)
      })

      it('Targets, Values, Signatures, Calldatas are set according to parameters', async () => {
        let dynamicFields = await governor.callStatic.getActions(trivialProposal.id)
        expect(dynamicFields[0][0]).to.eq(targets[0])
        expect(dynamicFields[1][0]).to.eq(values[0])
        expect(dynamicFields[2][0]).to.eq(signatures[0])
        expect(dynamicFields[3][0]).to.eq(callDatas[0])
      })

      describe('This function must revert if', async () => {
        it('the length of the values, signatures or calldatas arrays are not the same length,', async () => {
          await expect(
            governor.propose(targets.concat(wallet.address), values, signatures, callDatas, 'do nothing')
          ).to.be.revertedWith('GovernorAlpha::propose: proposal function information arity mismatch')

          await expect(
            governor.propose(targets, values.concat(values), signatures, callDatas, 'do nothing')
          ).to.be.revertedWith('GovernorAlpha::propose: proposal function information arity mismatch')

          await expect(
            governor.propose(targets, values, signatures.concat(signatures), callDatas, 'do nothing')
          ).to.be.revertedWith('GovernorAlpha::propose: proposal function information arity mismatch')

          await expect(
            governor.propose(targets, values, signatures, callDatas.concat(callDatas), 'do nothing')
          ).to.be.revertedWith('GovernorAlpha::propose: proposal function information arity mismatch')
        })

        it('or if that length is zero or greater than Max Operations.', async () => {
          await expect(governor.propose([], [], [], [], 'do nothing')).to.be.revertedWith(
            'GovernorAlpha::propose: must provide actions'
          )
        })

        describe('Additionally, if there exists a pending or active proposal from the same proposer, we must revert.', () => {
          it('reverts with pending', async () => {
            await expect(governor.propose(targets, values, signatures, callDatas, 'do nothing')).to.be.revertedWith(
              'GovernorAlpha::propose: one live proposal per proposer, found an already pending proposal'
            )
          })

          it('reverts with active', async () => {
            await mineBlock(provider)
            await mineBlock(provider)
            await expect(governor.propose(targets, values, signatures, callDatas, 'do nothing')).to.be.revertedWith(
              'GovernorAlpha::propose: one live proposal per proposer, found an already active proposal'
            )
          })
        })
      })
    })

    it('This function returns the id of the newly created proposal. # proposalId(n) = succ(proposalId(n-1))', async () => {
      const govA1 = governor.connect(a1)
      await govToken.transfer(a1.address, expandTo18Decimals(40000000))
      await govToken.delegate(a1.address)

      await mineBlock(provider)
      const nextProposalId = await govA1.callStatic.propose(targets, values, signatures, callDatas, 'yoot')
      expect(nextProposalId).to.eq(parseInt(trivialProposal.id) + 1)
    })

    it('emits log with id and description', async () => {
      const govA1 = governor.connect(a1)
      await govToken.transfer(a1.address, expandTo18Decimals(40000000))
      await govToken.delegate(a1.address)
      await mineBlock(provider)
      const nextProposalId = await govA1.callStatic.propose(targets, values, signatures, callDatas, 'yoot')

      const currentTs = Math.floor(Date.now() / 1000)
      await mineBlock(provider, currentTs)
      await expect(govA1.propose(targets, values, signatures, callDatas, 'second proposal'))
        .to.emit(govA1, 'ProposalCreated')
        .withArgs(
          nextProposalId,
          a1.address,
          targets,
          values,
          signatures,
          callDatas,
          13,
          currentTs + 604800,
          'second proposal'
        )
    })
  })
})
