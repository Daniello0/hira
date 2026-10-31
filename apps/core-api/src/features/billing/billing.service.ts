import type { CurrentUserDto, UserPlan } from '@hira/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../auth/auth.errors';
import { AuthService } from '../auth/auth.service';
import { USER_STORE, type UserStore } from '../auth/user.store';

/** The only writer of `users.plan`. */
@Injectable()
export class BillingService {
  constructor(
    @Inject(USER_STORE) private readonly users: UserStore,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  /** Changes the plan at once. Saved data stays when the new plan is smaller. */
  async change(userId: string, plan: UserPlan): Promise<CurrentUserDto> {
    if (!(await this.users.setPlan(userId, plan))) throw new UnauthorizedError();
    return this.auth.me(userId);
  }
}
