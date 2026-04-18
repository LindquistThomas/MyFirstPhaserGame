/**
 * Quiz question pools for each info point.
 *
 * Each pool contains at least 30 questions (10 easy / 10 medium / 10 hard).
 * Each quiz attempt randomly draws QUIZ_QUESTION_COUNT questions with a
 * deterministic difficulty mix (see QUIZ_DIFFICULTY_MIX).
 *
 * Scoring: pass (>= QUIZ_PASS_THRESHOLD correct) → 3 AU,
 *          perfect (all correct)               → 5 AU,
 *          below threshold                     → 0 AU.
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

/** Number of questions per quiz attempt (must be in 7..10 range). */
export const QUIZ_QUESTION_COUNT = 8;

/**
 * How many questions of each difficulty to draw per attempt.
 * Sum must equal QUIZ_QUESTION_COUNT.
 */
export const QUIZ_DIFFICULTY_MIX: Record<QuizDifficulty, number> = {
  easy: 3,
  medium: 3,
  hard: 2,
};

/** Minimum correct answers required to pass a quiz. */
export const QUIZ_PASS_THRESHOLD = 5;

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
      // ---- EASY (additional) ----
      {
        id: 'ae-e4',
        difficulty: 'easy',
        question: 'What language do executives typically speak, according to the Architecture Elevator?',
        choices: ['Assembly code', 'Business outcomes', 'Network protocols', 'Database queries'],
        correctIndex: 1,
        explanation: 'Executives speak in business outcomes; the architect\'s role is to translate between this language and the technical language of the engine room.',
      },
      {
        id: 'ae-e5',
        difficulty: 'easy',
        question: 'What language do engineers typically speak, according to the Architecture Elevator?',
        choices: ['ROI and market share', 'Budget projections', 'Systems and code', 'Legal compliance'],
        correctIndex: 2,
        explanation: 'Engineers speak in systems and code \u2014 the technical language that business executives do not usually share.',
      },
      {
        id: 'ae-e6',
        difficulty: 'easy',
        question: 'Which of these best describes the architect\'s role in the Architecture Elevator metaphor?',
        choices: [
          'A developer who writes the most code',
          'A translator between executives and engineers',
          'A project manager who tracks deadlines',
          'A system administrator who manages servers',
        ],
        correctIndex: 1,
        explanation: 'The architect rides the elevator specifically to translate between the business language of the penthouse and the technical language of the engine room.',
      },
      {
        id: 'ae-e7',
        difficulty: 'easy',
        question: 'On which website is the Architecture Elevator article by Gregor Hohpe published?',
        choices: ['aws.amazon.com', 'martinfowler.com', 'stackoverflow.com', 'infoq.com'],
        correctIndex: 1,
        explanation: 'Hohpe\'s Architecture Elevator article is published on martinfowler.com alongside his other architectural writing.',
      },
      {
        id: 'ae-e8',
        difficulty: 'easy',
        question: 'In the game inspired by the Architecture Elevator, what does the player literally do?',
        choices: [
          'Write code in the engine room',
          'Draw architecture diagrams',
          'Ride the elevator between floors representing different teams',
          'Attend executive board meetings',
        ],
        correctIndex: 2,
        explanation: 'The game has you literally ride the elevator between floors \u2014 each representing a different team \u2014 mirroring the architect\'s role of connecting levels.',
      },
      {
        id: 'ae-e9',
        difficulty: 'easy',
        question: 'What is Gregor Hohpe\'s book about the Architecture Elevator called?',
        choices: [
          '"Clean Architecture"',
          '"The Pragmatic Architect"',
          '"The Software Architect Elevator"',
          '"Architecture Patterns with Python"',
        ],
        correctIndex: 2,
        explanation: '"The Software Architect Elevator" is Hohpe\'s book exploring the architect\'s role in riding between strategy and implementation.',
      },
      {
        id: 'ae-e10',
        difficulty: 'easy',
        question: 'Business strategy and organizational decisions are made on which floor of the Architecture Elevator?',
        choices: ['The engine room', 'The basement', 'The penthouse', 'The mezzanine'],
        correctIndex: 2,
        explanation: 'The penthouse is where business strategy and organizational decisions are made \u2014 the strategic level of the organization.',
      },
      // ---- MEDIUM (additional) ----
      {
        id: 'ae-m4',
        difficulty: 'medium',
        question: 'A CTO asks why a new platform costs 30% more. Which response best demonstrates "riding up" the elevator?',
        choices: [
          'Sending a detailed technical specification',
          'Deflecting to the engineering team for the answer',
          'Translating the cost into expected reduction in incident downtime and time-to-market impact',
          'Requesting more budget without context',
        ],
        correctIndex: 2,
        explanation: 'Riding up means converting technical choices into business impact \u2014 helping the CTO evaluate the investment in terms they can act on.',
      },
      {
        id: 'ae-m5',
        difficulty: 'medium',
        question: 'An architect answers a business question with a 10-minute Kubernetes deep-dive. What principle did they violate?',
        choices: [
          'They should have given a shorter Kubernetes explanation',
          'They failed to translate technical detail into business language for their audience',
          'They should have delegated to an engineer',
          'They spoke for too long in a meeting',
        ],
        correctIndex: 1,
        explanation: 'The elevator ride requires active translation \u2014 not reciting technical facts, but converting them into the language the listener uses.',
      },
      {
        id: 'ae-m6',
        difficulty: 'medium',
        question: 'When riding DOWN the elevator, what should an architect bring to the engine room?',
        choices: [
          'Budget spreadsheets from the finance team',
          'Business goals translated into technical direction',
          'A list of executive complaints about engineering',
          'Marketing collateral for new features',
        ],
        correctIndex: 1,
        explanation: 'Going down means taking business goals and converting them into concrete technical direction that guides engineering decisions.',
      },
      {
        id: 'ae-m7',
        difficulty: 'medium',
        question: 'Why can neither the penthouse nor the engine room function optimally without the elevator connection?',
        choices: [
          'Because they share the same physical infrastructure',
          'Strategy without implementation produces no results; implementation without strategy produces the wrong results',
          'Because the teams are on the same salary band',
          'Because both floors use the same monitoring tools',
        ],
        correctIndex: 1,
        explanation: 'Strategy and implementation are mutually dependent \u2014 architects create value by ensuring they remain aligned through continuous translation.',
      },
      {
        id: 'ae-m8',
        difficulty: 'medium',
        question: 'Which of these best describes an architect who NEVER rides down from the penthouse?',
        choices: [
          'A highly strategic thinker who creates long-term value',
          'An "ivory tower" architect whose designs don\'t work in practice',
          'A specialist who appropriately focuses on strategy',
          'An executive who also understands technology',
        ],
        correctIndex: 1,
        explanation: 'Staying only in the penthouse produces impractical designs disconnected from the operational reality of the engine room.',
      },
      {
        id: 'ae-m9',
        difficulty: 'medium',
        question: 'What does the Architecture Elevator say about architects who only work in the engine room?',
        choices: [
          'They produce the highest-quality code',
          'They miss the strategic context that should guide their technical decisions',
          'They are the most valuable type of architect',
          'They eventually develop business strategy skills naturally',
        ],
        correctIndex: 1,
        explanation: 'Engine-room-only architects are technically skilled but lack the strategic context needed to align their work with business goals.',
      },
      {
        id: 'ae-m10',
        difficulty: 'medium',
        question: 'What makes the architect\'s contribution unique compared to both executives and engineers?',
        choices: [
          'Architects hold more certifications than either group',
          'Architects write both business documents and code',
          'Architects actively translate between the strategic and technical worlds',
          'Architects manage larger teams than engineers',
        ],
        correctIndex: 2,
        explanation: 'The architect\'s unique value is the translation work \u2014 connecting two worlds that speak different languages about the same system.',
      },
      // ---- HARD (additional) ----
      {
        id: 'ae-h4',
        difficulty: 'hard',
        question: 'According to the deep dive, what does "riding down" the elevator specifically involve?',
        choices: [
          'Attending stand-up meetings with engineering',
          'Translating business goals into technical direction',
          'Writing deployment scripts',
          'Reporting sprint velocity to management',
        ],
        correctIndex: 1,
        explanation: 'The deep dive explicitly states: going down means translating business goals into technical direction \u2014 the complement of riding up.',
      },
      {
        id: 'ae-h5',
        difficulty: 'hard',
        question: 'According to the deep dive, the "engine room" goes beyond coding to encompass what?',
        choices: [
          'Marketing campaigns and customer feedback',
          'Legal compliance and contract review',
          'Operational reality, technical debt, and system constraints',
          'Finance and budget planning',
        ],
        correctIndex: 2,
        explanation: 'The engine room is the full operational reality: running systems, accumulating technical debt, and the constraints those systems impose on future decisions.',
      },
      {
        id: 'ae-h6',
        difficulty: 'hard',
        question: 'The deep dive describes the elevator ride as the moment when "the most value is created." What specifically happens in that moment?',
        choices: [
          'The architect writes detailed architecture documents',
          'Strategy and implementation become aligned \u2014 each floor\'s constraints and goals become legible to the other',
          'The architect attends every meeting on both floors',
          'New technology is evaluated and selected',
        ],
        correctIndex: 1,
        explanation: 'The deep dive states: "The act of connecting floors \u2014 of ensuring that strategy and implementation are aligned \u2014 is the architect\'s unique contribution."',
      },
      {
        id: 'ae-h7',
        difficulty: 'hard',
        question: 'A business goal is "reduce customer churn by 15%." An architect translates this into "all user-facing API responses must be under 200 ms." Which direction of the elevator is this?',
        choices: [
          'Riding up \u2014 turning technical constraints into business impact',
          'Neither \u2014 this is product management work',
          'Riding down \u2014 translating business goals into technical direction',
          'Staying in the engine room to investigate performance',
        ],
        correctIndex: 2,
        explanation: 'Business goal (reduce churn) \u2192 technical direction (response time target) is the downward ride \u2014 strategy descending into implementation guidance.',
      },
      {
        id: 'ae-h8',
        difficulty: 'hard',
        question: 'The deep dive says architects who stay only in the penthouse produce designs that "don\'t work in practice." What specific knowledge are they missing?',
        choices: [
          'The names of the engineering team members',
          'Operational reality, technical debt, and the true constraints the system operates under',
          'The programming languages currently in use',
          'The project timeline and milestones',
        ],
        correctIndex: 1,
        explanation: 'Without engine-room awareness, architects design for an idealized system rather than the real one \u2014 full of debt, constraints, and operational realities.',
      },
      {
        id: 'ae-h9',
        difficulty: 'hard',
        question: 'According to the deep dive, what does "actively translating context" mean when riding up?',
        choices: [
          'Simplifying technical terms for a non-technical audience',
          'Converting technical constraints into the business impact language executives use to make decisions',
          'Reporting status updates with less jargon',
          'Summarising engineering output for quarterly reviews',
        ],
        correctIndex: 1,
        explanation: 'Active translation means reframing technical constraints as business consequences \u2014 not just simplifying, but genuinely converting the currency of meaning.',
      },
      {
        id: 'ae-h10',
        difficulty: 'hard',
        question: 'The deep dive identifies a risk symmetric to the "ivory tower" architect. What is it?',
        choices: [
          'The architect who attends too many meetings',
          'The architect who stays only in the engine room and misses the strategic context guiding technical decisions',
          'The architect who produces too many diagrams',
          'The architect who manages too many teams simultaneously',
        ],
        correctIndex: 1,
        explanation: 'Both extremes are harmful: penthouse-only produces impractical designs; engine-room-only produces technically sound but strategically misaligned decisions.',
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
      // ---- EASY (additional) ----
      {
        id: 'pe-e4',
        difficulty: 'easy',
        question: 'Which book is a primary theoretical foundation of Platform Engineering?',
        choices: [
          '"Clean Code" by Robert C. Martin',
          '"Team Topologies" by Skelton and Pais',
          '"The Phoenix Project" by Gene Kim',
          '"Accelerate" by Nicole Forsgren',
        ],
        correctIndex: 1,
        explanation: 'Team Topologies by Matthew Skelton and Manuel Pais defines four team types, including the Platform team and its X-as-a-Service interaction mode.',
      },
      {
        id: 'pe-e5',
        difficulty: 'easy',
        question: 'How many fundamental team types does Team Topologies identify?',
        choices: ['Two', 'Three', 'Four', 'Six'],
        correctIndex: 2,
        explanation: 'Team Topologies defines four team types: Stream-aligned, Enabling, Complicated Subsystem, and Platform.',
      },
      {
        id: 'pe-e6',
        difficulty: 'easy',
        question: 'Which of these is NOT one of the four team types in Team Topologies?',
        choices: ['Stream-aligned', 'Enabling', 'Architecture', 'Complicated Subsystem'],
        correctIndex: 2,
        explanation: '"Architecture team" is not one of the four Team Topologies types. The four are: Stream-aligned, Enabling, Complicated Subsystem, and Platform.',
      },
      {
        id: 'pe-e7',
        difficulty: 'easy',
        question: 'What does a Platform team provide to enable "You build it, you run it"?',
        choices: [
          'A separate operations team to handle production incidents',
          'A self-service platform that reduces the cognitive load of owning services',
          'Code reviews for every production deployment',
          'Mandatory training on cloud infrastructure',
        ],
        correctIndex: 1,
        explanation: 'The platform makes "running it easy" so product teams can own their services without being overwhelmed by infrastructure complexity.',
      },
      {
        id: 'pe-e8',
        difficulty: 'easy',
        question: 'Without golden paths, what problem does each development team face?',
        choices: [
          'They cannot write tests',
          'Every team must reinvent CI/CD, monitoring, and infrastructure from scratch',
          'Teams cannot deploy independently',
          'Teams must use the same programming language',
        ],
        correctIndex: 1,
        explanation: 'Without golden paths, every team reinvents the same infrastructure \u2014 creating inconsistency and wasting effort on undifferentiated work.',
      },
      {
        id: 'pe-e9',
        difficulty: 'easy',
        question: 'What does "self-service" mean in the context of an Internal Developer Platform?',
        choices: [
          'Teams write all their own tools',
          'Teams can provision infrastructure and run workflows without waiting for the platform team',
          'Developers interview and hire themselves',
          'Teams manage their own payroll systems',
        ],
        correctIndex: 1,
        explanation: 'Self-service means teams access platform capabilities on demand \u2014 no tickets, no waiting for a human in the platform team to act.',
      },
      {
        id: 'pe-e10',
        difficulty: 'easy',
        question: 'What is the primary goal of reducing cognitive load on development teams?',
        choices: [
          'To make developers work fewer hours',
          'To let teams focus on business logic and product delivery instead of infrastructure plumbing',
          'To reduce the number of engineers needed',
          'To simplify the codebase',
        ],
        correctIndex: 1,
        explanation: 'Cognitive load reduction means developers can focus on the unique value they create \u2014 the business problem \u2014 rather than infrastructure boilerplate.',
      },
      // ---- MEDIUM (additional) ----
      {
        id: 'pe-m4',
        difficulty: 'medium',
        question: 'A developer needs a new database environment for testing. In an ideal Platform Engineering setup, they should:',
        choices: [
          'Open a ticket and wait for the platform team to provision it',
          'Provision it themselves via a self-service API with no coordination needed',
          'Ask their manager to escalate to ops',
          'Use their local laptop instead',
        ],
        correctIndex: 1,
        explanation: 'X-as-a-Service means stream-aligned teams consume platform capabilities on demand \u2014 self-service with minimal coordination.',
      },
      {
        id: 'pe-m5',
        difficulty: 'medium',
        question: 'Which scenario is an example of the "mandating platform use without providing value" anti-pattern?',
        choices: [
          'Requiring teams to use a platform that halves their deployment time',
          'Forcing teams to use a slow, unreliable CI/CD system with no alternative',
          'Providing a golden path that most teams adopt voluntarily',
          'Offering optional platform tooling with good documentation',
        ],
        correctIndex: 1,
        explanation: 'Forcing adoption of a platform that slows teams down breeds resentment and resistance \u2014 the opposite of what Platform Engineering aims for.',
      },
      {
        id: 'pe-m6',
        difficulty: 'medium',
        question: 'What is the key reason a Platform team should treat its platform as a "product"?',
        choices: [
          'It generates direct revenue for the company',
          'It has internal customers whose feedback should shape its features and evolution',
          'Products have better tooling than platforms',
          'It helps justify the platform team\'s headcount',
        ],
        correctIndex: 1,
        explanation: 'Treating the platform as a product means understanding developer needs, gathering feedback, and iterating \u2014 just like any customer-facing product.',
      },
      {
        id: 'pe-m7',
        difficulty: 'medium',
        question: 'Why is measuring "developer onboarding time" a useful platform metric?',
        choices: [
          'It measures the quality of the HR hiring process',
          'It reveals whether the platform truly makes it easy for new engineers to become productive quickly',
          'It tracks how fast developers learn to program',
          'It measures documentation quality in isolation',
        ],
        correctIndex: 1,
        explanation: 'Onboarding time reflects the platform\'s ability to make new engineers productive quickly \u2014 a direct signal of self-service quality.',
      },
      {
        id: 'pe-m8',
        difficulty: 'medium',
        question: 'A stream-aligned team wants to use a technology not covered by any golden path. What should the platform team\'s response be?',
        choices: [
          'Refuse \u2014 all teams must use golden paths strictly',
          'Mandate they adopt an existing path regardless of fit',
          'Golden paths are opinionated but flexible; support the team in making an appropriate choice',
          'Transfer the team to a different business unit',
        ],
        correctIndex: 2,
        explanation: 'Golden paths provide defaults and best practices but are not prisons \u2014 allowing flexibility while encoding opinions is core to the design.',
      },
      {
        id: 'pe-m9',
        difficulty: 'medium',
        question: 'What distinguishes a Platform team\'s interaction mode from an Enabling team\'s?',
        choices: [
          'Platform teams pair-program with stream-aligned teams; Enabling teams don\'t',
          'Platform teams provide X-as-a-Service (minimal coordination); Enabling teams facilitate and upskill (temporary collaboration)',
          'Enabling teams are always larger than Platform teams',
          'Platform teams are owned by IT; Enabling teams by engineering',
        ],
        correctIndex: 1,
        explanation: 'X-as-a-Service means minimum coordination; facilitation means active collaboration to raise capability. These are distinct interaction modes in Team Topologies.',
      },
      {
        id: 'pe-m10',
        difficulty: 'medium',
        question: 'What does "building too much too early" risk in a Platform Engineering context?',
        choices: [
          'Building a platform that is too fast to use',
          'Overinvesting in features nobody needs yet, delaying value delivery and creating a maintenance burden',
          'Creating security vulnerabilities',
          'Hiring too many platform engineers',
        ],
        correctIndex: 1,
        explanation: 'The Thinnest Viable Platform principle guards against this: start with what provides value now and evolve based on actual demand.',
      },
      // ---- HARD (additional) ----
      {
        id: 'pe-h4',
        difficulty: 'hard',
        question: 'The four team types in Team Topologies, in full, are:',
        choices: [
          'Product, Dev, Ops, QA',
          'Frontend, Backend, Infrastructure, Security',
          'Stream-aligned, Enabling, Complicated Subsystem, Platform',
          'Feature, Support, Architecture, Operations',
        ],
        correctIndex: 2,
        explanation: 'Team Topologies identifies exactly four types: Stream-aligned (delivery), Enabling (upskilling), Complicated Subsystem (specialist knowledge), and Platform (X-as-a-Service).',
      },
      {
        id: 'pe-h5',
        difficulty: 'hard',
        question: 'According to the deep dive, which signal most directly indicates that developers actually value the platform?',
        choices: [
          'The number of golden paths defined',
          'The size of the platform engineering team',
          'Voluntary adoption \u2014 developers choose to use it without being mandated',
          'The number of cloud resources the platform manages',
        ],
        correctIndex: 2,
        explanation: 'A good platform is one developers voluntarily choose \u2014 forced adoption masks whether the platform actually helps.',
      },
      {
        id: 'pe-h6',
        difficulty: 'hard',
        question: 'The deep dive identifies "treating the platform as a pure infrastructure concern" as an anti-pattern. What should it be treated as instead?',
        choices: [
          'A security system',
          'A cost center',
          'A product with internal customers',
          'A compliance tool',
        ],
        correctIndex: 2,
        explanation: 'A platform that ignores its users\' experience fails. Treating it as a product means continuous discovery of developer needs and iterating on the offering.',
      },
      {
        id: 'pe-h7',
        difficulty: 'hard',
        question: 'Which of the following is explicitly cited as a key platform success metric in the deep dive?',
        choices: [
          'Cost per cloud resource',
          'Number of microservices deployed',
          'Time to first deploy',
          'Lines of platform code written',
        ],
        correctIndex: 2,
        explanation: 'Time to first deploy \u2014 how quickly a new team can ship to production \u2014 is a direct indicator of how well the platform reduces friction.',
      },
      {
        id: 'pe-h8',
        difficulty: 'hard',
        question: 'What distinguishes the "Complicated Subsystem" team type from a Platform team?',
        choices: [
          'Complicated Subsystem teams provide infrastructure; Platform teams provide expertise',
          'Complicated Subsystem teams own deep specialist knowledge for a complex domain; Platform teams provide broad self-service capabilities',
          'Platform teams are always larger',
          'Complicated Subsystem teams use X-as-a-Service',
        ],
        correctIndex: 1,
        explanation: 'Complicated Subsystem teams exist for genuinely complex technical domains requiring deep expertise (e.g. video encoding). Platform teams provide broad, reusable capabilities as a service.',
      },
      {
        id: 'pe-h9',
        difficulty: 'hard',
        question: 'The "Thinnest Viable Platform" can start as just a wiki page. What principle does this reflect?',
        choices: [
          'Documentation is always more important than code',
          'Platform Engineering doesn\'t require any tooling',
          'Start with the minimum that provides real value and evolve incrementally based on proven demand',
          'Wikis are the best developer tooling available',
        ],
        correctIndex: 2,
        explanation: 'TVP is a lean approach: deliver value immediately with minimal investment, then add self-service APIs, portals, and automation as actual needs emerge.',
      },
      {
        id: 'pe-h10',
        difficulty: 'hard',
        question: 'According to Team Topologies, what is the "cognitive load" problem that Platform teams are specifically designed to solve for stream-aligned teams?',
        choices: [
          'Too many programming languages to learn',
          'The burden of managing infrastructure, tooling, and operational complexity on top of delivering product features',
          'Too many meetings with stakeholders',
          'Having too many microservices to maintain',
        ],
        correctIndex: 1,
        explanation: 'Stream-aligned teams focus on delivering value; offloading infrastructure complexity to a Platform team keeps that cognitive load within manageable bounds.',
      },
    ],
  },

  /* --------------------------------------------------------- */
  /*  You Build It, You Run It                                  */
  /* --------------------------------------------------------- */
  'you-build-you-run': {
    infoId: 'you-build-you-run',
    questions: [
      // ---- EASY ----
      {
        id: 'ybyr-e1',
        difficulty: 'easy',
        question: 'Who coined the phrase "You build it, you run it"?',
        choices: [
          'Martin Fowler',
          'Werner Vogels (Amazon CTO)',
          'Kent Beck',
          'Gene Kim',
        ],
        correctIndex: 1,
        explanation: 'Werner Vogels coined the phrase in a 2006 ACM Queue interview to describe how AWS teams work.',
      },
      {
        id: 'ybyr-e2',
        difficulty: 'easy',
        question: 'In "you build it, you run it," who carries the pager when a service breaks in production?',
        choices: [
          'A separate 24/7 operations team',
          'The developers who wrote the service',
          'The security team',
          'The CTO',
        ],
        correctIndex: 1,
        explanation: 'The team that built the service also operates it — closing the feedback loop between design and production behaviour.',
      },
      {
        id: 'ybyr-e3',
        difficulty: 'easy',
        question: 'Which model does "you build it, you run it" replace?',
        choices: [
          'Agile sprints',
          'Test-driven development',
          'The "throw code over the wall" handoff between dev and ops',
          'Pair programming',
        ],
        correctIndex: 2,
        explanation: 'It replaces the old relay race where developers handed finished code to a separate ops team that hadn\'t designed it.',
      },
      // ---- MEDIUM ----
      {
        id: 'ybyr-m1',
        difficulty: 'medium',
        question: 'Why does being on-call for your own service tend to improve its design?',
        choices: [
          'It forces developers to work longer hours',
          'On-call hours count toward performance reviews',
          'When you personally get paged at 3 a.m., you invest in reliability and fix root causes',
          'On-call rotations generate more commits',
        ],
        correctIndex: 2,
        explanation: 'The pager is a direct feedback signal: pain felt by the author becomes reliability improvements in the next release.',
      },
      {
        id: 'ybyr-m2',
        difficulty: 'medium',
        question: 'Which advantage for a dev team does "you build it, you run it" NOT directly provide?',
        choices: [
          'Faster feedback from production',
          'Tighter ownership and autonomy',
          'A guarantee that the team never needs other teams',
          'Growth of SRE / deployment skills across the team',
        ],
        correctIndex: 2,
        explanation: 'Ownership is end-to-end, but teams still collaborate — typically with a Platform team that makes "running it" easy.',
      },
      {
        id: 'ybyr-m3',
        difficulty: 'medium',
        question: 'Which real-world analogy best captures "you build it, you run it"?',
        choices: [
          'A novelist who hires a ghostwriter',
          'A restaurant chef who also works the dining room and hears customers directly',
          'A courier who only delivers pre-packaged boxes',
          'A librarian organizing other people\'s books',
        ],
        correctIndex: 1,
        explanation: 'The chef hears complaints in real time and iterates the menu — a tight feedback loop the factory-canteen model lacks.',
      },
      // ---- HARD ----
      {
        id: 'ybyr-h1',
        difficulty: 'hard',
        question: 'Which research programme links end-to-end team ownership to the "four key metrics" (deployment frequency, lead time, change failure rate, MTTR)?',
        choices: [
          'ISO 9001',
          'DORA / State of DevOps (Accelerate)',
          'ITIL',
          'CMMI',
        ],
        correctIndex: 1,
        explanation: 'DORA\'s Accelerate research shows teams practicing "you build it, you run it" consistently outperform on all four key delivery metrics.',
      },
      {
        id: 'ybyr-h2',
        difficulty: 'hard',
        question: 'What is the main risk of adopting "you build it, you run it" without a supporting Platform team?',
        choices: [
          'Developers become too specialized in one area',
          'Cognitive overload — every team must also master Kubernetes, tracing and incident response',
          'Code reviews become mandatory',
          'Services are deployed too infrequently',
        ],
        correctIndex: 1,
        explanation: 'Without a "thinnest viable platform" to reduce cognitive load, full ownership can crush product teams — Team Topologies pairs the two patterns deliberately.',
      },
      {
        id: 'ybyr-h3',
        difficulty: 'hard',
        question: 'Which complementary practice is NOT typically listed alongside "you build it, you run it"?',
        choices: [
          'Blameless post-mortems and error budgets',
          'Feature flags and progressive (canary / blue-green) deployment',
          'Production-grade observability built in from day one',
          'Quarterly "big bang" release windows managed by a change board',
        ],
        correctIndex: 3,
        explanation: 'Quarterly change-board releases are the opposite pattern — they recreate the dev/ops wall the principle is designed to remove.',
      },
      // ---- EASY (additional) ----
      {
        id: 'ybyr-e4',
        difficulty: 'easy',
        question: 'In what year did Werner Vogels describe "You build it, you run it" in ACM Queue?',
        choices: ['1998', '2002', '2006', '2010'],
        correctIndex: 2,
        explanation: 'Werner Vogels described the approach in a 2006 ACM Queue interview about how AWS teams operate.',
      },
      {
        id: 'ybyr-e5',
        difficulty: 'easy',
        question: '"You build it, you run it" is primarily about closing which gap?',
        choices: [
          'The gap between frontend and backend teams',
          'The gap between developers and the operational reality of their software',
          'The gap between senior and junior engineers',
          'The gap between engineering and HR',
        ],
        correctIndex: 1,
        explanation: 'The principle closes the loop between writing software and operating it in production \u2014 making developers feel the consequences of their own decisions.',
      },
      {
        id: 'ybyr-e6',
        difficulty: 'easy',
        question: 'Which of these is part of "end-to-end ownership" in "You build it, you run it"?',
        choices: [
          'Only writing and testing the code',
          'Only deploying the code to staging',
          'Design, code, CI/CD, deployment, observability, on-call, and post-incident learning',
          'Writing code and handing it to a separate ops team',
        ],
        correctIndex: 2,
        explanation: 'End-to-end ownership means the team is responsible for the full lifecycle \u2014 from design through to post-incident reviews.',
      },
      {
        id: 'ybyr-e7',
        difficulty: 'easy',
        question: 'What was the key problem with the old "relay race" development model?',
        choices: [
          'It was too fast for organizations to manage',
          'Developers handed code to ops who hadn\'t designed it \u2014 ops couldn\'t diagnose problems; developers didn\'t feel the pain',
          'Ops teams were less skilled than developers',
          'It required too many project managers',
        ],
        correctIndex: 1,
        explanation: 'In the relay race, responsibility was split: devs wrote code they didn\'t run; ops ran code they didn\'t write. Incidents dragged because understanding and accountability were separated.',
      },
      {
        id: 'ybyr-e8',
        difficulty: 'easy',
        question: 'How does "You build it, you run it" improve the quality of technical design?',
        choices: [
          'By requiring more code reviews',
          'By giving developers financial incentives for reliability',
          'When you get paged for your own service\'s failures, you stop shipping code that causes them',
          'By assigning dedicated QA engineers to each team',
        ],
        correctIndex: 2,
        explanation: 'On-call is a powerful design signal: pain caused by your own code motivates you to fix root causes and build reliability in from the start.',
      },
      {
        id: 'ybyr-e9',
        difficulty: 'easy',
        question: 'What skills do developers gain through "You build it, you run it"?',
        choices: [
          'Primarily UI/UX design skills',
          'Deployment, monitoring, and SRE skills that make them stronger engineers',
          'Marketing and sales skills',
          'Project management certifications',
        ],
        correctIndex: 1,
        explanation: 'End-to-end ownership exposes developers to the full operational landscape, growing skills in deployment, observability, and incident response.',
      },
      {
        id: 'ybyr-e10',
        difficulty: 'easy',
        question: 'What does "clear ownership" mean in the context of "You build it, you run it"?',
        choices: [
          'One developer owns all the code',
          'One team is accountable for outcomes, not just outputs',
          'One manager signs off on all changes',
          'One repository per team',
        ],
        correctIndex: 1,
        explanation: 'Clear ownership means one team is accountable end-to-end \u2014 for how the service performs in production, not just whether the code compiles.',
      },
      // ---- MEDIUM (additional) ----
      {
        id: 'ybyr-m4',
        difficulty: 'medium',
        question: 'A team is on-call for their own service and notices the same alert fires every Monday morning. What should they do under "You build it, you run it"?',
        choices: [
          'Accept it as normal maintenance overhead',
          'Escalate to the ops team for investigation',
          'Fix the root cause \u2014 they have both the authority and the motivation to do so',
          'Mute the alert until the next quarter\'s prioritization',
        ],
        correctIndex: 2,
        explanation: 'The on-call rotation is a feedback signal. The team that owns the service is in the best position \u2014 and has the strongest motivation \u2014 to fix root causes, not just escalate.',
      },
      {
        id: 'ybyr-m5',
        difficulty: 'medium',
        question: 'What does "autonomy" specifically mean for a team practicing "You build it, you run it"?',
        choices: [
          'The team works without any coordination with other teams',
          'No tickets to another team, no handoff delays \u2014 the team controls its own deployment decisions',
          'The team has no technical standards to follow',
          'Developers choose their own compensation',
        ],
        correctIndex: 1,
        explanation: 'Autonomy means the team controls its own destiny: no waiting for ops approvals, no handoff queues \u2014 the same people who build can deploy and iterate.',
      },
      {
        id: 'ybyr-m6',
        difficulty: 'medium',
        question: 'Why does "You build it, you run it" lead to "pride of craftsmanship"?',
        choices: [
          'Because teams are evaluated on code quality metrics',
          'Because when you own outcomes end-to-end \u2014 not just outputs \u2014 you care whether the service actually works well in production',
          'Because managers reward quality more under this model',
          'Because the team presents their work to the CEO',
        ],
        correctIndex: 1,
        explanation: 'Owning outcomes means the team sees the full picture including failures. That accountability and visibility restores pride in the quality of the work.',
      },
      {
        id: 'ybyr-m7',
        difficulty: 'medium',
        question: 'Which scenario best illustrates why "You build it, you run it" breaks down WITHOUT platform support?',
        choices: [
          'A team deploys to staging without running tests',
          'A team must also master Kubernetes, distributed tracing, and incident response simultaneously \u2014 leaving no capacity for product work',
          'A team ships features too infrequently',
          'A team has no QA engineer',
        ],
        correctIndex: 1,
        explanation: 'Without a platform to absorb infrastructure complexity, full ownership becomes cognitive overload \u2014 defeating the purpose of the principle.',
      },
      {
        id: 'ybyr-m8',
        difficulty: 'medium',
        question: 'How does "You build it, you run it" change the relationship between code quality and developer incentives?',
        choices: [
          'Code quality becomes a management concern only',
          'Developers are paid more for reliable code',
          'Poor reliability means worse on-call for the authors, so reliability becomes a first-class design goal from the start',
          'Quality gates are enforced entirely by the build system',
        ],
        correctIndex: 2,
        explanation: 'Unlike the relay-race model where devs never feel production pain, YBYR makes poor reliability personally painful for its authors \u2014 aligning incentives powerfully.',
      },
      {
        id: 'ybyr-m9',
        difficulty: 'medium',
        question: 'What does "pager fatigue" refer to, and why is it a risk under "You build it, you run it"?',
        choices: [
          'Fatigue from carrying heavy physical pagers',
          'Burnout caused by excessive on-call alerts without good tooling or rotation \u2014 unsustainable over time',
          'Alert desensitization from too many monitoring dashboards',
          'Developers refusing to participate in on-call at all',
        ],
        correctIndex: 1,
        explanation: 'Pager fatigue occurs when on-call becomes a constant burden \u2014 poor alert hygiene, no follow-the-sun rotation, and insufficient tooling turn ownership into punishment.',
      },
      {
        id: 'ybyr-m10',
        difficulty: 'medium',
        question: 'The info content says YBYR is "less a process than a feedback loop." What does this mean?',
        choices: [
          'It cannot be documented or standardized',
          'The value isn\'t in the process steps but in the continuous signal flowing from operational reality back to design decisions',
          'Feedback loops require automated testing only',
          'It means retrospectives are more important than releases',
        ],
        correctIndex: 1,
        explanation: 'The insight is that YBYR\'s value is systemic: every architectural decision receives an operational signal, and that continuous feedback transforms how teams think and design.',
      },
      // ---- HARD (additional) ----
      {
        id: 'ybyr-h4',
        difficulty: 'hard',
        question: 'Which of the four DORA metrics specifically measures the time from code commit to running in production?',
        choices: [
          'Deployment frequency',
          'Lead time for changes',
          'Change failure rate',
          'Mean Time to Restore (MTTR)',
        ],
        correctIndex: 1,
        explanation: 'Lead time for changes measures the elapsed time between committing code and that code running in production \u2014 a key indicator of delivery efficiency.',
      },
      {
        id: 'ybyr-h5',
        difficulty: 'hard',
        question: 'The deep dive describes "unclear boundaries" as a failure mode. Why does a shared monolith with no ownership lines cause this?',
        choices: [
          'Monoliths are inherently unreliable',
          'No team has a clear boundary, so production problems become "no-one\'s problem" \u2014 everyone is accountable, so no-one is',
          'Monoliths cannot be deployed independently',
          'Shared code always has slower test suites',
        ],
        correctIndex: 1,
        explanation: 'YBYR requires clear service boundaries. Without them, ownership is diffuse \u2014 the on-call question "who\'s responsible?" has no answer, and incidents drag on.',
      },
      {
        id: 'ybyr-h6',
        difficulty: 'hard',
        question: 'According to the deep dive, how is a well-run on-call rotation different from a punishment?',
        choices: [
          'Well-run on-call pays more per alert',
          'It is the signal that drives design improvement \u2014 repeated alerts give the team both the motivation and authority to fix root causes',
          'It involves fewer alerts by design',
          'It runs only during business hours',
        ],
        correctIndex: 1,
        explanation: 'On-call is a feedback mechanism: each page is information about a design flaw the team is uniquely positioned to fix. Handled well, it continuously improves the system.',
      },
      {
        id: 'ybyr-h7',
        difficulty: 'hard',
        question: 'The deep dive lists "feature flags" as a complementary practice. What specific risk do feature flags help manage?',
        choices: [
          'They reduce the total number of features shipped',
          'They allow teams to release code to production while controlling exposure \u2014 reducing blast radius if something goes wrong',
          'They replace automated testing',
          'They prevent the need for rollbacks entirely',
        ],
        correctIndex: 1,
        explanation: 'Feature flags decouple deployment from release \u2014 code goes to production (fast feedback) while only being exposed to a subset of users, limiting risk.',
      },
      {
        id: 'ybyr-h8',
        difficulty: 'hard',
        question: 'The deep dive says YBYR is the "cultural foundation of DevOps." What does "cultural foundation" mean here?',
        choices: [
          'DevOps is a culture created by Werner Vogels',
          'YBYR embodies the values and mindset that DevOps practices are built on \u2014 ownership, feedback, and shared accountability between build and run',
          'YBYR requires a specific DevOps toolchain to work',
          'DevOps culture is defined by DORA metrics alone',
        ],
        correctIndex: 1,
        explanation: 'YBYR is not a practice or tool \u2014 it\'s the cultural shift that makes DevOps practices meaningful. Without the ownership mindset, tools alone don\'t deliver the benefits.',
      },
      {
        id: 'ybyr-h9',
        difficulty: 'hard',
        question: 'The deep dive says YBYR turns a developer into a "systems thinker." What specific capability does this describe?',
        choices: [
          'Thinking only about distributed systems patterns',
          'Understanding that every architectural decision has operational consequences, and designing with both in mind',
          'Learning Kubernetes and observability tools',
          'Managing a team as well as writing code',
        ],
        correctIndex: 1,
        explanation: 'A systems thinker understands the full feedback loop: design choices become operational realities, and operational pain is a signal about design flaws.',
      },
      {
        id: 'ybyr-h10',
        difficulty: 'hard',
        question: 'Progressive deployment (canary / blue-green) is listed as complementary to YBYR. What specific problem does it solve?',
        choices: [
          'It automates documentation updates after deployment',
          'It reduces cloud costs through resource sharing',
          'It allows teams to validate changes in production incrementally before full rollout \u2014 reducing change failure rate',
          'It replaces the need for a staging environment entirely',
        ],
        correctIndex: 2,
        explanation: 'Progressive deployment reduces risk by limiting blast radius: a canary rollout exposes a small percentage of traffic to the new version before full release.',
      },
    ],
  },

  /* --------------------------------------------------------- */
  /*  Architecture Team                                         */
  /* --------------------------------------------------------- */
  'architecture-team': {
    infoId: 'architecture-team',
    questions: [
      {
        id: 'at-e1',
        difficulty: 'easy',
        question: 'Which of these best describes what an architecture team primarily does?',
        choices: [
          'Writes the majority of the production code',
          'Helps other teams make better decisions',
          'Approves every pull request in the company',
          'Picks the programming language for every project',
        ],
        correctIndex: 1,
        explanation: 'A healthy architecture team amplifies other teams — guiding, connecting, and translating — rather than shipping the product themselves.',
      },
      {
        id: 'at-e2',
        difficulty: 'easy',
        question: 'According to Gregor Hohpe, architects should sell ___ instead of issuing mandates.',
        choices: ['orders', 'options', 'diagrams', 'roadmaps'],
        correctIndex: 1,
        explanation: 'Hohpe\'s phrase "sell options, don\'t issue mandates" captures the idea that architects preserve flexibility by deferring commitments until they\'re necessary.',
      },
      {
        id: 'at-e3',
        difficulty: 'easy',
        question: 'Which is NOT a typical role of the architecture team?',
        choices: [
          'Connector between teams working on overlapping problems',
          'Steward of cross-cutting concerns like security and reliability',
          'Single approver of every tech choice in the company',
          'Translator between business strategy and engineering',
        ],
        correctIndex: 2,
        explanation: 'Architects guide and connect; they do not centralise all decisions. Empowering teams to decide is the point.',
      },

      {
        id: 'at-m1',
        difficulty: 'medium',
        question: 'In Hohpe\'s framing, what is the "strike price" of an architectural option?',
        choices: [
          'The cost to start a new project',
          'The rework cost to change course later',
          'The licence fee of the chosen technology',
          'The time spent in design meetings',
        ],
        correctIndex: 1,
        explanation: 'The "strike price" is the cost of exercising the option — i.e. how expensive it is to switch later. Good architects keep it bounded.',
      },
      {
        id: 'at-m2',
        difficulty: 'medium',
        question: 'Why do mandates from an architecture team often fail in practice?',
        choices: [
          'Teams secretly dislike the architects',
          'Mandates commit the organisation before the commitment is needed, and are often ignored or worked around',
          'Mandates are always technically wrong',
          'Mandates violate open-source licences',
        ],
        correctIndex: 1,
        explanation: 'Premature commitment removes flexibility; teams routing around mandates is a symptom, not the cause.',
      },
      {
        id: 'at-m3',
        difficulty: 'medium',
        question: 'An architect notices two teams are independently building almost the same service. The best first action is to:',
        choices: [
          'Order one of the teams to stop immediately',
          'Connect the two teams and surface the overlap so they can decide together',
          'Build a third version themselves',
          'Ignore it — team autonomy is sacred',
        ],
        correctIndex: 1,
        explanation: 'Connecting teams is a core architecture-team function. Mandates would override autonomy; ignoring it wastes organisational effort.',
      },

      {
        id: 'at-h1',
        difficulty: 'hard',
        question: 'Which book by Gregor Hohpe popularised the "Architecture Elevator" metaphor?',
        choices: [
          '"Release It!"',
          '"The Software Architect Elevator"',
          '"Domain-Driven Design"',
          '"Accelerate"',
        ],
        correctIndex: 1,
        explanation: 'Hohpe\'s "The Software Architect Elevator" frames the architect\'s job as riding between penthouse (strategy) and engine room (technology).',
      },
      {
        id: 'at-h2',
        difficulty: 'hard',
        question: 'What does it mean for an architectural option to "expire"?',
        choices: [
          'The licence of a chosen technology runs out',
          'The moment the decision stops being cheap to defer — external pressure forces a commitment',
          'A new architect takes over and cancels it',
          'The option moves to a different team',
        ],
        correctIndex: 1,
        explanation: 'Options have an implicit expiry — scale, integration, or deadlines eventually force the decision to be taken. Good architects flag the expiry explicitly.',
      },
      {
        id: 'at-h3',
        difficulty: 'hard',
        question: 'Which statement best captures the architect\'s output in Hohpe\'s model?',
        choices: [
          'The number of architecture diagrams produced',
          'The quality of decisions made by the teams they support',
          'The count of mandates published per quarter',
          'Uptime of production systems',
        ],
        correctIndex: 1,
        explanation: 'Architects are leverage: their value shows up indirectly, in the decisions made by the teams around them.',
      },
      // ---- EASY (additional) ----
      {
        id: 'at-e4',
        difficulty: 'easy',
        question: 'What does "selling options" mean for an architect?',
        choices: [
          'Selling software licences to other teams',
          'Deferring irreversible commitments until needed, and making it cheap to change course later',
          'Providing multiple vendor quotes for a purchase',
          'Offering different pricing tiers for cloud services',
        ],
        correctIndex: 1,
        explanation: 'Selling options means keeping decisions flexible \u2014 naming the trigger that will force a commitment rather than deciding prematurely.',
      },
      {
        id: 'at-e5',
        difficulty: 'easy',
        question: 'Which cross-cutting concern is the architecture team typically the steward of?',
        choices: [
          'Individual developer performance reviews',
          'Sprint planning for each product team',
          'Security, reliability, and cost \u2014 concerns that span team boundaries',
          'Recruitment and hiring processes',
        ],
        correctIndex: 2,
        explanation: 'Cross-cutting concerns like security, reliability, and cost are not owned by any one product team \u2014 the architecture team stewards them across the organization.',
      },
      {
        id: 'at-e6',
        difficulty: 'easy',
        question: 'According to Gregor Hohpe, where does an architect\'s value actually show up?',
        choices: [
          'In the number of diagrams they produce',
          'In the quality of decisions made by the teams they support',
          'In the lines of code they contribute',
          'In the number of mandates they publish',
        ],
        correctIndex: 1,
        explanation: 'Architects work as leverage \u2014 their impact is indirect, appearing in the quality and speed of decisions made by the teams they guide and connect.',
      },
      {
        id: 'at-e7',
        difficulty: 'easy',
        question: 'What is the GUIDE role of the architecture team?',
        choices: [
          'Directing teams with binding technical decisions',
          'Helping teams see trade-offs and options they might otherwise miss',
          'Approving all technical choices before implementation',
          'Managing the backlog of all technical tasks',
        ],
        correctIndex: 1,
        explanation: 'The guide role is about expanding teams\' awareness of options and trade-offs \u2014 not directing, but illuminating so teams can decide well.',
      },
      {
        id: 'at-e8',
        difficulty: 'easy',
        question: 'What is the CONNECTOR role of the architecture team?',
        choices: [
          'Connecting cloud infrastructure components',
          'Linking teams working on overlapping problems so they can coordinate and learn from each other',
          'Connecting developers to job opportunities',
          'Connecting business to vendor contracts',
        ],
        correctIndex: 1,
        explanation: 'Connectors reduce duplicated effort and missed synergies by making sure teams with overlapping problems find each other.',
      },
      {
        id: 'at-e9',
        difficulty: 'easy',
        question: 'What does the architecture team\'s TRANSLATOR role involve?',
        choices: [
          'Translating technical documentation into other languages',
          'Bridging business strategy and engineering \u2014 converting between their different vocabularies',
          'Translating user requirements into wireframes',
          'Converting code from one programming language to another',
        ],
        correctIndex: 1,
        explanation: 'Translation is a core architect skill: business and engineering speak different languages; the architecture team makes each comprehensible to the other.',
      },
      {
        id: 'at-e10',
        difficulty: 'easy',
        question: 'Which of these is something a healthy architecture team does NOT do?',
        choices: [
          'Help teams understand trade-offs',
          'Connect teams with overlapping concerns',
          'Own all technology decisions centrally for the organization',
          'Bridge business strategy and engineering',
        ],
        correctIndex: 2,
        explanation: 'Centralizing all technology decisions defeats the purpose \u2014 it recreates the ivory tower. A healthy architecture team empowers teams to decide, not replaces their judgment.',
      },
      // ---- MEDIUM (additional) ----
      {
        id: 'at-m4',
        difficulty: 'medium',
        question: 'An architect tells a team "you don\'t need to choose your message broker yet \u2014 but when you hit 10 k events/sec, that decision cannot wait." Which principle is this?',
        choices: [
          'Issuing a mandate about message broker selection',
          'Selling an option \u2014 naming the trigger that will force a commitment while deferring it until needed',
          'Suggesting the team should ignore the problem',
          'Over-engineering by planning for 10 k events/sec immediately',
        ],
        correctIndex: 1,
        explanation: 'Naming the trigger ("at 10 k events/sec") and the action ("you must decide") is how architects keep options alive without making premature commitments.',
      },
      {
        id: 'at-m5',
        difficulty: 'medium',
        question: 'Why do architecture team mandates "often get ignored or worked around," according to Hohpe?',
        choices: [
          'Teams are lazy or disrespectful of authority',
          'Mandates commit before the commitment is needed and remove flexibility, so teams route around them when they cause friction',
          'Mandates are always technically wrong',
          'Teams prefer to make decisions themselves for ego reasons',
        ],
        correctIndex: 1,
        explanation: 'When a mandate removes genuinely needed flexibility, teams find workarounds. The issue is premature commitment, not team culture.',
      },
      {
        id: 'at-m6',
        difficulty: 'medium',
        question: 'What does "the team writes the code; the architect keeps the option space alive" mean in practice?',
        choices: [
          'Architects refuse to take any implementation responsibility',
          'Architects focus on maintaining flexibility and pointing out consequences while teams make day-to-day implementation decisions',
          'Architects review all code before merge',
          'Teams don\'t need architects if they write good code',
        ],
        correctIndex: 1,
        explanation: 'Division of labour: teams deliver features; architects ensure the decisions those features depend on are made at the right time with full information.',
      },
      {
        id: 'at-m7',
        difficulty: 'medium',
        question: 'Two teams are independently building near-identical customer notification services. The architecture team\'s best first action is to:',
        choices: [
          'Order one team to stop building immediately',
          'Build a third shared notification service themselves',
          'Connect the two teams to surface the overlap and let them decide together how to align',
          'Ignore it \u2014 team autonomy is more important than efficiency',
        ],
        correctIndex: 2,
        explanation: 'The connector role surfaces overlaps. Letting teams see each other\'s work and decide for themselves preserves autonomy while eliminating blind duplication.',
      },
      {
        id: 'at-m8',
        difficulty: 'medium',
        question: 'In Hohpe\'s framing, what is the "expiry" of an architectural option?',
        choices: [
          'The moment the software license expires',
          'The moment the decision becomes too expensive to defer \u2014 scale, integrations, or deadlines force a commitment',
          'When the architect leaves the organization',
          'When a new technology makes the old choice obsolete automatically',
        ],
        correctIndex: 1,
        explanation: 'Options have an implicit expiry: conditions that make the decision unavoidable. Good architects name this trigger explicitly so teams aren\'t surprised.',
      },
      {
        id: 'at-m9',
        difficulty: 'medium',
        question: 'A team asks "which database should we use?" The architect responds by presenting three options with trade-offs and the conditions under which each is optimal. This is an example of:',
        choices: [
          'Passing the buck to the team',
          'Selling options \u2014 helping the team make a well-informed decision rather than imposing one choice',
          'Avoiding commitment irresponsibly',
          'Being indecisive under pressure',
        ],
        correctIndex: 1,
        explanation: 'Presenting options with trade-offs enables an informed decision by the team closest to the problem \u2014 rather than imposing a potentially premature commitment.',
      },
      {
        id: 'at-m10',
        difficulty: 'medium',
        question: 'What makes an architectural option different from simple indecision?',
        choices: [
          'They look identical from the outside',
          'An option is an explicit, named flexibility with a known trigger and bounded cost to exercise; indecision is an unmanaged unknown',
          'Options are written down; indecision isn\'t',
          'Options always involve financial instruments',
        ],
        correctIndex: 1,
        explanation: 'Managing options means explicitly tracking what can be deferred, when it must be decided, and what it will cost to change \u2014 indecision is the absence of that management.',
      },
      // ---- HARD (additional) ----
      {
        id: 'at-h4',
        difficulty: 'hard',
        question: 'In Hohpe\'s finance analogy, the "strike price" of an architectural option is the cost to:',
        choices: [
          'Buy a software licence',
          'Change course later \u2014 the rework cost if the deferred decision is eventually exercised',
          'Start a new project from scratch',
          'Hire an architect to make the decision',
        ],
        correctIndex: 1,
        explanation: 'The strike price is what you pay when you exercise the option: the rework cost of switching course. Good architects keep it bounded and known.',
      },
      {
        id: 'at-h5',
        difficulty: 'hard',
        question: 'Hohpe\'s deep dive says architects "work to keep options cheap to exercise." What does this mean concretely?',
        choices: [
          'Buy cheap software licences up front',
          'Design systems so that switching a key component later doesn\'t require a massive rewrite',
          'Avoid all irreversible decisions permanently',
          'Hire cheaper developers who are more flexible',
        ],
        correctIndex: 1,
        explanation: 'Keeping options cheap means reducing coupling and designing for replaceability \u2014 so when the trigger fires, exercising the option doesn\'t break everything.',
      },
      {
        id: 'at-h6',
        difficulty: 'hard',
        question: '"Architects collaborate with rather than command teams." According to the deep dive, why is this more effective?',
        choices: [
          'It avoids HR complaints about workplace culture',
          'Command-and-control architecture produces mandates teams route around; collaboration produces informed decisions teams own and execute',
          'Collaboration is always faster than issuing mandates',
          'Teams are always more technically competent than architects',
        ],
        correctIndex: 1,
        explanation: 'Mandates that bypass team buy-in get ignored or worked around. Options and informed guidance produce decisions teams own and execute well.',
      },
      {
        id: 'at-h7',
        difficulty: 'hard',
        question: 'Which paper, linked in the architecture-team info content, asks "Who Needs an Architect?"',
        choices: [
          'A paper by Kent Beck',
          'A paper by Martin Fowler',
          'A paper by Gregor Hohpe',
          'A paper by Sam Newman',
        ],
        correctIndex: 1,
        explanation: 'Martin Fowler\'s "Who Needs an Architect?" challenges and reframes what architects actually do in modern software development.',
      },
      {
        id: 'at-h8',
        difficulty: 'hard',
        question: 'According to Hohpe\'s options framing, why is it valuable to explicitly name the trigger that forces a decision?',
        choices: [
          'It gives architects credit for predicting the future',
          'It prevents teams from deciding too early (before needed) or too late (surprise rework cost)',
          'It satisfies audit requirements',
          'It allows decisions to be automated',
        ],
        correctIndex: 1,
        explanation: 'Naming the trigger prevents both under- and over-committing. Teams know exactly when they must decide, so they can prepare without premature optimization.',
      },
      {
        id: 'at-h9',
        difficulty: 'hard',
        question: 'An option has a "strike price" of six months of rework. The trigger is "when we integrate with System X." What should the architect do?',
        choices: [
          'Make the integration decision now to avoid the rework cost',
          'Defer the decision until integration with System X becomes a real requirement, then decide with full information',
          'Avoid integrating with System X entirely to preserve the option indefinitely',
          'Delegate the decision to the team with no further tracking',
        ],
        correctIndex: 1,
        explanation: 'Defer until the trigger fires. Deciding before the trigger wastes optionality; ignoring the trigger risks a surprise commitment cost when it arrives.',
      },
      {
        id: 'at-h10',
        difficulty: 'hard',
        question: 'The deep dive says the architect\'s job is to ensure "the cost of changing course later is bounded." What happens when this is neglected?',
        choices: [
          'Architecture diagrams become outdated',
          'Decisions are made with hidden costs \u2014 the rework price of reversing them is unknown and potentially enormous',
          'Teams gain too much flexibility',
          'Architects lose influence over time',
        ],
        correctIndex: 1,
        explanation: 'Unbounded rework cost is the architectural equivalent of unmanaged debt: invisible until it must be paid, and potentially existential when it arrives.',
      },
    ],
  },

  /* --------------------------------------------------------- */
  /*  C4 Model                                                  */
  /* --------------------------------------------------------- */
  'c4-diagrams': {
    infoId: 'c4-diagrams',
    questions: [
      {
        id: 'c4-e1',
        difficulty: 'easy',
        question: 'Who created the C4 model?',
        choices: ['Martin Fowler', 'Simon Brown', 'Eric Evans', 'Gregor Hohpe'],
        correctIndex: 1,
        explanation: 'Simon Brown created C4 as a lightweight way to describe software architecture at different levels of abstraction.',
      },
      {
        id: 'c4-e2',
        difficulty: 'easy',
        question: 'What are the four levels of the C4 model, from highest to lowest?',
        choices: [
          'Class, Container, Component, Context',
          'Context, Container, Component, Code',
          'Code, Component, Container, Context',
          'System, Service, Module, Method',
        ],
        correctIndex: 1,
        explanation: 'Context → Containers → Components → Code. Each step zooms in one level.',
      },
      {
        id: 'c4-e3',
        difficulty: 'easy',
        question: 'In C4, a "container" is best described as:',
        choices: [
          'A Docker container, specifically',
          'A deployable or executable unit (app, service, database)',
          'A UML package',
          'A folder on disk',
        ],
        correctIndex: 1,
        explanation: 'A C4 container is simply "a thing that runs" — a web app, a SPA, a job, or a database are all containers. Not specifically Docker.',
      },

      {
        id: 'c4-m1',
        difficulty: 'medium',
        question: 'Most teams using C4 day-to-day rely on which diagrams most often?',
        choices: [
          'Only the Code level',
          'The Context and Container diagrams',
          'All four levels equally',
          'Component and Code only',
        ],
        correctIndex: 1,
        explanation: 'Context and Container diagrams answer most conversations. Component is occasional; Code is usually skipped.',
      },
      {
        id: 'c4-m2',
        difficulty: 'medium',
        question: 'Which statement is TRUE about C4 notation?',
        choices: [
          'C4 is a strict UML profile',
          'C4 favours plain readability over formal notation; a legend explains colours and shapes',
          'C4 requires at least ten shape types per diagram',
          'C4 diagrams must be drawn in Visio',
        ],
        correctIndex: 1,
        explanation: 'C4 is deliberately NOT UML — it trades formality for readability. A simple legend is enough.',
      },
      {
        id: 'c4-m3',
        difficulty: 'medium',
        question: 'What problem do "diagrams as code" tools like Structurizr solve for C4 adoption?',
        choices: [
          'They replace the need for any diagrams at all',
          'They keep diagrams version-controlled and regenerable from a single source, so they don\'t silently rot',
          'They make diagrams harder to share',
          'They remove the need for a legend',
        ],
        correctIndex: 1,
        explanation: 'Diagrams-as-code puts the diagram in the repo, tied to the code, so it stays current instead of going stale in a wiki.',
      },

      {
        id: 'c4-h1',
        difficulty: 'hard',
        question: 'A common C4 mistake is to assume a container is:',
        choices: [
          'Always a microservice',
          'The same as a UML class',
          'A single source file',
          'An AWS EC2 instance',
        ],
        correctIndex: 0,
        explanation: 'Beginners often equate "container" with "microservice". A container is any deployable unit — mobile apps, SPAs, databases, and batch jobs all qualify.',
      },
      {
        id: 'c4-h2',
        difficulty: 'hard',
        question: 'Which C4 level is most useful for explaining the system to a NON-technical stakeholder?',
        choices: ['Code', 'Component', 'Container', 'Context'],
        correctIndex: 3,
        explanation: 'Context treats the system as a black box surrounded by people and external systems — the clearest view for business stakeholders.',
      },
      {
        id: 'c4-h3',
        difficulty: 'hard',
        question: 'What is the main purpose of the "Code" level in C4, and why is it often skipped?',
        choices: [
          'To replace unit tests; it\'s skipped because tests suffice',
          'To show classes/interfaces inside a component; it\'s skipped because IDEs already generate this on demand',
          'To produce deployment diagrams; it\'s skipped because operations owns those',
          'To act as a legal record of the architecture',
        ],
        correctIndex: 1,
        explanation: 'Code-level diagrams duplicate what modern IDEs show at a click. C4 recommends skipping them unless genuinely helpful.',
      },
    ],
  },

  /* --------------------------------------------------------- */
  /*  Vertical Slice Architecture                               */
  /* --------------------------------------------------------- */
  'vertical-slice-architecture': {
    infoId: 'vertical-slice-architecture',
    questions: [
      {
        id: 'vsa-e1',
        difficulty: 'easy',
        question: 'Vertical Slice Architecture organises code primarily by:',
        choices: ['Technical layer', 'Feature', 'Team', 'Programming language'],
        correctIndex: 1,
        explanation: 'Each slice contains everything one feature needs — HTTP, validation, business logic, persistence — in one place.',
      },
      {
        id: 'vsa-e2',
        difficulty: 'easy',
        question: 'Who popularised Vertical Slice Architecture?',
        choices: ['Eric Evans', 'Jimmy Bogard', 'Kent Beck', 'Uncle Bob'],
        correctIndex: 1,
        explanation: 'Jimmy Bogard (author of MediatR and AutoMapper) wrote the seminal posts on vertical slices.',
      },
      {
        id: 'vsa-e3',
        difficulty: 'easy',
        question: 'In a traditional n-layer architecture, changing one feature typically means editing:',
        choices: [
          'A single file',
          'One folder',
          'Multiple files across multiple layer folders (Controllers, Services, Repositories, etc.)',
          'Only the database',
        ],
        correctIndex: 2,
        explanation: 'Horizontal layering spreads one feature across every layer — vertical slices collapse that into a single folder.',
      },

      {
        id: 'vsa-m1',
        difficulty: 'medium',
        question: 'Which of these is a real trade-off of Vertical Slice Architecture?',
        choices: [
          'It cannot be tested',
          'Some code that would be shared in an n-layer design ends up duplicated across slices',
          'It only works in Java',
          'It removes the need for a database',
        ],
        correctIndex: 1,
        explanation: 'Vertical slices intentionally accept some duplication to avoid the wrong shared abstraction. "A little duplication is cheaper than the wrong coupling."',
      },
      {
        id: 'vsa-m2',
        difficulty: 'medium',
        question: 'Vertical slices pair naturally with which pattern?',
        choices: [
          'Singleton everywhere',
          'CQRS — separate Command and Query handlers',
          'Global mutable state',
          'Inheritance over composition',
        ],
        correctIndex: 1,
        explanation: 'Each slice is typically one command or one query handler — a CQRS-shaped unit of behaviour.',
      },
      {
        id: 'vsa-m3',
        difficulty: 'medium',
        question: 'In vertical-slice parlance, what is meant by "tailored design per slice"?',
        choices: [
          'Each slice must use a different framework',
          'Simple features stay simple; complex ones can add layers only where those layers genuinely help',
          'Each slice needs its own database',
          'Only senior developers can design a slice',
        ],
        correctIndex: 1,
        explanation: 'Vertical slices free you from forcing every feature through the same layered template. Design complexity goes where it earns its keep.',
      },

      {
        id: 'vsa-h1',
        difficulty: 'hard',
        question: 'Why is CreateInvoice able to use a totally different design (e.g. event-sourced) from VoidInvoice in a vertical-slice codebase?',
        choices: [
          'Because the compiler enforces it',
          'Because the two slices are independent — they do not share a central Service<Invoice> that couples them',
          'Because Jimmy Bogard requires it',
          'Because they use different programming languages',
        ],
        correctIndex: 1,
        explanation: 'Independence is the point: each slice is free to pick the design best suited to its feature, since slices don\'t funnel through a shared service layer.',
      },
      {
        id: 'vsa-h2',
        difficulty: 'hard',
        question: 'Vertical Slice Architecture echoes which idea from Uncle Bob?',
        choices: [
          'The Repository Pattern',
          'Screaming Architecture — the folder structure should scream what the system DOES, not what framework it uses',
          'Dependency Injection as a religion',
          'The Open/Closed Principle',
        ],
        correctIndex: 1,
        explanation: 'Screaming Architecture: a new joiner reading the top-level folders should see "CreateInvoice, SendReceipt, RefundOrder" — the business — not "Controllers, Services, Repos".',
      },
      {
        id: 'vsa-h3',
        difficulty: 'hard',
        question: 'What is the relationship between vertical slices and MediatR-style "request/handler" libraries?',
        choices: [
          'MediatR is required by the vertical-slice pattern',
          'MediatR (or equivalents) provide a clean way to pipe one request to one handler, matching the one-slice-one-feature shape',
          'Vertical slices are only legal in C#',
          'MediatR forces horizontal layering',
        ],
        correctIndex: 1,
        explanation: 'MediatR\'s request→handler mapping naturally expresses "one feature, one handler", making vertical slices easy to implement.',
      },
    ],
  },

  /* --------------------------------------------------------- */
  /*  Architecture Decision Records                             */
  /* --------------------------------------------------------- */
  'architecture-decision-records': {
    infoId: 'architecture-decision-records',
    questions: [
      // ---- EASY ----
      {
        id: 'adr-e1',
        difficulty: 'easy',
        question: 'What does ADR stand for?',
        choices: [
          'Application Deployment Record',
          'Architecture Decision Record',
          'Automated Data Recovery',
          'Agile Delivery Roadmap',
        ],
        correctIndex: 1,
        explanation: 'ADR stands for Architecture Decision Record — a short, numbered document capturing one significant architectural decision.',
      },
      {
        id: 'adr-e2',
        difficulty: 'easy',
        question: 'Where do ADRs typically live?',
        choices: [
          'Only in a shared confluence space nobody reads',
          'In the repository alongside the code (e.g. docs/adr/)',
          'In the architect\'s private notebook',
          'On the company wiki, separate from the code',
        ],
        correctIndex: 1,
        explanation: 'ADRs live next to the code they describe — usually in a docs/adr/ folder — so they\'re version-controlled and reviewed with the same workflow as the code.',
      },
      {
        id: 'adr-e3',
        difficulty: 'easy',
        question: 'Which section of a typical ADR captures "what becomes easier, harder, or riskier" after the decision?',
        choices: [
          'Status',
          'Context',
          'Decision',
          'Consequences',
        ],
        correctIndex: 3,
        explanation: 'The Consequences section is where trade-offs are made explicit — arguably the most valuable part of an ADR for future readers.',
      },

      // ---- MEDIUM ----
      {
        id: 'adr-m1',
        difficulty: 'medium',
        question: 'What should you do when an accepted ADR no longer reflects the chosen architecture?',
        choices: [
          'Edit the original ADR to reflect the new decision',
          'Delete the ADR so it does not confuse readers',
          'Write a new ADR that supersedes it; mark the old one superseded',
          'Move the ADR to an archive folder and start over',
        ],
        correctIndex: 2,
        explanation: 'ADRs are immutable. You write a new ADR that supersedes the old one, preserving the history of why the earlier decision was made.',
      },
      {
        id: 'adr-m2',
        difficulty: 'medium',
        question: 'Which of these is the best scope for a single ADR?',
        choices: [
          'One ADR covering all persistence, messaging, and auth decisions',
          'One ADR per major quarter of work',
          'One ADR per architectural decision',
          'One ADR per microservice',
        ],
        correctIndex: 2,
        explanation: 'Granularity matters: one ADR = one decision. Small, focused ADRs are easier to read, supersede, and search later.',
      },
      {
        id: 'adr-m3',
        difficulty: 'medium',
        question: 'Why are ADRs usually append-only and never edited after acceptance?',
        choices: [
          'File systems make editing hard',
          'To preserve the history of thinking so future teams can understand why decisions were made',
          'Because tooling requires it',
          'To discourage people from ever revisiting decisions',
        ],
        correctIndex: 1,
        explanation: 'Immutability preserves the record of *why* a decision was made at a point in time — critical context when the world changes and a new ADR supersedes it.',
      },

      // ---- HARD ----
      {
        id: 'adr-h1',
        difficulty: 'hard',
        question: 'Who is generally credited with popularizing the lightweight ADR format?',
        choices: [
          'Martin Fowler',
          'Michael Nygard',
          'Gregor Hohpe',
          'Robert C. Martin',
        ],
        correctIndex: 1,
        explanation: 'Michael Nygard proposed lightweight ADRs in his 2011 post "Documenting Architecture Decisions" as an alternative to heavyweight architecture docs.',
      },
      {
        id: 'adr-h2',
        difficulty: 'hard',
        question: 'Which statement best captures why ADRs pair naturally with "You build it, you run it"?',
        choices: [
          'Running systems require fewer decisions than building them',
          'ADRs replace the need for runbooks',
          'The team that owns the system also owns the record of why it is the way it is',
          'Operational teams refuse to take over systems without ADRs',
        ],
        correctIndex: 2,
        explanation: 'Autonomous delivery teams benefit most when the "why" travels with the code — the same people who ship it live with the consequences and write them down.',
      },
      {
        id: 'adr-h3',
        difficulty: 'hard',
        question: 'What is the primary intent of the Status field on an ADR (proposed / accepted / superseded)?',
        choices: [
          'To trigger an approval workflow in a ticket system',
          'To let readers tell at a glance which decisions are current and which are history',
          'To grant the author editing rights',
          'To determine code review ownership',
        ],
        correctIndex: 1,
        explanation: 'Status makes the lifecycle of a decision legible: readers can immediately see whether an ADR represents the current design or a chapter in its history.',
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
