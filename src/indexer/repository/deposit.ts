import { Deposit, PrismaClient } from "@prisma/client"

class DepositRepository {
  public prismaClient = new PrismaClient()
  public deposit = this.prismaClient.deposit

  public async insertDeposit(deposit: Deposit): Promise<void> {
    await this.deposit.create({ data: deposit })
  }
}
export default DepositRepository
