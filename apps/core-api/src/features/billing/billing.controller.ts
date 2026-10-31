import { UserPlan, type CurrentUserDto } from '@hira/contracts';
import { Body, Controller, Inject, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import type { Request } from 'express';
import { AccessTokenGuard, readAuth } from '../auth/access-token.guard';
import { mapAuthError } from '../auth/auth-http';
import { validatedBody } from '../auth/validation-exception';
import { BillingService } from './billing.service';

class PlanBody {
  @ApiProperty({ enum: UserPlan })
  @IsEnum(UserPlan)
  plan!: UserPlan;
}

/** Plan changes. This is a demo: a change is immediate and nothing is charged. */
@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('billing')
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  /** Moves the account to a plan and returns the account as it now is. */
  @Put('plan')
  @ApiOperation({ summary: 'Change the plan' })
  async change(@Body(validatedBody(PlanBody)) body: PlanBody, @Req() request: Request): Promise<CurrentUserDto> {
    try {
      return await this.billing.change(readAuth(request).userId, body.plan);
    } catch (error) {
      const http = mapAuthError(error, request);
      if (http !== null) throw http;
      throw error;
    }
  }
}
