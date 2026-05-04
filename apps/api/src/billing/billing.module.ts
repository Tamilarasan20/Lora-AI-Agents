import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { CreditService } from './credit.service';
import { CreditResetService } from './credit-reset.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BillingController],
  providers: [BillingService, CreditService, CreditResetService],
  exports: [BillingService, CreditService, CreditResetService],
})
export class BillingModule {}
