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

  /**
   * Parody microtransaction kiosk.
   *
   * The visible body is in-character dark-pattern satire — loot boxes,
   * FOMO timers, fake scarcity, NOK\u2192AU "offers". The extendedInfo is
   * the real payoff: why actual production apps never build a card form
   * themselves (PCI-DSS scope, PSD2/SCA, tokenization, hosted payment
   * pages, PSPs). Deliberately contains no fields that look like a real
   * card entry \u2014 it is prose on a signboard, not a form.
   */
  'microtransaction-kiosk': {
    floorId: FLOORS.EXECUTIVE,
    content: {
      id: 'microtransaction-kiosk',
      title: 'AU MegaMart\u2122  \u2014  LIMITED TIME!!!1!',
      body:
        '\u2728 WELCOME, VALUED ARCHITECT \u2728\n' +
        'Why grind AU from tokens when you can BUY THEM NOW?\n\n' +
        'TODAY\'S MEGA DEALS (offer ends in 00:04:59\u2026 now 00:04:58\u2026):\n' +
        '  \u2022 Starter Pouch \u2014 1 AU for 99 NOK\n' +
        '  \u2022 Architect Bundle \u2014 5 AU for 499 NOK (best value!)\n' +
        '  \u2022 Penthouse Pass \u2014 25 AU for 1,999 NOK (LIMITED!!)\n' +
        '  \u2022 Mystery Loot Crate \u2014 99 NOK, contains 0\u201350 AU*\n\n' +
        '* Average drop: 0.3 AU. Odds not shown. Not a gambling product \u2014 ' +
        'a thrilling investment in your career!\n\n' +
        'ONE-CLICK BUY is pre-selected. The small grey "No thanks" link ' +
        'down there is definitely not hidden on purpose. Your "Continue" ' +
        'button subscribes you to the AU-of-the-Month Club\u2122 (cancel ' +
        'anytime \u2014 by calling during business hours on a Tuesday).\n\n' +
        'Don\'t miss out! 14 other architects are looking at this right ' +
        'now. (Source: we made that up.)\n\n' +
        '\u2014\n' +
        'Kiosk is for laughs. No real card fields exist \u2014 and in a real ' +
        'product, they shouldn\'t exist in your app either. Press \u2192 ' +
        'for the architecture reason why.',
      extendedInfo: {
        title: 'Why card data doesn\'t belong in your app',
        body:
          'The gag on the signboard is fun; the architecture lesson is ' +
          'serious. If your application ever collects a Primary Account ' +
          'Number (PAN), expiry, or CVV directly, you have just dragged ' +
          'your entire stack into PCI-DSS scope \u2014 every server, ' +
          'container, log aggregator, backup, and developer laptop that ' +
          'touches that data.\n\n' +
          'The modern pattern is to never let card data hit your systems ' +
          'in the first place:\n\n' +
          '  \u2022 A Payment Service Provider (PSP) \u2014 Stripe, Adyen, ' +
          'Nets, Vipps MobilePay, etc. \u2014 hosts the card entry in a ' +
          'PSP-controlled iframe, hosted page, or native SDK. The card ' +
          'number bypasses your servers entirely.\n' +
          '  \u2022 The PSP returns a token (e.g. a Stripe PaymentMethod ' +
          'id). Your app stores the token, not the card. Tokens are ' +
          'useless to attackers and out of PCI scope.\n' +
          '  \u2022 You NEVER store the CVV. PCI-DSS forbids it after ' +
          'authorisation, full stop.\n' +
          '  \u2022 In the EU/EEA, PSD2 Strong Customer Authentication ' +
          '(SCA) requires two-factor confirmation on most card payments. ' +
          'The PSP orchestrates 3-D Secure; you just pass the intent ' +
          'through.\n' +
          '  \u2022 For wallets like Vipps / Apple Pay / Google Pay the ' +
          'user\'s device provides a network token; again, no PAN reaches ' +
          'you.\n\n' +
          'Architect\'s takeaway: treat card data like toxic waste. The ' +
          'cheapest way to be PCI-compliant is to not be in scope. Push ' +
          'the collection surface to a partner who has already built the ' +
          'vault, the SAQ, and the incident-response apparatus. Your job ' +
          'is to hold a token and a receipt.\n\n' +
          'And every dark-pattern bullet on the kiosk above \u2014 fake ' +
          'countdowns, pre-ticked upsells, hidden opt-outs, misleading ' +
          'scarcity \u2014 is increasingly regulated (EU Digital Services ' +
          'Act, consumer protection law, Norwegian markedsf\u00f8ringsloven). ' +
          '"It converts better" is not a defensible architecture reason.',
      },
      links: [
        { label: 'PCI-DSS v4.0 overview (PCI SSC)', url: 'https://www.pcisecuritystandards.org/document_library/' },
        { label: 'PSD2 Strong Customer Authentication (EBA)', url: 'https://www.eba.europa.eu/regulation-and-policy/payment-services-and-electronic-money' },
        { label: 'Stripe: why tokenize cards', url: 'https://stripe.com/docs/security/guide' },
        { label: 'EU guidance on dark patterns', url: 'https://commission.europa.eu/law/law-topic/consumer-protection-law/unfair-commercial-practices-law/unfair-commercial-practices-directive_en' },
      ],
    },
  },
};
