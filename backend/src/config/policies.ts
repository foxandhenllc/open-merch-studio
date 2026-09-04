import { merchantConfig } from '../generated/merchant-config.js';
import { policyApproval } from '../generated/policy-approval.js';
import { env } from './env.js';

export const CURRENT_CHECKOUT_POLICY_VERSION = merchantConfig.policies.approvedVersion;

export type CheckoutPolicyAcceptance = {
  policyAccepted: boolean;
  policyVersion: string;
};

export function checkoutPolicyAcceptanceIssue(acceptance: CheckoutPolicyAcceptance): string | null {
  if (
    String(policyApproval.purpose) === 'fixture-only' &&
    (env.enableLiveStripe ||
      env.allowLivePayments ||
      env.enableLivePrintful ||
      env.allowLiveFulfillment)
  ) {
    return 'Fixture policy content cannot authorize live commerce.';
  }
  if (acceptance.policyAccepted !== true) {
    return 'Accept the Privacy, Terms, Returns, and Content policies before checkout.';
  }
  if (acceptance.policyVersion !== CURRENT_CHECKOUT_POLICY_VERSION) {
    return 'The checkout policies have changed. Review and accept the current policies.';
  }
  return null;
}
