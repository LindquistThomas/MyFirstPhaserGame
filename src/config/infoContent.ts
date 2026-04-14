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
};
