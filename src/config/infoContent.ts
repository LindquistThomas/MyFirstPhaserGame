import { InfoDialogContent } from '../ui/InfoDialog';
import { FLOORS, FloorId } from './gameConfig';

/**
 * Centralized info point content for all floors.
 *
 * Each entry includes the educational body text, optional external links,
 * and optional extended "deep dive" content that hard quiz questions reference.
 */

export interface InfoPointDef {
  content: InfoDialogContent;
  floorId: FloorId;
}

export const INFO_POINTS: Record<string, InfoPointDef> = {
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

  'platform-engineering': {
    floorId: FLOORS.PLATFORM_TEAM,
    content: {
      id: 'platform-engineering',
      title: 'Platform Engineering',
      body:
        'Platform Engineering is the discipline of building and maintaining ' +
        'an Internal Developer Platform (IDP) \u2014 a self-service layer of ' +
        'tools, services, and workflows that enables development teams to ' +
        'deliver software faster and more reliably.\n\n' +
        'Instead of every team building their own CI/CD pipelines, monitoring ' +
        'stacks, and infrastructure provisioning, a Platform Team creates ' +
        'golden paths \u2014 pre-configured, opinionated workflows that encode ' +
        'best practices while still allowing flexibility.\n\n' +
        'The key principle is "You build it, you run it" combined with ' +
        '"We make running it easy." The platform reduces cognitive load on ' +
        'development teams so they can focus on business logic rather than ' +
        'infrastructure plumbing.',
      links: [
        { label: 'Team Topologies (Book)', url: 'https://teamtopologies.com/' },
        { label: 'Platform Engineering on the CNCF', url: 'https://tag-app-delivery.cncf.io/whitepapers/platforms/' },
        { label: 'What is Platform Engineering?', url: 'https://platformengineering.org/blog/what-is-platform-engineering' },
      ],
      extendedInfo: {
        title: 'Deep Dive: Platform Engineering',
        body:
          'Platform Engineering draws heavily from Team Topologies by Matthew ' +
          'Skelton and Manuel Pais. The book identifies four fundamental team ' +
          'types: Stream-aligned, Enabling, Complicated Subsystem, and Platform.\n\n' +
          'A Platform Team\'s primary interaction mode is "X-as-a-Service" \u2014 they ' +
          'provide capabilities that stream-aligned teams consume with minimal ' +
          'coordination. This reduces the cognitive load on delivery teams.\n\n' +
          'The "Thinnest Viable Platform" (TVP) concept is crucial: start with ' +
          'the smallest platform that provides value. This might be as simple as ' +
          'a wiki page with best-practice documentation, evolving toward self-service ' +
          'APIs and developer portals as needs grow.\n\n' +
          'Key metrics for platform success include: developer onboarding time, ' +
          'time to first deploy, change failure rate, and developer satisfaction ' +
          '(often measured via Developer Experience surveys). A good platform is ' +
          'one that developers voluntarily choose to use.\n\n' +
          'Anti-patterns include: mandating platform use without providing value, ' +
          'building too much too early, and treating the platform as a pure ' +
          'infrastructure concern rather than a product with internal customers.',
      },
    },
  },

  'you-build-you-run': {
    floorId: FLOORS.PLATFORM_TEAM,
    content: {
      id: 'you-build-you-run',
      title: 'You Build It, You Run It',
      body:
        '"You build it, you run it." Amazon CTO Werner Vogels coined this ' +
        'phrase in a 2006 ACM Queue interview to describe how AWS teams work: ' +
        'the developers who write a service also deploy it, monitor it, and ' +
        'carry the pager when it breaks at 3 a.m.\n\n' +
        'The old model was a relay race. Developers threw code "over the wall" ' +
        'to a separate ops team. Ops had to run software they hadn\'t designed, ' +
        'and developers never felt the pain of their own decisions. Incidents ' +
        'dragged on because the people who understood the code weren\'t the ' +
        'people being paged.\n\n' +
        'In a "you build it, you run it" team, that loop closes. The team owns ' +
        'its service end-to-end: design, code, CI/CD, deployment, observability, ' +
        'on-call, and post-incident learning.\n\n' +
        'ADVANTAGES FOR THE DEV TEAM\n' +
        '  \u2022 Fast feedback: production behaviour reaches the authors directly, ' +
        'so bugs get diagnosed by the people who can actually fix them.\n' +
        '  \u2022 Better design: when *you* get paged, you stop shipping code ' +
        'that wakes you up. Reliability becomes a first-class design goal.\n' +
        '  \u2022 Autonomy: no tickets to another team, no hand-off delays. ' +
        'The team decides how to deploy and can ship small changes often.\n' +
        '  \u2022 Clear ownership: one team is accountable for outcomes, not just ' +
        'outputs. Pride of craftsmanship returns.\n' +
        '  \u2022 Skill growth: developers pick up deployment, monitoring, ' +
        'and SRE skills that make them stronger engineers.\n\n' +
        'REAL-WORLD ANALOGY\n' +
        'Think of a restaurant where the chef also works the dining room. When ' +
        'a customer sends a dish back, the chef hears it directly \u2014 not via ' +
        'a complaint form read a week later. The next menu is better because the ' +
        'feedback loop is tight. Compare that to a factory canteen where the cook ' +
        'never meets the diner: flavour drifts, nobody owns the experience, and ' +
        'every problem becomes "someone else\'s department."\n\n' +
        'This is exactly why modern platform teams exist (see the Platform ' +
        'Engineering info point): they make running it *easy* so that ' +
        '"you run it" doesn\'t crush the dev team with cognitive load.',
      links: [
        { label: 'Werner Vogels ACM Queue interview (2006)', url: 'https://queue.acm.org/detail.cfm?id=1142065' },
        { label: 'The DevOps Handbook', url: 'https://itrevolution.com/product/the-devops-handbook-second-edition/' },
        { label: 'Google SRE Book', url: 'https://sre.google/sre-book/table-of-contents/' },
        { label: 'DORA: Accelerate / State of DevOps', url: 'https://dora.dev/' },
      ],
      extendedInfo: {
        title: 'Deep Dive: "You Build It, You Run It"',
        body:
          'The principle is the cultural foundation of DevOps and a core input to ' +
          'the DORA research programme (Accelerate, State of DevOps). Teams that ' +
          'practice end-to-end ownership consistently score higher on the four ' +
          'key metrics: deployment frequency, lead time for changes, change ' +
          'failure rate, and mean time to restore.\n\n' +
          'ON-CALL IS THE FEEDBACK MECHANISM\n' +
          'A well-run on-call rotation is not a punishment \u2014 it\'s the ' +
          'signal that drives design improvement. If the same alert fires every ' +
          'week, the team has both the authority and the motivation to fix the ' +
          'root cause. Contrast with a separate ops team, who can only escalate.\n\n' +
          'WHERE IT BREAKS DOWN\n' +
          '  \u2022 Cognitive overload: asking every product team to also master ' +
          'Kubernetes, tracing, and incident response at once is unrealistic. ' +
          'That\'s why Team Topologies pairs stream-aligned teams with a ' +
          'Platform team that provides a "thinnest viable platform."\n' +
          '  \u2022 Pager fatigue: on-call without good tooling, alert hygiene, ' +
          'or follow-the-sun rotation burns people out.\n' +
          '  \u2022 Unclear boundaries: "you run it" requires a clear service ' +
          'boundary. Shared monoliths with no ownership lines become no-one\'s ' +
          'problem.\n\n' +
          'COMPLEMENTARY PRACTICES\n' +
          'The principle works best alongside: blameless post-mortems, ' +
          'error budgets (SRE), feature flags for safer releases, progressive ' +
          'deployment (canary / blue-green), and production-grade observability ' +
          '(structured logs, metrics, traces) built in from day one.\n\n' +
          'KEY INSIGHT\n' +
          '"You build it, you run it" is less a process than a *feedback loop*. ' +
          'Every architectural decision has an operational consequence; closing ' +
          'the loop between the two is what turns a developer into a systems ' +
          'thinker \u2014 and a team into an owner rather than a vendor.',
      },
    },
  },

  'architecture-team': {
    floorId: FLOORS.PLATFORM_TEAM,
    content: {
      id: 'architecture-team',
      title: 'The Architecture Team',
      body:
        'What does the architecture team actually do? A surprising amount ' +
        'of the job is NOT drawing diagrams or dictating designs — it is ' +
        'helping other teams succeed.\n\n' +
        'Gregor Hohpe puts it this way: "Architects don\'t just solve ' +
        'problems — they help others solve problems, by selling options ' +
        'instead of issuing mandates." An architect\'s value shows up in ' +
        'the quality of decisions other people make.\n\n' +
        'Day-to-day, the architecture team acts as:\n' +
        '  • A guide — helping teams see trade-offs they might miss\n' +
        '  • A connector — linking teams working on overlapping problems\n' +
        '  • A translator — bridging business strategy and engineering\n' +
        '  • A steward — caring for cross-cutting concerns (security,\n' +
        '    reliability, cost) that no single team owns\n\n' +
        'Crucially, architects do NOT:\n' +
        '  • Ship code on behalf of product teams\n' +
        '  • Hand down mandatory "blueprints" from an ivory tower\n' +
        '  • Own all technology decisions centrally\n\n' +
        'A healthy architecture team amplifies the teams around it. ' +
        'Its output is their output — better decisions, faster, with ' +
        'clearer trade-offs.',
      links: [
        { label: 'Gregor Hohpe — "The Software Architect Elevator"', url: 'https://architectelevator.com/book/' },
        { label: 'Gregor Hohpe on selling options, not issuing mandates', url: 'https://architectelevator.com/architecture/selling-options/' },
        { label: 'Martin Fowler — "Who Needs an Architect?"', url: 'https://martinfowler.com/ieeeSoftware/whoNeedsArchitect.pdf' },
      ],
      extendedInfo: {
        title: 'Deep Dive: Sell Options, Don\'t Issue Mandates',
        body:
          'Gregor Hohpe\'s key insight is that architects operate in an ' +
          'environment full of uncertainty. A mandate ("thou shalt use ' +
          'PostgreSQL") commits the organisation before the commit is ' +
          'needed — and is often ignored or worked around.\n\n' +
          'Selling OPTIONS is different. Instead of picking one answer ' +
          'up front, the architect identifies decisions that can be ' +
          'deferred (options), works to keep them cheap to exercise, ' +
          'and names the trigger that should force each choice. Teams ' +
          'stay flexible; the architect\'s job is to make sure the cost ' +
          'of changing course later is bounded.\n\n' +
          'In finance, an option has a strike price and an expiry. In ' +
          'architecture, the "strike price" is the rework cost, and the ' +
          '"expiry" is the moment the decision stops being cheap. Good ' +
          'architects explicitly talk in these terms: "We don\'t need ' +
          'to pick our message broker yet, but if we hit 10k events/sec ' +
          'or cross-team retries, we must decide within a sprint."\n\n' +
          'This framing is why architects collaborate with, rather than ' +
          'command, the teams around them. The teams write the code; the ' +
          'architect keeps the option space alive, points out consequences, ' +
          'and raises the alarm when an option is about to expire.',
      },
    },
  },

  'c4-diagrams': {
    floorId: FLOORS.PLATFORM_TEAM,
    content: {
      id: 'c4-diagrams',
      title: 'The C4 Model',
      body:
        'The C4 model, created by Simon Brown, is a lightweight way to ' +
        'describe software architecture using a hierarchy of diagrams. ' +
        'Each level zooms in one step, so you can start with the big ' +
        'picture and drill down as needed.\n\n' +
        'The four core levels are:\n' +
        '  1. Context — the system as a black box and the people and\n' +
        '     external systems it interacts with\n' +
        '  2. Containers — the high-level deployable/executable units\n' +
        '     (apps, services, databases, message buses)\n' +
        '  3. Components — the building blocks inside a container\n' +
        '     (modules, services, packages)\n' +
        '  4. Code — classes, interfaces (optional; often skipped)\n\n' +
        'The philosophy: "a map of your code, at different zoom levels." ' +
        'Most teams only need the top two diagrams day-to-day. Treat ' +
        'them as living documents, keep them close to the code, and be ' +
        'ruthless about what to leave out.\n\n' +
        'C4 diagrams are deliberately NOT UML. They favour plain ' +
        'readability over formal notation: boxes, arrows, labels, and ' +
        'enough legend that a new joiner can understand them unaided.',
      links: [
        { label: 'c4model.com (Simon Brown)', url: 'https://c4model.com/' },
        { label: 'Structurizr — diagrams-as-code tool', url: 'https://structurizr.com/' },
        { label: 'Simon Brown talk: "Visualise, Document, and Explore"', url: 'https://www.youtube.com/watch?v=x2-rSnhpw0g' },
        { label: 'Norconsult Digital — C4 / Structurizr docs', url: 'https://docs.norconsultdigital.no/architecture/c4_structurizr/' },
        { label: 'Norconsult Digital — software-architecture repo', url: 'https://github.com/norconsult-digital/software-architecture' },
      ],
      extendedInfo: {
        title: 'Deep Dive: Why C4 Works',
        body:
          'Most architecture diagrams fail because they try to say ' +
          'everything on one page. The result is a spider web of boxes ' +
          'no-one can read, that goes stale the day it is drawn.\n\n' +
          'C4 succeeds because of three explicit choices:\n\n' +
          '1. Hierarchical abstraction. Each diagram has ONE job. Context ' +
          'shows "who talks to the system". Container shows "what runs ' +
          'where". Component zooms inside a container. You pick the zoom ' +
          'level that fits the conversation.\n\n' +
          '2. Notation consistency. A "container" is always a deployable ' +
          'unit. An arrow always means "depends on / calls". Colours and ' +
          'shapes are legend-driven, not ad-hoc. A reader learns the ' +
          'notation once and applies it everywhere.\n\n' +
          '3. Living artefacts. Structurizr and PlantUML\'s C4 extension ' +
          'let you write diagrams as code, version them alongside the ' +
          'repo, and regenerate them from the same source of truth. The ' +
          'diagram cannot rot silently when the code changes.\n\n' +
          'A common C4 mistake is to treat containers as microservices. ' +
          'A container is simply "a thing that runs" — a mobile app, a ' +
          'browser SPA, a scheduled job, or a database are all containers. ' +
          'Service boundaries show up at the COMPONENT level, if at all.',
      },
    },
  },

  'vertical-slice-architecture': {
    floorId: FLOORS.PLATFORM_TEAM,
    content: {
      id: 'vertical-slice-architecture',
      title: 'Vertical Slice Architecture',
      body:
        'Vertical Slice Architecture, popularised by Jimmy Bogard, ' +
        'organises code by FEATURE rather than by technical layer. ' +
        'Each slice contains everything that feature needs — HTTP ' +
        'handler, validation, business logic, database access, and ' +
        'response — all in one place.\n\n' +
        'The traditional alternative is a HORIZONTAL ("n-layer") split: ' +
        'Controllers/, Services/, Repositories/, Domain/. Changing a ' +
        'feature means opening four folders and editing four files.\n\n' +
        'Vertical slices invert that. You add "CreateInvoice/" and ' +
        'everything about creating an invoice lives inside: the command, ' +
        'the handler, the validator, the SQL. Unrelated features cannot ' +
        'leak into it, and it cannot leak into them.\n\n' +
        'Key benefits:\n' +
        '  • Change by feature, not by layer — a pull request touches\n' +
        '    one slice, not four\n' +
        '  • High cohesion, low coupling — easier to delete a feature\n' +
        '  • Tailored design per slice — simple features stay simple;\n' +
        '    complex ones can add layers where they actually help\n' +
        '  • Easy to onboard — the folder name tells you what it does\n\n' +
        'The trade-off: some code that would be shared in an n-layer ' +
        'design is duplicated across slices. Vertical slice advocates ' +
        'argue that a little duplication beats the wrong abstraction.',
      links: [
        { label: 'Jimmy Bogard — "Vertical Slice Architecture"', url: 'https://www.jimmybogard.com/vertical-slice-architecture/' },
        { label: 'MediatR (enabling library)', url: 'https://github.com/jbogard/MediatR' },
        { label: 'Derek Comartin — Feature Folders', url: 'https://codeopinion.com/restructuring-to-a-vertical-slice-architecture/' },
      ],
      extendedInfo: {
        title: 'Deep Dive: Why Features Beat Layers',
        body:
          'Horizontal layering (Controllers → Services → Repositories) ' +
          'looks clean on an architecture diagram, but it optimises for ' +
          'the wrong thing: ease of drawing. Day-to-day, developers ' +
          'almost never change "all controllers" or "all repositories" — ' +
          'they change ONE FEATURE. Horizontal layers force that change ' +
          'to ripple through every layer.\n\n' +
          'Vertical slices optimise for the axis of change. The unit of ' +
          'work is a feature, so the unit of code is also a feature. ' +
          'Shared infrastructure (DB context, auth, logging) still ' +
          'exists — but it lives in small, explicit "shared" modules ' +
          'that slices consume, not in giant horizontal layers.\n\n' +
          'Jimmy Bogard\'s insight is about COUPLING. In an n-layer ' +
          'design, Service<Invoice> ends up doing everything any ' +
          'invoice endpoint could ever need. Unrelated features ' +
          'accidentally share state and accidentally constrain each ' +
          'other. With vertical slices, CreateInvoice and VoidInvoice ' +
          'can have completely different designs — one pure CRUD, one ' +
          'event-sourced — because they are independent slices.\n\n' +
          'Vertical slices pair well with CQRS (separate Command and ' +
          'Query handlers) and with the "screaming architecture" idea ' +
          'from Uncle Bob: the folder structure of a vertical-slice ' +
          'system "screams" what the system DOES, not what framework ' +
          'it is built on.',
      },
    },
  },

  'architecture-decision-records': {
    floorId: FLOORS.PLATFORM_TEAM,
    content: {
      id: 'architecture-decision-records',
      title: 'Architecture Decision Records (ADRs)',
      body:
        'An Architecture Decision Record (ADR) is a short document that ' +
        'captures one significant architectural decision — the context, the ' +
        'options considered, the choice made, and its consequences.\n\n' +
        'ADRs live next to the code (usually under docs/adr/) and are ' +
        'numbered, immutable, and append-only. You do not edit an old ADR ' +
        'when circumstances change; you write a new one that supersedes it.\n\n' +
        'A typical ADR is one page and follows a simple template:\n' +
        '  • Status  — proposed / accepted / superseded\n' +
        '  • Context — the forces in play that made this decision necessary\n' +
        '  • Decision — what you chose, stated clearly\n' +
        '  • Consequences — what becomes easier, harder, or riskier\n\n' +
        'ADRs solve a real problem: six months after a design choice, no-one ' +
        'remembers why it was made. New joiners re-open old debates. With ' +
        'ADRs, the "why" is written down at the moment of decision, so future ' +
        'teams can understand, re-evaluate, or intentionally replace it.',
      links: [
        { label: 'Michael Nygard — "Documenting Architecture Decisions"', url: 'https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions' },
        { label: 'adr-tools on GitHub', url: 'https://github.com/npryce/adr-tools' },
        { label: 'ThoughtWorks Tech Radar: Lightweight ADRs', url: 'https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records' },
      ],
      extendedInfo: {
        title: 'Deep Dive: ADRs in Practice',
        body:
          'Michael Nygard proposed ADRs in 2011 as a lightweight alternative ' +
          'to heavyweight architecture documents that nobody reads and nobody ' +
          'keeps up to date. The key insights:\n\n' +
          '1. Immutability. An accepted ADR is never edited. If you change ' +
          'your mind, write a new ADR with status "supersedes ADR-0012" and ' +
          'mark the old one "superseded by ADR-0037". The history of your ' +
          'thinking is preserved.\n\n' +
          '2. Consequences matter more than the decision. The "easier / ' +
          'harder / riskier" section is what future readers actually need. ' +
          'Writing it forces you to acknowledge trade-offs instead of ' +
          'pretending you picked a silver bullet.\n\n' +
          '3. Granularity. One ADR = one decision. "We use PostgreSQL" is ' +
          'one ADR. "We use PostgreSQL AND Redis AND Kafka" is three ADRs. ' +
          'Small ADRs are easier to read, easier to supersede, and easier ' +
          'to search for later.\n\n' +
          '4. Who writes them? Anyone making the decision — architect, tech ' +
          'lead, or the team itself. ADRs work best when they are a ' +
          '*working document*, written during the decision meeting, not a ' +
          'retrospective artefact filled in a week later.\n\n' +
          'ADRs pair naturally with "You build it, you run it": the team ' +
          'that owns the system also owns the record of why it is the way it ' +
          'is, and is on the hook when those consequences show up.',
      },
    },
  },

  'cloud-architecture': {
    floorId: FLOORS.CLOUD_TEAM,
    content: {
      id: 'cloud-architecture',
      title: 'Cloud-Native Architecture',
      body:
        'Cloud-native architecture is an approach to building and running ' +
        'applications that fully exploits the advantages of cloud computing: ' +
        'on-demand resources, elasticity, and managed services.\n\n' +
        'The Cloud Native Computing Foundation (CNCF) defines cloud-native ' +
        'technologies as those that empower organizations to build scalable ' +
        'applications in modern environments like public, private, and hybrid ' +
        'clouds using containers, service meshes, microservices, immutable ' +
        'infrastructure, and declarative APIs.\n\n' +
        'A key mindset shift is "design for failure." In the cloud, individual ' +
        'components will fail \u2014 the architecture must ensure the system as ' +
        'a whole remains available. This leads to patterns like circuit breakers, ' +
        'retry with backoff, bulkheads, and graceful degradation.',
      links: [
        { label: 'CNCF Cloud Native Definition', url: 'https://github.com/cncf/toc/blob/main/DEFINITION.md' },
        { label: 'The Twelve-Factor App', url: 'https://12factor.net/' },
        { label: 'Cloud Design Patterns (Microsoft)', url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/' },
      ],
      extendedInfo: {
        title: 'Deep Dive: Cloud-Native Architecture',
        body:
          'The Twelve-Factor App methodology, created by Heroku co-founder Adam ' +
          'Wiggins, provides foundational principles for cloud-native apps:\n\n' +
          '1. Codebase: One codebase tracked in VCS, many deploys\n' +
          '2. Dependencies: Explicitly declare and isolate dependencies\n' +
          '3. Config: Store config in the environment\n' +
          '4. Backing services: Treat them as attached resources\n' +
          '5. Build, release, run: Strictly separate build and run stages\n' +
          '6. Processes: Execute as stateless processes\n' +
          '7. Port binding: Export services via port binding\n' +
          '8. Concurrency: Scale out via the process model\n' +
          '9. Disposability: Maximize robustness with fast startup and graceful shutdown\n' +
          '10. Dev/prod parity: Keep development and production as similar as possible\n' +
          '11. Logs: Treat logs as event streams\n' +
          '12. Admin processes: Run admin tasks as one-off processes\n\n' +
          'Beyond twelve-factor, cloud-native architecture embraces the "cattle ' +
          'not pets" philosophy: servers and containers are disposable and ' +
          'replaceable (cattle), not unique and hand-maintained (pets). This ' +
          'enables immutable infrastructure where updates mean replacing ' +
          'instances rather than patching them in place.\n\n' +
          'The circuit breaker pattern (popularized by Michael Nygard in "Release ' +
          'It!") prevents cascading failures: when a downstream service fails ' +
          'repeatedly, the circuit "opens" and requests fail fast instead of ' +
          'timing out, giving the failing service time to recover.',
      },
    },
  },

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

  'finance': {
    floorId: FLOORS.BUSINESS,
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
