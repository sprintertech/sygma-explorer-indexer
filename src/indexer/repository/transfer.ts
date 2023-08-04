import { PrismaClient, Transfer, TransferStatus } from "@prisma/client"
import { ObjectId } from "mongodb"
import { DecodedDepositLog, DecodedFailedHandlerExecution, DecodedProposalExecutionLog } from "../services/evmIndexer/evmTypes"

export type TransferMetadataeta = {
  id: string
  depositNonce: number
  sender: string
  amount: string
  destination: string
  fromDomainId: string
  toDomainId: string
  resourceID: string

  resource: {
    connect: {
      id: string
    }
  }
  fromDomain: {
    connect: {
      id: string
    }
  }
  toDomain: {
    connect: {
      id: string
    }
  }
}
class TransferRepository {
  public transfer = new PrismaClient().transfer

  public async insertDepositTransfer(decodedLog: DecodedDepositLog, addressStatus: string): Promise<Transfer> {
    const transferData = {
      id: new ObjectId().toString(),
      depositNonce: decodedLog.depositNonce,
      amount: decodedLog.amount,
      destination: decodedLog.destination,
      status: TransferStatus.pending,
      resource: {
        connect: {
          id: decodedLog.resourceID,
        },
      },
      fromDomain: {
        connect: {
          id: Number(decodedLog.fromDomainId),
        },
      },
      toDomain: {
        connect: {
          id: Number(decodedLog.toDomainId),
        },
      },
      timestamp: new Date(decodedLog.timestamp * 1000), // this is only being used by evm service
      account: {
        create: {
          id: new ObjectId().toString(),
          address: decodedLog.sender,
          addressStatus,
        }
      }
    }
    return await this.transfer.create({ data: transferData })
  }

  public async insertSubstrateDepositTransfer(
    substrateDepositData: Pick<
      DecodedDepositLog,
      "depositNonce" | "sender" | "amount" | "destination" | "resourceID" | "toDomainId" | "fromDomainId" | "timestamp"
    >,
  ): Promise<Transfer> {
    const transferData = {
      id: new ObjectId().toString(),
      depositNonce: substrateDepositData.depositNonce,
      sender: substrateDepositData.sender,
      amount: substrateDepositData.amount,
      destination: substrateDepositData.destination,
      status: TransferStatus.pending,
      resource: {
        connect: {
          id: substrateDepositData.resourceID,
        },
      },
      fromDomain: {
        connect: {
          id: Number(substrateDepositData.fromDomainId),
        },
      },
      toDomain: {
        connect: {
          id: Number(substrateDepositData.toDomainId),
        },
      },
      timestamp: new Date(substrateDepositData.timestamp),
    }

    return await this.transfer.create({ data: transferData })
  }

  public async insertExecutionTransfer(
    {
      depositNonce,
      fromDomainId,
      timestamp,
      resourceID,
    }: Pick<DecodedProposalExecutionLog, "depositNonce" | "fromDomainId" | "timestamp" | "resourceID">,
    toDomainId: number,
  ): Promise<Transfer> {
    const transferData = {
      id: new ObjectId().toString(),
      depositNonce: depositNonce,
      status: TransferStatus.executed,
      destination: null,
      amount: null,
      resource: resourceID !== null ? resourceID : undefined,
      toDomainId: undefined,
      fromDomain: {
        connect: {
          id: Number(fromDomainId),
        },
      },
      toDomain: {
        connect: {
          id: toDomainId,
        },
      },
      timestamp: new Date(timestamp),
    } as unknown as Transfer

    return await this.transfer.create({ data: transferData })
  }

  public async insertFailedTransfer(
    { depositNonce, domainId }: Pick<DecodedFailedHandlerExecution, "depositNonce" | "domainId">,
    toDomainId: number,
  ): Promise<Transfer> {
    const transferData = {
      id: new ObjectId().toString(),
      depositNonce: depositNonce,
      fromDomain: {
        connect: {
          id: Number(domainId),
        },
      },
      toDomain: {
        connect: {
          id: toDomainId,
        },
      },
      status: TransferStatus.failed,
    }
    return await this.transfer.create({ data: transferData })
  }

  public async updateTransfer(
    {
      depositNonce,
      sender,
      amount,
      destination,
      resourceID,
      fromDomainId,
      toDomainId,
      timestamp,
      accountId
    }: Pick<DecodedDepositLog, "depositNonce" | "sender" | "amount" | "destination" | "resourceID" | "fromDomainId" | "toDomainId" | "timestamp" | "accountId">,
    id: string,
  ): Promise<Transfer> {
    const transferData = {
      depositNonce: depositNonce,
      sender: sender,
      amount: amount,
      destination: destination,
      resource: {
        connect: {
          id: resourceID,
        },
      },
      fromDomain: {
        connect: {
          id: Number(fromDomainId),
        },
      },
      toDomain: {
        connect: {
          id: Number(toDomainId),
        },
      },
      timestamp: new Date(timestamp),
      account: {
        connect: {
          id: accountId
        }
      }
    }
    return await this.transfer.update({ where: { id: id }, data: transferData })
  }

  public async findTransfer(nonce: number, fromDomainId: number, toDomainId: number): Promise<Transfer | null> {
    return await this.transfer.findFirst({
      where: {
        depositNonce: nonce,
        fromDomainId: fromDomainId,
        toDomainId: toDomainId,
      },
    })
  }

  public async updateStatus(status: TransferStatus, id: string): Promise<Transfer> {
    return await this.transfer.update({
      where: {
        id: id,
      },
      data: {
        status: status,
      },
    })
  }
}

export default TransferRepository
