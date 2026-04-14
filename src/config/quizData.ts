/**
 * Quiz question pools for each info point.
 *
 * Each quiz attempt draws 1 easy + 1 medium + 1 hard = 3 questions.
 * Scoring: 2/3 pass (3 AU), 3/3 perfect (5 AU), 0-1 fail (0 AU).
 */

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface QuizQuestion {
  id: string;
  difficulty: QuizDifficulty;
  question: string;
  choices: string[];       // always 4
  correctIndex: number;    // 0-3
  explanation: string;
}

export interface QuizDefinition {
  infoId: string;
  questions: QuizQuestion[];
}

/** AU awarded per quiz result. */
export const QUIZ_REWARDS = {
  pass: 3,       // 2 out of 3 correct
  perfect: 5,    // 3 out of 3 correct
  fail: 0,       // 0-1 correct
} as const;

/** Cooldown between quiz retry attempts in milliseconds. */
export const QUIZ_COOLDOWN_MS = 30_000;

/** Number of questions per quiz attempt. */
export const QUIZ_QUESTION_COUNT = 3;

export const QUIZ_DATA: Record<string, QuizDefinition> = {
  /* --------------------------------------------------------- */
  /*  Architecture Elevator                                     */
  /* --------------------------------------------------------- */
  'architecture-elevator': {
    infoId: 'architecture-elevator',
    questions: [
      // ---- EASY ----
      {
        id: 'ae-e1',
        difficulty: 'easy',
        question: 'Who coined the term "Architecture Elevator"?',
        choices: ['Martin Fowler', 'Gregor Hohpe', 'Sam Newman', 'Kent Beck'],
        correctIndex: 1,
        explanation: 'Gregor Hohpe coined the term to describe how architects ride between business strategy and technical implementation.',
      },
      {
        id: 'ae-e2',
        difficulty: 'easy',
        question: 'What does the "penthouse" represent in the Architecture Elevator metaphor?',
        choices: [
          'The testing environment',
          'The production servers',
          'Business strategy and organizational decisions',
          'The development team\'s workspace',
        ],
        correctIndex: 2,
        explanation: 'The penthouse represents the strategic level where business decisions are made.',
      },
      {
        id: 'ae-e3',
        difficulty: 'easy',
        question: 'What does the "engine room" represent in the Architecture Elevator?',
        choices: [
          'The HR department',
          'Where technology is built and operated',
          'The project management office',
          'The executive boardroom',
        ],
        correctIndex: 1,
        explanation: 'The engine room is where the technology is built and operated — the hands-on technical level.',
      },
      // ---- MEDIUM ----
      {
        id: 'ae-m1',
        difficulty: 'medium',
        question: 'Why must an effective architect "ride the elevator" between floors?',
        choices: [
          'To get exercise during the workday',
          'To translate between business outcomes and technical systems',
          'To avoid being in too many meetings',
          'To monitor network infrastructure on each floor',
        ],
        correctIndex: 1,
        explanation: 'Architects translate between executives who speak in business outcomes and engineers who speak in systems and code.',
      },
      {
        id: 'ae-m2',
        difficulty: 'medium',
        question: 'What happens when an architect only stays in the "penthouse"?',
        choices: [
          'They become a more effective leader',
          'They gain better technical skills',
          'They become an "ivory tower" architect whose designs don\'t work in practice',
          'They save time by avoiding implementation details',
        ],
        correctIndex: 2,
        explanation: 'Architects who never leave the penthouse create impractical designs disconnected from operational reality.',
      },
      {
        id: 'ae-m3',
        difficulty: 'medium',
        question: 'What is the unique value that an architect creates according to the elevator metaphor?',
        choices: [
          'Writing the most code',
          'Connecting floors — ensuring strategy and implementation are aligned',
          'Managing the largest team',
          'Choosing the newest technologies',
        ],
        correctIndex: 1,
        explanation: 'The elevator ride itself — connecting strategy and implementation — is where architects create the most value.',
      },
      // ---- HARD ----
      {
        id: 'ae-h1',
        difficulty: 'hard',
        question: 'According to the deep dive, what does "riding up" the elevator specifically involve?',
        choices: [
          'Reporting status updates to management',
          'Translating technical constraints into business impact',
          'Escalating bugs to the operations team',
          'Requesting larger budgets for infrastructure',
        ],
        correctIndex: 1,
        explanation: 'Going up means translating technical constraints into business impact — making technology relevant to strategy.',
      },
      {
        id: 'ae-h2',
        difficulty: 'hard',
        question: 'What risk faces an architect who never leaves the "engine room"?',
        choices: [
          'They get promoted too quickly',
          'They become too popular with developers',
          'They miss the strategic context that should guide technical decisions',
          'They run out of technical challenges',
        ],
        correctIndex: 2,
        explanation: 'Staying only in the engine room means missing strategic context, leading to technically sound but strategically misaligned decisions.',
      },
      {
        id: 'ae-h3',
        difficulty: 'hard',
        question: 'The penthouse represents more than just the C-suite. What broader concept does it encompass?',
        choices: [
          'Only the CEO\'s office',
          'Strategic thinking about markets, competitive advantage, and organizational transformation',
          'The cloud infrastructure control panel',
          'The software testing pyramid',
        ],
        correctIndex: 1,
        explanation: 'The penthouse encompasses strategic thinking about markets, competitive advantage, and organizational transformation — not just executives.',
      },
    ],
  },

  /* --------------------------------------------------------- */
  /*  Platform Engineering                                      */
  /* --------------------------------------------------------- */
  'platform-engineering': {
    infoId: 'platform-engineering',
    questions: [
      // ---- EASY ----
      {
        id: 'pe-e1',
        difficulty: 'easy',
        question: 'What does IDP stand for in the context of Platform Engineering?',
        choices: [
          'Internet Data Protocol',
          'Internal Developer Platform',
          'Integrated Deployment Pipeline',
          'Infrastructure Design Pattern',
        ],
        correctIndex: 1,
        explanation: 'IDP stands for Internal Developer Platform — a self-service layer for development teams.',
      },
      {
        id: 'pe-e2',
        difficulty: 'easy',
        question: 'What are "golden paths" in platform engineering?',
        choices: [
          'Physical pathways in the office',
          'Pre-configured, opinionated workflows that encode best practices',
          'Premium-tier cloud service plans',
          'Network routing protocols',
        ],
        correctIndex: 1,
        explanation: 'Golden paths are pre-configured workflows that encode best practices while still allowing flexibility.',
      },
      {
        id: 'pe-e3',
        difficulty: 'easy',
        question: 'What key principle does a platform team follow regarding development teams?',
        choices: [
          'All code must be reviewed by the platform team',
          'Development teams should never touch infrastructure',
          'Reduce cognitive load so teams focus on business logic',
          'Every team must use the same programming language',
        ],
        correctIndex: 2,
        explanation: 'The platform reduces cognitive load on development teams so they can focus on business logic rather than infrastructure plumbing.',
      },
      // ---- MEDIUM ----
      {
        id: 'pe-m1',
        difficulty: 'medium',
        question: 'Instead of every team building their own CI/CD pipelines, what does a platform team provide?',
        choices: [
          'A mandate that no CI/CD is needed',
          'Pre-configured, reusable golden path workflows',
          'A single monolithic deployment pipeline for all teams',
          'Outsourced DevOps consulting',
        ],
        correctIndex: 1,
        explanation: 'Platform teams create golden paths — reusable, pre-configured workflows — so individual teams don\'t reinvent the wheel.',
      },
      {
        id: 'pe-m2',
        difficulty: 'medium',
        question: 'What is the combined philosophy behind platform engineering?',
        choices: [
          '"Move fast and break things"',
          '"You build it, you run it" combined with "We make running it easy"',
          '"Don\'t repeat yourself" and "Keep it simple"',
          '"Fail fast" and "Ship often"',
        ],
        correctIndex: 1,
        explanation: 'Platform engineering combines ownership ("you build it, you run it") with support ("we make running it easy").',
      },
      {
        id: 'pe-m3',
        difficulty: 'medium',
        question: 'What is an anti-pattern in platform engineering?',
        choices: [
          'Making the platform optional',
          'Starting with a small platform',
          'Mandating platform use without providing value',
          'Measuring developer satisfaction',
        ],
        correctIndex: 2,
        explanation: 'Forcing teams to use a platform that doesn\'t provide clear value is a common anti-pattern that breeds resentment.',
      },
      // ---- HARD ----
      {
        id: 'pe-h1',
        difficulty: 'hard',
        question: 'According to Team Topologies, what is a Platform Team\'s primary interaction mode?',
        choices: [
          'Collaboration',
          'Facilitation',
          'X-as-a-Service',
          'Pair programming',
        ],
        correctIndex: 2,
        explanation: 'Platform Teams provide capabilities via "X-as-a-Service" — teams consume with minimal coordination.',
      },
      {
        id: 'pe-h2',
        difficulty: 'hard',
        question: 'What is the "Thinnest Viable Platform" (TVP) concept?',
        choices: [
          'Using the cheapest possible cloud provider',
          'Starting with the smallest platform that provides value, possibly just documentation',
          'Removing all features except deployment',
          'Running on the minimum number of servers',
        ],
        correctIndex: 1,
        explanation: 'TVP means starting small — even a wiki page with best practices — and evolving toward self-service APIs as needs grow.',
      },
      {
        id: 'pe-h3',
        difficulty: 'hard',
        question: 'Which of these is a key metric for platform success according to the deep dive?',
        choices: [
          'Lines of code written per day',
          'Number of microservices deployed',
          'Developer onboarding time and developer satisfaction',
          'Total number of cloud resources provisioned',
        ],
        correctIndex: 2,
        explanation: 'Key metrics include onboarding time, time to first deploy, change failure rate, and developer satisfaction surveys.',
      },
    ],
  },

  /* --------------------------------------------------------- */
  /*  Cloud-Native Architecture                                 */
  /* --------------------------------------------------------- */
  'cloud-architecture': {
    infoId: 'cloud-architecture',
    questions: [
      // ---- EASY ----
      {
        id: 'ca-e1',
        difficulty: 'easy',
        question: 'What organization defines cloud-native technologies?',
        choices: [
          'IEEE',
          'W3C',
          'Cloud Native Computing Foundation (CNCF)',
          'ISO',
        ],
        correctIndex: 2,
        explanation: 'The CNCF (Cloud Native Computing Foundation) defines cloud-native technologies and maintains the cloud-native landscape.',
      },
      {
        id: 'ca-e2',
        difficulty: 'easy',
        question: 'What is a key mindset shift in cloud-native architecture?',
        choices: [
          'Design for zero bugs',
          'Design for failure',
          'Design for maximum speed',
          'Design for lowest cost',
        ],
        correctIndex: 1,
        explanation: '"Design for failure" acknowledges that individual components will fail, so the system must remain available as a whole.',
      },
      {
        id: 'ca-e3',
        difficulty: 'easy',
        question: 'Which of these is NOT mentioned as a cloud-native technology?',
        choices: [
          'Containers',
          'Microservices',
          'Blockchain',
          'Service meshes',
        ],
        correctIndex: 2,
        explanation: 'Containers, microservices, service meshes, and declarative APIs are all mentioned. Blockchain is not a cloud-native technology.',
      },
      // ---- MEDIUM ----
      {
        id: 'ca-m1',
        difficulty: 'medium',
        question: 'What does the circuit breaker pattern prevent?',
        choices: [
          'Unauthorized access to services',
          'Data corruption in databases',
          'Cascading failures across services',
          'Excessive memory usage',
        ],
        correctIndex: 2,
        explanation: 'Circuit breakers prevent cascading failures by failing fast when a downstream service is unresponsive, giving it time to recover.',
      },
      {
        id: 'ca-m2',
        difficulty: 'medium',
        question: 'Which pattern involves requests failing fast instead of timing out when a service is down?',
        choices: [
          'Bulkhead pattern',
          'Circuit breaker pattern',
          'Retry pattern',
          'Sidecar pattern',
        ],
        correctIndex: 1,
        explanation: 'When a circuit breaker "opens," requests fail immediately instead of waiting for a timeout, preventing resource exhaustion.',
      },
      {
        id: 'ca-m3',
        difficulty: 'medium',
        question: 'What kind of infrastructure does cloud-native architecture favor?',
        choices: [
          'Mutable infrastructure with in-place updates',
          'On-premises hardware only',
          'Immutable infrastructure with declarative APIs',
          'Manual server provisioning',
        ],
        correctIndex: 2,
        explanation: 'Cloud-native favors immutable infrastructure and declarative APIs for consistent, reproducible environments.',
      },
      // ---- HARD ----
      {
        id: 'ca-h1',
        difficulty: 'hard',
        question: 'According to the Twelve-Factor App, how should configuration be stored?',
        choices: [
          'In XML files bundled with the application',
          'In the environment (environment variables)',
          'Hardcoded in the source code',
          'In a shared database table',
        ],
        correctIndex: 1,
        explanation: 'Factor 3 says "Store config in the environment" — config that varies between deploys should be in env vars, not code.',
      },
      {
        id: 'ca-h2',
        difficulty: 'hard',
        question: 'What does "cattle not pets" mean in cloud-native philosophy?',
        choices: [
          'Use animal-themed server naming conventions',
          'Servers are disposable and replaceable, not unique and hand-maintained',
          'Monitor servers like you would livestock',
          'Deploy applications in herds of containers',
        ],
        correctIndex: 1,
        explanation: '"Cattle not pets" means servers/containers are disposable and interchangeable, enabling immutable infrastructure.',
      },
      {
        id: 'ca-h3',
        difficulty: 'hard',
        question: 'Who wrote "Release It!" which popularized the circuit breaker pattern for software?',
        choices: [
          'Martin Fowler',
          'Eric Evans',
          'Michael Nygard',
          'Robert C. Martin',
        ],
        correctIndex: 2,
        explanation: 'Michael Nygard popularized the circuit breaker pattern in his book "Release It!" about building resilient software.',
      },
    ],
  },
};
