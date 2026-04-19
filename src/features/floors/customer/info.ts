import { FLOORS } from '../../../config/gameConfig';
import { InfoPointDef } from '../../../config/info/types';

/** Info points for the Customer Success room (floor 3 right). */
export const INFO_CUSTOMER: Record<string, InfoPointDef> = {
  'customer-success': {
    floorId: FLOORS.BUSINESS,
    content: {
      id: 'customer-success',
      title: 'Customer Success',
      body:
        'Customer Success owns the relationship after the sale: ' +
        'onboarding, adoption, SLAs, renewals, and the quiet work of ' +
        'turning a signed contract into a customer who actually gets ' +
        'value. Churn, NPS, support tickets, and escalations all surface ' +
        'on this floor \u2014 it is where the product\'s promises meet ' +
        'reality.\n\n' +
        'For an architect, Customer Success is a feedback loop the design ' +
        'cannot afford to ignore. The tickets they handle are leading ' +
        'indicators: confusing error messages hint at missing ' +
        'observability, repeated integration pain hints at brittle APIs, ' +
        'and recurring outages expose where reliability investment is ' +
        'actually needed. Patterns in support volume are cheaper ' +
        'requirements than any roadmap workshop.\n\n' +
        'The architect\'s job here is to make the system legible and ' +
        'recoverable: clear error contracts, versioned APIs with escape ' +
        'hatches, per-customer observability, and error budgets that let ' +
        'the team say "no" to work that would burn trust. Every support ' +
        'escalation is a tax on the architecture \u2014 designs that ' +
        'reduce that tax compound for years.',
    },
  },
};
