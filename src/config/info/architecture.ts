import { FLOORS } from '../gameConfig';
import { InfoPointDef } from './types';

/** Info points shown in the Architecture Team room (floor 1 right). */
export const INFO_ARCHITECTURE: Record<string, InfoPointDef> = {
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
};
