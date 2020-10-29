import { Contract, Wallet, BigNumber } from 'ethers'
import { Web3Provider } from '@ethersproject/providers'

import { keccak256 } from '@ethersproject/keccak256'
import { MaxUint256 } from '@ethersproject/constants'
import { defaultAbiCoder } from '@ethersproject/abi'
import { toUtf8Bytes } from '@ethersproject/strings'
import { pack as solidityPack } from '@ethersproject/solidity'
import { getAddress } from '@ethersproject/address'

import IWSProxy from '../../build/IWSProxy.json'

export const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(3)

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

const DELEGATE_TYPEHASH = keccak256(
  toUtf8Bytes('Delegation(address delegatee,uint256 nonce,uint256 expiry)')
)

export const REWARDS_DURATION = 60 * 60 * 24 * 60

export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

export function getProxyInterface(address: string, wallet: Wallet, provider: Web3Provider): Contract {
  return new Contract(address, JSON.stringify(IWSProxy.abi), provider).connect(wallet)
}

export function expandTo18Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

function getDomainSeparator(name: string, tokenAddress: string) {
  return keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes('1')),
        1,
        tokenAddress
      ]
    )
  )
}

function getDomainSeparatorNoVersion(name: string, tokenAddress: string) {
  return keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(toUtf8Bytes('EIP712Domain(string name,uint256 chainId,address verifyingContract)')),
        keccak256(toUtf8Bytes(name)),
        1,
        tokenAddress
      ]
    )
  )
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
  const create2Inputs = [
    '0xff',
    factoryAddress,
    keccak256(solidityPack(['address', 'address'], [token0, token1])),
    keccak256(bytecode)
  ]
  const sanitizedInputs = `0x${create2Inputs.map(i => i.slice(2)).join('')}`
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`)
}

export async function getApprovalDigest(
  token: Contract,
  approve: {
    owner: string
    spender: string
    value: BigNumber
  },
  nonce: BigNumber,
  deadline: BigNumber
): Promise<string> {
  const name = await token.name()
  const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address)
  return keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        )
      ]
    )
  )
}

export async function getDelegateDigest(
  token:Contract,
  delegate: {
    delegatee: string,
    expiry: BigNumber
  },
  nonce: BigNumber
  ): Promise<string> {
  const name = await token.name()
  const DOMAIN_SEPARATOR = getDomainSeparatorNoVersion(name, token.address)
  return keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ['bytes32', 'address', 'uint256', 'uint256'],
            [DELEGATE_TYPEHASH, delegate.delegatee, nonce, delegate.expiry ]
          )
        )
      ]
    )
  )
}

export async function mineBlock(provider: Web3Provider, timestamp: number = -1): Promise<void> {
  if (timestamp < 0) {
    timestamp = getCurrentTimestamp()
  }
  await new Promise(async (resolve, reject) => {
    ;(provider.provider.sendAsync as any)(
      { jsonrpc: '2.0', method: 'evm_mine', params: [timestamp] },
      (error: any, result: any): void => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      }
    )
  })
}

export function encodePrice(reserve0: BigNumber, reserve1: BigNumber) {
  return [reserve1.mul(BigNumber.from(2).pow(112)).div(reserve0), reserve0.mul(BigNumber.from(2).pow(112)).div(reserve1)]
}

export async function minerStop(provider: Web3Provider): Promise<void> {
  await new Promise(async (resolve, reject) => {
    ;(provider.provider.sendAsync as any)(
      { jsonrpc: '2.0', method: 'miner_stop'},
      (error: any, result: any): void => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      }
    )
  })
}

export async function minerStart(provider: Web3Provider): Promise<void> {
  await new Promise(async (resolve, reject) => {
    ;(provider.provider.sendAsync as any)(
      { jsonrpc: '2.0', method: 'miner_start'},
      (error: any, result: any): void => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      }
    )
  })
}