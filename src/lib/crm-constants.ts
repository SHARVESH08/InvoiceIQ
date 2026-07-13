// Shared CRM constants — kept out of actions/crm.ts because a 'use server'
// module may only export async functions.

export type DealStage = 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'

// Ordered pipeline stages (kanban columns). won/lost are terminal.
export const DEAL_STAGES: DealStage[] = ['qualified', 'proposal', 'negotiation', 'won', 'lost']
