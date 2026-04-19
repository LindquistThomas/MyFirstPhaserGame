import { FLOORS } from '../../../config/gameConfig';
import { InfoPointDef } from '../../../config/info/types';

/** Info points shown in the Platform Team room (floor 1 left). */
export const INFO_PLATFORM: Record<string, InfoPointDef> = {
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
};
