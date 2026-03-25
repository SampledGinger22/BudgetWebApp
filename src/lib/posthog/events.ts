/**
 * PostHog event name constants — prevents magic strings across the app.
 *
 * Usage:
 *   import { EVENTS } from '@/lib/posthog/events'
 *   posthog.capture(EVENTS.DASHBOARD_INTERACTION, { action: 'click_account' })
 */
export const EVENTS = {
  /** Automatic page view (sent by PostHogPageView component) */
  PAGE_VIEW: 'page_view',
  /** Dashboard A/B test conversion — user takes a meaningful action on the dashboard */
  DASHBOARD_INTERACTION: 'dashboard_interaction',
  /** Dashboard CTA clicked — specific call-to-action tracking */
  DASHBOARD_CTA_CLICKED: 'dashboard_cta_clicked',
} as const

/** Feature flag key constants */
export const FLAGS = {
  /** Dashboard layout A/B test: 'control' | 'test' */
  DASHBOARD_LAYOUT: 'dashboard-layout',
} as const
