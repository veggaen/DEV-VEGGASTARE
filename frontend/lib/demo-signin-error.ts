/** @fileOverview Public, non-identifying demo refusal codes. @stability stable */
import { CredentialsSignin } from 'next-auth';

export class DemoSigninError extends CredentialsSignin {
  constructor(code: 'demo_retry_later' | 'demo_daily_limit' | 'demo_capacity') {
    super();
    this.code = code;
  }
}
