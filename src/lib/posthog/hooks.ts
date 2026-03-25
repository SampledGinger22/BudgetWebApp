/**
 * PostHog hooks — single import path for all PostHog client hooks and components.
 *
 * Re-exports from @posthog/next so app code never imports the SDK directly.
 * Add typed wrappers here when needed (e.g. feature flag key literals).
 */
export { useFeatureFlag, usePostHog, PostHogFeature } from '@posthog/next'
