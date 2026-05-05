import { FLOORS, type FloorId } from './gameConfig';

export interface NpcQuestion {
  id: string;
  floorId: FloorId;
  topic: string;
  question: string;
  options: readonly [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

const QUESTION_BANK: Record<FloorId, readonly NpcQuestion[]> = {
  [FLOORS.LOBBY]: [
    {
      id: 'lobby-boundaries',
      floorId: FLOORS.LOBBY,
      topic: 'architecture basics',
      question: 'What is the main value of a bounded context in software architecture?',
      options: ['It removes all testing needs', 'It clarifies ownership and language', 'It forces one shared database', 'It guarantees zero latency'],
      correctIndex: 1,
      explanation: 'Bounded contexts make domain language, ownership, and integration seams explicit.',
    },
    {
      id: 'lobby-tradeoffs',
      floorId: FLOORS.LOBBY,
      topic: 'architecture basics',
      question: 'What should an architect do when two quality attributes conflict?',
      options: ['Pick the newest technology', 'Document the trade-off and decision drivers', 'Ignore non-functional needs', 'Always optimize performance first'],
      correctIndex: 1,
      explanation: 'Architecture is trade-off management; decisions need explicit drivers and consequences.',
    },
    {
      id: 'lobby-adrs',
      floorId: FLOORS.LOBBY,
      topic: 'architecture basics',
      question: 'Why write Architecture Decision Records (ADRs)?',
      options: ['To replace source control', 'To capture context, decision, and consequences', 'To avoid talking to teams', 'To generate UI automatically'],
      correctIndex: 1,
      explanation: 'ADRs preserve why a decision was made, not just what changed.',
    },
  ],
  [FLOORS.PLATFORM_TEAM]: [
    {
      id: 'platform-observability',
      floorId: FLOORS.PLATFORM_TEAM,
      topic: 'platform architecture',
      question: 'Which signal best helps diagnose a production latency regression?',
      options: ['A logo redesign', 'Distributed traces with correlated metrics', 'Longer standups', 'A bigger backlog'],
      correctIndex: 1,
      explanation: 'Traces plus metrics show where time is spent and whether the issue is systemic.',
    },
    {
      id: 'platform-self-service',
      floorId: FLOORS.PLATFORM_TEAM,
      topic: 'platform architecture',
      question: 'What is a strong platform-team success metric?',
      options: ['Number of tickets teams must file', 'Lead time for teams to safely ship', 'Count of mandatory meetings', 'Number of internal acronyms'],
      correctIndex: 1,
      explanation: 'Good platforms reduce friction and improve safe delivery speed for product teams.',
    },
    {
      id: 'platform-golden-path',
      floorId: FLOORS.PLATFORM_TEAM,
      topic: 'platform architecture',
      question: 'What is a golden path?',
      options: ['One supported, paved way to build and run software', 'A secret admin password', 'A UI color theme', 'A production-only database'],
      correctIndex: 0,
      explanation: 'Golden paths provide defaults that make the right thing easy without blocking exceptions.',
    },
  ],
  [FLOORS.BUSINESS]: [
    {
      id: 'business-capabilities',
      floorId: FLOORS.BUSINESS,
      topic: 'business architecture',
      question: 'Why map business capabilities before system boundaries?',
      options: ['To find stable ownership seams', 'To choose CSS colors', 'To delete all APIs', 'To avoid user research'],
      correctIndex: 0,
      explanation: 'Capabilities are usually more stable than org charts and implementation details.',
    },
    {
      id: 'business-kpis',
      floorId: FLOORS.BUSINESS,
      topic: 'business architecture',
      question: 'A useful architecture KPI should connect technical change to what?',
      options: ['Business outcomes', 'Random velocity charts', 'Number of repos', 'Keyboard preferences'],
      correctIndex: 0,
      explanation: 'Architecture work earns trust when technical improvements connect to outcome measures.',
    },
    {
      id: 'business-process',
      floorId: FLOORS.BUSINESS,
      topic: 'business architecture',
      question: 'What usually signals a process should not be split across many services?',
      options: ['Tight transactional invariants', 'Different icon sets', 'Too many monitors', 'A funny team name'],
      correctIndex: 0,
      explanation: 'Strong consistency and tight invariants often mean the boundary is too fine-grained.',
    },
  ],
  [FLOORS.EXECUTIVE]: [
    {
      id: 'executive-risk',
      floorId: FLOORS.EXECUTIVE,
      topic: 'executive architecture',
      question: 'How should architecture risk be presented to executives?',
      options: ['Only as stack traces', 'As business impact, likelihood, and options', 'As memes only', 'As hidden tech debt'],
      correctIndex: 1,
      explanation: 'Executives need risk framed around impact, probability, mitigation, and cost.',
    },
    {
      id: 'executive-roadmap',
      floorId: FLOORS.EXECUTIVE,
      topic: 'executive architecture',
      question: 'What makes a modernization roadmap credible?',
      options: ['Big-bang replacement only', 'Incremental slices with measurable outcomes', 'No migration plan', 'Ignoring operations'],
      correctIndex: 1,
      explanation: 'Incremental modernization lowers risk and proves value throughout the journey.',
    },
    {
      id: 'executive-governance',
      floorId: FLOORS.EXECUTIVE,
      topic: 'executive architecture',
      question: 'Healthy architecture governance should primarily do what?',
      options: ['Enable safe decisions close to teams', 'Centralize every code review', 'Ban experiments', 'Delay delivery by default'],
      correctIndex: 0,
      explanation: 'Good governance creates guardrails and fast feedback instead of approval bottlenecks.',
    },
  ],
  [FLOORS.PRODUCTS]: [
    {
      id: 'products-slice',
      floorId: FLOORS.PRODUCTS,
      topic: 'product architecture',
      question: 'Why prefer vertical slices for product delivery?',
      options: ['They deliver user-visible value sooner', 'They require no architecture', 'They remove feedback', 'They only change database tables'],
      correctIndex: 0,
      explanation: 'Vertical slices validate the full path from user need through UI, logic, and data.',
    },
    {
      id: 'products-discovery',
      floorId: FLOORS.PRODUCTS,
      topic: 'product architecture',
      question: 'Which input should shape architecture priorities?',
      options: ['User and business outcomes', 'Framework popularity alone', 'Random benchmarks', 'Office seating'],
      correctIndex: 0,
      explanation: 'Architecture should serve product outcomes, constraints, and user needs.',
    },
    {
      id: 'products-coupling',
      floorId: FLOORS.PRODUCTS,
      topic: 'product architecture',
      question: 'What is a sign product modules are too tightly coupled?',
      options: ['Small independent deploys', 'Every change requires coordinated releases', 'Clear interfaces', 'Fast automated tests'],
      correctIndex: 1,
      explanation: 'Frequent coordinated releases imply boundaries or contracts need attention.',
    },
  ],
  [FLOORS.BOSS]: [
    {
      id: 'boss-resilience',
      floorId: FLOORS.BOSS,
      topic: 'resilience architecture',
      question: 'What is the purpose of a circuit breaker?',
      options: ['Hide logs', 'Stop repeated calls to a failing dependency', 'Make CSS responsive', 'Encrypt passwords'],
      correctIndex: 1,
      explanation: 'Circuit breakers protect systems from cascading failures when dependencies are unhealthy.',
    },
    {
      id: 'boss-chaos',
      floorId: FLOORS.BOSS,
      topic: 'resilience architecture',
      question: 'Why run controlled failure experiments?',
      options: ['To learn system behavior before real incidents', 'To annoy users', 'To avoid monitoring', 'To delete backups'],
      correctIndex: 0,
      explanation: 'Controlled experiments reveal weaknesses while the blast radius is managed.',
    },
    {
      id: 'boss-recovery',
      floorId: FLOORS.BOSS,
      topic: 'resilience architecture',
      question: 'Which metric describes how quickly service is restored after failure?',
      options: ['RTO', 'RGB', 'CSS', 'FPS'],
      correctIndex: 0,
      explanation: 'Recovery Time Objective (RTO) captures the target restoration time.',
    },
  ],
};

export const NPC_QUESTION_BANK = QUESTION_BANK;

export function getNpcQuestionsForFloor(floorId: FloorId): readonly NpcQuestion[] {
  return QUESTION_BANK[floorId] ?? QUESTION_BANK[FLOORS.LOBBY];
}

export function getRandomNpcQuestion(floorId: FloorId, topic?: string): NpcQuestion {
  const pool = getNpcQuestionsForFloor(floorId);
  const topicPool = topic ? pool.filter((q) => q.topic === topic) : pool;
  const candidates = topicPool.length > 0 ? topicPool : pool;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? QUESTION_BANK[FLOORS.LOBBY][0]!;
}
