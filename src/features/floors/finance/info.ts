import { FLOORS } from '../../../config/gameConfig';
import { InfoPointDef } from '../../../config/info/types';

/** Info points shown in the Finance room (accessed via a door in the Executive Suite). */
export const INFO_FINANCE: Record<string, InfoPointDef> = {
  'finance': {
    floorId: FLOORS.EXECUTIVE,
    content: {
      id: 'finance',
      title: 'Finance',
      body:
        'The Finance team owns the money: budgets, forecasts, capital ' +
        'allocation, unit economics, and the runway that funds every ' +
        'engineering hour. They translate technical effort into cost and ' +
        'expected return.\n\n' +
        'For an architect, finance is the floor where build-vs-buy ' +
        'decisions, cloud bill optimisation, and total cost of ownership ' +
        'are evaluated. A reliability investment that prevents a single ' +
        'outage may be cheaper than a year of incident response \u2014 but ' +
        'only finance can frame that trade-off in the language the ' +
        'business actually uses.\n\n' +
        'Riding down from this floor, the architect carries cost ' +
        'constraints into design. Riding up, they carry the financial ' +
        'impact of architectural choices \u2014 latency that loses sales, ' +
        'rewrites that delay revenue, platforms that compound savings.',
    },
  },
};
