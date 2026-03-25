export const centsToDollars = (cents: number): number => cents / 100
export const dollarsToCents = (dollars: number): number => Math.round(dollars * 100)
export const formatCurrency = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
