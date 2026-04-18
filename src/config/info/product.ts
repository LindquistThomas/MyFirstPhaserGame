import { FLOORS } from '../gameConfig';
import { InfoPointDef } from './types';

/** Info points for Product Leadership (floor 3 right) and the Products hall. */
export const INFO_PRODUCT: Record<string, InfoPointDef> = {
  'product-leadership': {
    floorId: FLOORS.BUSINESS,
    content: {
      id: 'product-leadership',
      title: 'Product Leadership',
      body:
        'Product Leadership owns the "what" and the "why": which customer ' +
        'problems to solve, which outcomes to chase, and which trade-offs ' +
        'to make on the roadmap. OKRs, discovery, and prioritisation live ' +
        'on this floor.\n\n' +
        'For an architect, product leadership is the most frequent ' +
        'translation partner. A roadmap commitment is also a set of ' +
        'implicit architectural constraints: time-to-market shapes how ' +
        'much can be built vs bought, scale targets shape data and ' +
        'integration patterns, and reversibility shapes how much ' +
        'optionality the design must preserve.\n\n' +
        'The architect\'s job here is to make the cost of options ' +
        'visible \u2014 so product can choose with eyes open \u2014 and to ' +
        'protect the small set of decisions that are genuinely hard to ' +
        'reverse later.',
    },
  },

  'product-isy-project-controls': {
    floorId: FLOORS.PRODUCTS,
    content: {
      id: 'product-isy-project-controls',
      title: 'ISY Project Controls',
      body:
        'ISY Project Controls helps owners and contractors plan, track, ' +
        'and govern large infrastructure projects. Cost control, schedule ' +
        'integration, change management, and progress reporting all live ' +
        'in one place \u2014 turning fragmented project data into the ' +
        'forecasts and KPIs leadership actually trusts.',
    },
  },

  'product-isy-beskrivelse': {
    floorId: FLOORS.PRODUCTS,
    content: {
      id: 'product-isy-beskrivelse',
      title: 'ISY Beskrivelse',
      body:
        'ISY Beskrivelse is the leading Norwegian tool for writing tender ' +
        'descriptions (beskrivelser) based on NS 3420 and Statens vegvesen ' +
        'standards. It gives engineers a structured catalogue, automatic ' +
        'numbering, and quantity take-offs so a complete description ' +
        'document can be produced \u2014 and updated \u2014 without losing ' +
        'traceability back to the standard.',
    },
  },

  'product-isy-road': {
    floorId: FLOORS.PRODUCTS,
    content: {
      id: 'product-isy-road',
      title: 'ISY Road',
      body:
        'ISY Road is the road-design suite: alignment, terrain modelling, ' +
        'cross-sections, and 3D corridor models for everything from minor ' +
        'upgrades to motorway projects. It hands off clean models to ' +
        'machine control and to ISY Beskrivelse for quantities, closing ' +
        'the loop between design intent and tender documentation.',
    },
  },

  'product-admin-lisens': {
    floorId: FLOORS.PRODUCTS,
    content: {
      id: 'product-admin-lisens',
      title: 'Admin & Lisens',
      body:
        'Admin & Lisens is the back-office for the entire ISY portfolio: ' +
        'customer accounts, user provisioning, license assignment, and ' +
        'entitlement enforcement across products. From an architect\'s ' +
        'perspective it\'s the cross-cutting platform every product ' +
        'depends on \u2014 the place where identity, billing, and ' +
        'authorisation are unified so individual products don\'t each ' +
        'reinvent them.',
    },
  },
};
