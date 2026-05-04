import { Module, Global } from '@nestjs/common';
import { LlmRouterService } from './llm-router.service';
import { LlmRouterController } from './llm-router.controller';
import { CostTracker } from './cost/cost-tracker';

// Adapters
import { ProviderAdapterFactory } from './adapters/provider-adapter.factory';

// Production services
import { RouterAdvisorService } from './services/router-advisor.service';
import { RouterGovernorService } from './services/router-governor.service';
import { ModelSelectorService } from './services/model-selector.service';
import { ProviderHealthService } from './services/provider-health.service';
import { UsageLedgerService } from './services/usage-ledger.service';
import { CreditReservationService } from './services/credit-reservation.service';
import { RoutingPolicyService } from './policies/routing-policy.service';

@Global()
@Module({
  controllers: [LlmRouterController],
  providers: [
    // Core
    LlmRouterService,
    CostTracker,
    // Adapter factory
    ProviderAdapterFactory,
    // Production pipeline services
    RouterAdvisorService,
    RouterGovernorService,
    ModelSelectorService,
    ProviderHealthService,
    UsageLedgerService,
    CreditReservationService,
    RoutingPolicyService,
  ],
  exports: [
    LlmRouterService,
    CostTracker,
    RouterAdvisorService,
    ModelSelectorService,
    UsageLedgerService,
    CreditReservationService,
    ProviderAdapterFactory,
    ProviderHealthService,
  ],
})
export class LlmRouterModule {}
