export const CURRENT_CHECKOUT_POLICY_VERSION = '2026-09-03' as const;

export type CheckoutPolicyAcceptance = {
  policyAccepted: boolean;
  policyVersion: string;
};

export function checkoutPolicyAcceptanceIssue(acceptance: CheckoutPolicyAcceptance): string | null {
  if (acceptance.policyAccepted !== true) {
    return 'Accept the Privacy, Terms, Returns, and Content policies before checkout.';
  }
  if (acceptance.policyVersion !== CURRENT_CHECKOUT_POLICY_VERSION) {
    return 'The checkout policies have changed. Review and accept the current policies.';
  }
  return null;
}
