import { ethers, Event } from "ethers"

import { PrismaClient } from "@prisma/client"
import { getNetworkName } from "../utils/helpers"
import { Bridge } from "@chainsafe/chainbridge-contracts"
import { ChainbridgeConfig, EvmBridgeConfig } from "../chainbridgeTypes"

const prisma = new PrismaClient()

export async function pollProposals(
  bridge: EvmBridgeConfig,
  bridgeContract: Bridge,
  provider: ethers.providers.JsonRpcProvider,
  config: ChainbridgeConfig
) {
  const proposalEventFilter = bridgeContract.filters.ProposalEvent(
    null,
    null,
    null,
    null,
    null
  )

  bridgeContract.on(
    proposalEventFilter,
    async(
      originDomainId: number,
      depositNonce: ethers.BigNumber,
      status: number,
      resourceId: string,
      dataHash: string,
      tx: Event
    ) => {
      const eventTransaction = await provider.getTransaction(tx.transactionHash)
      const { from: transactionSenderAddress } = eventTransaction
      console.log("🚀 ~ file: pollProposals.ts ~ line 34 ~ tx", tx)
      await prisma.proposalEvent.create({
        data: {
          proposalEventBlockNumber: tx.blockNumber,
          proposalEventTransactionHash: tx.transactionHash,
          dataHash: dataHash,
          timestamp: (await provider.getBlock(tx.blockNumber))
            .timestamp,
          proposalStatus: status,
          by: transactionSenderAddress,
          transfer: {
            connectOrCreate: {
              where: {
                depositNonce: depositNonce.toNumber()
              },
              create: {
                depositNonce: depositNonce.toNumber(),
                resourceId: resourceId,
                fromDomainId: originDomainId,
                fromNetworkName: getNetworkName(originDomainId, config),
                toDomainId: bridge.domainId,
                toNetworkName: bridge.name,
              }
            }
          }
        }
      })
    })

  console.log(
    `Bridge on ${bridge.name} listen for proposal events`
  )
}
