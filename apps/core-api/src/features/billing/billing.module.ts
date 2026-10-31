import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

/** Plan changes. The plan check itself lives in `AuthModule`, beside the account it reads. */
@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
