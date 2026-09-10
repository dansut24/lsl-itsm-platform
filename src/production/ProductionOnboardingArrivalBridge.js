export const ONBOARDING_ARRIVAL_KEY = 'hi5central-onboarding-arrival-v1'

export function markOnboardingArrival() {
  try {
    window.sessionStorage.setItem(ONBOARDING_ARRIVAL_KEY, 'ready')
  } catch {
    // The welcome handoff is visual only; onboarding completion must never fail.
  }
}
