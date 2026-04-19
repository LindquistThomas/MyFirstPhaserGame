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
};
