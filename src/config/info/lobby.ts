import { FLOORS } from '../gameConfig';
import { InfoPointDef } from './types';

/** Info points shown in the Lobby floor. */
export const INFO_LOBBY: Record<string, InfoPointDef> = {
  'welcome-board': {
    floorId: FLOORS.LOBBY,
    content: {
      id: 'welcome-board',
      title: 'Welcome to Architecture Elevator!',
      body:
        'You are a software architect who must ride the elevator between ' +
        'floors — each one home to a different team with its own architectural ' +
        'challenges.\n\n' +
        'CONTROLS\n' +
        '  ← →   Walk\n' +
        '  ↑ ↓   Ride the elevator (stand on it first)\n' +
        '  SPACE  Front-flip!\n' +
        '  I      Open info panels\n' +
        '  D      Toggle debug overlay\n\n' +
        'HOW TO PLAY\n' +
        'Walk right from the lobby onto the elevator platform. Use Up/Down to ' +
        'ride between floors. Step off at any floor to enter that team\'s room, ' +
        'collect AU tokens, read info panels, and take quizzes to test your ' +
        'knowledge.\n\n' +
        'The game is inspired by Gregor Hohpe\'s "Architecture Elevator" — the ' +
        'idea that great architects connect the penthouse (strategy) with the ' +
        'engine room (technology). Good luck on your ride!',
    },
  },

  'architecture-elevator': {
    floorId: FLOORS.LOBBY,
    content: {
      id: 'architecture-elevator',
      title: 'The Architecture Elevator',
      body:
        'Gregor Hohpe coined the term "Architecture Elevator" to describe ' +
        'how software architects must ride between the penthouse \u2014 where ' +
        'business strategy and organizational decisions are made \u2014 and the ' +
        'engine room \u2014 where the technology is built and operated.\n\n' +
        'An effective architect doesn\'t just live on one floor. They translate ' +
        'between executives who speak in business outcomes and engineers who ' +
        'speak in systems and code. The elevator ride connects these worlds.\n\n' +
        'In this game you literally ride the elevator between floors \u2014 each ' +
        'one representing a different team and set of architectural challenges.',
      links: [
        { label: 'The Software Architect Elevator (Book)', url: 'https://architectelevator.com/book/' },
        { label: 'Gregor Hohpe\u2019s Blog', url: 'https://architectelevator.com/' },
        { label: 'Architecture Elevator Article', url: 'https://martinfowler.com/articles/architect-elevator.html' },
      ],
      extendedInfo: {
        title: 'Deep Dive: The Architecture Elevator',
        body:
          'The Architecture Elevator metaphor goes deeper than just "talking to ' +
          'different people". Hohpe identifies several key patterns:\n\n' +
          'Riding the elevator means actively translating context. When you go up, ' +
          'you translate technical constraints into business impact. When you go ' +
          'down, you translate business goals into technical direction.\n\n' +
          'The "penthouse" isn\'t just the C-suite \u2014 it represents strategic ' +
          'thinking about markets, competitive advantage, and organizational ' +
          'transformation. The "engine room" isn\'t just coding \u2014 it\'s about ' +
          'operational reality, technical debt, and system constraints.\n\n' +
          'Architects who only stay in the penthouse become "ivory tower" architects ' +
          'whose designs don\'t work in practice. Those who never leave the engine ' +
          'room miss the strategic context that should guide technical decisions.\n\n' +
          'A key insight: the elevator ride itself is where the most value is ' +
          'created. The act of connecting floors \u2014 of ensuring that strategy ' +
          'and implementation are aligned \u2014 is the architect\'s unique contribution.',
      },
    },
  },
};
