import { FLOORS } from '../../../config/gameConfig';
import { InfoPointDef } from '../../../config/info/types';

/** Info points shown in the Executive Suite (penthouse). */
export const INFO_EXEC: Record<string, InfoPointDef> = {
  'executive-suite': {
    floorId: FLOORS.EXECUTIVE,
    content: {
      id: 'executive-suite',
      title: 'The Executive Suite (Penthouse)',
      body:
        'You\u2019ve reached the top of the elevator \u2014 the penthouse. ' +
        'This is where business strategy, organizational structure, and ' +
        'long-term vision are set. C-suite executives, product leadership, ' +
        'and the board operate here.\n\n' +
        'Architects who only ride down from this floor risk producing ' +
        '"PowerPoint architecture" \u2014 designs disconnected from the ' +
        'engine room. Architects who never visit lose strategic context.\n\n' +
        'The job is to translate: turn business outcomes into technical ' +
        'direction on the way down, and turn technical reality into ' +
        'business impact on the way up. The elevator only delivers value ' +
        'when it actually rides between floors.',
      links: [
        { label: 'The Software Architect Elevator (Book)', url: 'https://architectelevator.com/book/' },
      ],
    },
  },
  'exec-geir-harald': {
    floorId: FLOORS.EXECUTIVE,
    content: {
      id: 'exec-geir-harald',
      title: 'Geir Harald \u2014 OKRs',
      body:
        'OKR 1: STRENGTHEN MARKET AND CUSTOMER FOCUS TO DRIVE PROFITABLE GROWTH\n' +
        'Key Enabler: Sales & Marketing Plan\n' +
        'Key Results:\n' +
        '  \u2022 Increase NPS-score: +15 (2025: -23)\n' +
        '  \u2022 2027 ARR run-rate: 298 MNOK (2025: 259)\n' +
        '  \u2022 Identify strategic accounts: 5 (2025: 0)\n' +
        '\n' +
        'OKR 2: BUILD AND RETAIN A PROUD AND COMPETENT DIGITAL TALENT BASE\n' +
        'Key Enabler: People, Skills & Culture\n' +
        'Key Results:\n' +
        '  \u2022 Turnover: < 12% (2025: 16%)\n' +
        '  \u2022 Engagement: > 4.0 (2025: 4.0)\n' +
        '  \u2022 eNPS: > 15 (2025: 1)\n' +
        '\n' +
        'OKR 3: COMMERCIAL SUCCESS WITH KEY ISY INVESTMENTS\n' +
        'Key Enabler: Go-Live on ISY Project Controls & Launch plan ISY JobTech\n' +
        'Key Results:\n' +
        '  \u2022 ISY Project Controls 2026 contractual revenue: 10 MNOK (2025: -)\n' +
        '  \u2022 ISY Project Controls 2027 ARR run-rate: 6 MNOK (2025: -)\n' +
        '  \u2022 ISY JobTech qualified pipeline: 5 MNOK (2025: -)\n' +
        '\n' +
        'OKR 4: ESTABLISH SWEDEN AS A FOCUSED GROWTH MARKET FOR ADDITIONAL ISY PRODUCTS\n' +
        'Key Enabler: Product Readiness for Market Entry\n' +
        'Key Results:\n' +
        '  \u2022 ISY Products in Sweden 2026 license revenue: 1 MNOK (2025: -)\n' +
        '  \u2022 ISY Products in Sweden 2027 ARR run rate: 3 MNOK (2025: -)\n' +
        '\n' +
        'OKR 5: SCALE SERVICES THROUGH NORCONSULT & NORCONSULT DIGITAL PROJECTS\n' +
        'Key Enabler: Strategic Services Initiative (NO + SE)\n' +
        'Key Results:\n' +
        '  \u2022 Headcount growth: 18% (2025: -11%)\n' +
        '  \u2022 Resource utilization: 82% (2025: 81%)\n' +
        '  \u2022 Revenue through Norconsult: 20% (2025: 10%)',
    },
  },
  'executive-hostage-rescued': {
    floorId: FLOORS.EXECUTIVE,
    content: {
      id: 'executive-hostage-rescued',
      title: 'Leadership Freed',
      body:
        'You made it. The C-suite is safe.\n\n' +
        'Collect the pistol, secure the keycard, crack the bomb code, ' +
        'disarm the device, and take down the threat — the full stack of ' +
        'executive-floor problem-solving in one afternoon.\n\n' +
        '"Architecture is not just about systems," the CEO says quietly. ' +
        '"It\'s about protecting the people inside them."',
    },
  },
};
