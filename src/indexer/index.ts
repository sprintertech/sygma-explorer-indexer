import nodeCleanup from "node-cleanup"
import { logger } from "../utils/logger"
import { SubstrateIndexer } from "./services/substrateIndexer/substrateIndexer"
import { EvmIndexer } from "./services/evmIndexer/evmIndexer"
import { getSharedConfig, DomainTypes, Domain, getSsmDomainConfig, getDomainsToIndex, SubstrateResource } from "./config"
import DomainRepository from "./repository/domain"
import DepositRepository from "./repository/deposit"
import TransferRepository from "./repository/transfer"
import ExecutionRepository from "./repository/execution"
import FeeRepository from "./repository/fee"
import ResourceRepository from "./repository/resource"
import { healthcheckRoute } from "./healthcheck"
import { OfacComplianceService } from "./services/evmIndexer/ofac"
import AccountRepository from "./repository/account"

interface DomainIndexer {
  listenToEvents(): Promise<void>
  stop(): void
}

init()
  .then(domainIndexers => {
    nodeCleanup(function () {
      for (const indexer of domainIndexers) {
        indexer.stop()
        nodeCleanup.uninstall()
        return false
      }
    })

    for (const domainIndexer of domainIndexers) {
      domainIndexer.listenToEvents().catch(reason => {
        logger.error("Failed listening to events because of: ", reason)
      })
    }
  })
  .catch(reason => {
    logger.error("Failed to initialize app because of: ", reason)
  })

async function init(): Promise<Array<DomainIndexer>> {
  const sharedConfig = await getSharedConfig(process.env.SHARED_CONFIG_URL!)
  const ofacComplianceService = new OfacComplianceService(process.env.CHAIN_ANALYSIS_URL, process.env.CHAIN_ANALYSIS_API_KEY)

  const domainRepository = new DomainRepository()
  const depositRepository = new DepositRepository()
  const transferRepository = new TransferRepository()
  const executionRepository = new ExecutionRepository()
  const feeRepository = new FeeRepository()
  const resourceRepository = new ResourceRepository()
  const accountRepository = new AccountRepository()

  healthcheckRoute()
  const resourceMap = await insertDomains(sharedConfig.domains, resourceRepository, domainRepository)

  const rpcUrlConfig = getSsmDomainConfig()

  const domainsToIndex = getDomainsToIndex(sharedConfig.domains)
  const domainIndexers: Array<DomainIndexer> = []
  for (const domain of domainsToIndex) {
    const rpcURL = rpcUrlConfig.get(domain.id)
    if (!rpcURL) {
      logger.error(`local domain is not defined for the domain: ${domain.id}`)
      continue
    }

    if (domain.type == DomainTypes.SUBSTRATE) {
      try {
        const substrateIndexer = new SubstrateIndexer(
          domainRepository,
          domain,
          executionRepository,
          depositRepository,
          transferRepository,
          feeRepository,
          resourceMap,
          accountRepository,
        )
        await substrateIndexer.init(rpcURL)
        domainIndexers.push(substrateIndexer)
      } catch (err) {
        logger.error(`error on domain: ${domain.id}... skipping`)
        continue
      }
    } else if (domain.type == DomainTypes.EVM) {
      try {
        const evmIndexer = new EvmIndexer(
          domain,
          rpcURL,
          domainsToIndex,
          domainRepository,
          depositRepository,
          transferRepository,
          executionRepository,
          feeRepository,
          ofacComplianceService,
          accountRepository,
        )
        domainIndexers.push(evmIndexer)
      } catch (err) {
        logger.error(`error on domain: ${domain.id}... skipping`)
        continue
      }
    } else {
      logger.error(`unsuported type: ${JSON.stringify(domain)}`)
    }
  }

  return domainIndexers
}

async function insertDomains(
  domains: Array<Domain>,
  resourceRepository: ResourceRepository,
  domainRepository: DomainRepository,
): Promise<Map<string, SubstrateResource>> {
  const resourceMap = new Map<string, SubstrateResource>()
  for (const domain of domains) {
    await domainRepository.insertDomain(domain.id, domain.startBlock.toString(), domain.name)
    for (const resource of domain.resources) {
      if (domain.type == DomainTypes.SUBSTRATE) {
        resourceMap.set(resource.resourceId, resource as SubstrateResource)
      }
      await resourceRepository.insertResource({ id: resource.resourceId, type: resource.type })
    }
  }
  return resourceMap
}
