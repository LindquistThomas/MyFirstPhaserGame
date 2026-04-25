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

  'scaling': {
    floorId: FLOORS.PLATFORM_TEAM,
    content: {
      id: 'scaling',
      title: 'Horizontal vs Vertical Scaling',
      body:
        'When a system needs to handle more load, there are two fundamentally ' +
        'different ways to add capacity: make a single machine bigger, or add ' +
        'more machines. Each has very different cost, reliability, and ' +
        'architectural implications.\n\n' +
        'VERTICAL SCALING (scale up)\n' +
        'Replace the existing server with a larger one \u2014 more CPU cores, ' +
        'more RAM, faster disks. It is the simplest approach: the application ' +
        'does not need to change, there is still only one node, and ' +
        'consistency is trivially preserved. The trade-offs are a hard upper ' +
        'bound (even the biggest machine has a ceiling), non-linear cost at ' +
        'the top end, and a single point of failure \u2014 if that one big ' +
        'box goes down, so does the service.\n\n' +
        'HORIZONTAL SCALING (scale out)\n' +
        'Add more servers behind a load balancer and share the work between ' +
        'them. Capacity grows (nearly) linearly with the number of nodes, a ' +
        'single machine failure no longer takes the system down, and commodity ' +
        'hardware is cheaper per unit of work. The cost: the application must ' +
        'be designed for it \u2014 state has to live somewhere shared ' +
        '(database, cache) or be replicated, requests must be routable to ' +
        'any node, and operators now run a cluster rather than a box.\n\n' +
        'WHEN TO USE WHICH\n' +
        '  \u2022 Scale up first for stateful components that are hard to ' +
        'distribute (classic relational databases, legacy monoliths). It is ' +
        'the cheapest way to buy headroom while you plan something better.\n' +
        '  \u2022 Scale out for stateless services, web tiers, and any ' +
        'workload where throughput, redundancy, or cost-per-request matters ' +
        'more than single-node simplicity.\n' +
        '  \u2022 In practice, real systems do both: scale out the stateless ' +
        'tiers, scale up (or shard) the stateful ones.',
      links: [
        { label: 'AWS: Scalability (up vs out)', url: 'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_adapt_to_changes_scale_out.html' },
        { label: 'Martin Kleppmann \u2014 Designing Data-Intensive Applications', url: 'https://dataintensive.net/' },
        { label: 'Google SRE \u2014 Load balancing', url: 'https://sre.google/sre-book/load-balancing-frontend/' },
      ],
      extendedInfo: {
        title: 'Deep Dive: Horizontal vs Vertical Scaling',
        body:
          'THE STATE PROBLEM\n' +
          'The real axis that separates the two approaches is state. A ' +
          'stateless HTTP service scales out almost for free: put a load ' +
          'balancer in front, run N copies, done. A stateful service (a ' +
          'SQL database, an in-memory session store, a WebSocket hub) ' +
          'resists horizontal scaling because requests for the same entity ' +
          'must land on the node that owns its state. That is why people ' +
          'reach for vertical scaling on databases first \u2014 it preserves ' +
          'a single source of truth.\n\n' +
          'SHARDING = HORIZONTAL FOR STATE\n' +
          'When vertical scaling runs out, the usual next step for stateful ' +
          'systems is sharding: partition the data by key (user id, tenant, ' +
          'geography) so that each shard fits on a single node that can ' +
          'still be scaled up. Consistent hashing, range partitioning, and ' +
          'tenant-per-shard are common strategies. Modern "distributed SQL" ' +
          'databases (CockroachDB, Spanner, YugabyteDB) automate this at ' +
          'the cost of additional latency and operational complexity.\n\n' +
          'AUTOSCALING\n' +
          'Horizontal scaling pairs naturally with elastic autoscaling. ' +
          'Kubernetes HPA, AWS Auto Scaling Groups, and serverless ' +
          'concurrency all add nodes when a signal (CPU, queue depth, ' +
          'request rate, p95 latency) crosses a threshold, and remove them ' +
          'when the signal drops. The value shows up on the bill: you pay ' +
          'for peaks, not averages. Vertical scaling rarely autoscales ' +
          'well \u2014 resizing a VM usually means a restart.\n\n' +
          'COST SHAPE\n' +
          'Vertical: cost per unit of work rises as you climb the SKU ' +
          'ladder \u2014 the top instance types are disproportionately ' +
          'expensive. Horizontal: cost per unit of work stays roughly ' +
          'flat, plus a small overhead for the load balancer and ' +
          'coordination. At small scale vertical usually wins; at ' +
          'internet scale horizontal is the only option that fits on ' +
          'the planet.\n\n' +
          'RELIABILITY CONSEQUENCES\n' +
          'A single large box is a single point of failure \u2014 its ' +
          'reliability is bounded by hardware MTBF. A fleet of N smaller ' +
          'boxes behind a load balancer tolerates N-1 failures if the ' +
          'application is truly stateless. This is why "you build it, ' +
          'you run it" teams tend to design for horizontal scaling ' +
          'from day one: the operational story is simpler even before ' +
          'load becomes an issue.\n\n' +
          'CAP AND CONSISTENCY\n' +
          'Going horizontal introduces the CAP trade-off: in the ' +
          'presence of a network partition you must choose between ' +
          'Consistency and Availability. Vertical scaling sidesteps ' +
          'the question by keeping everything on one node \u2014 which ' +
          'is exactly why some systems stay vertical longer than they ' +
          'should.\n\n' +
          'KEY INSIGHT\n' +
          'Vertical scaling buys time. Horizontal scaling buys a future. ' +
          'The architect\'s job is to know where each one belongs and to ' +
          'make the jump from up to out before the business depends on a ' +
          'single box staying alive.',
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

  'rubber-duck-debugging': {
    floorId: FLOORS.PLATFORM_TEAM,
    content: {
      id: 'rubber-duck-debugging',
      title: 'The Rubber Duck',
      body:
        'Quack.\n\n' +
        'Rubber-duck debugging is the practice of explaining your code, line ' +
        'by line, to an inanimate object — classically, a small yellow rubber ' +
        'duck. It sounds absurd. It works surprisingly often.\n\n' +
        'THE SCIENCE-ISH\n' +
        'When you write code you are in execution mode: you know what the ' +
        'code is supposed to do, so your brain helpfully fills in the gaps ' +
        'and skips over inconsistencies. When you explain the code aloud ' +
        'you are forced into narration mode — you must construct a linear ' +
        'description of what each line actually does, not what you intended ' +
        'it to do. That switch in register is often enough to surface the ' +
        'bug yourself, before the duck can say a word.\n\n' +
        'THE PROTOCOL\n' +
        '  1. Pick up the duck (or other silent observer).\n' +
        '  2. Say "I have a problem with my code." The duck listens.\n' +
        '  3. Explain, out loud, what the code is supposed to do.\n' +
        '  4. Explain, out loud, what it actually does, line by line.\n' +
        '  5. Notice where step 3 and step 4 diverge.\n' +
        '  6. Thank the duck. It will not respond. It is a duck.\n\n' +
        'ARCHITECTURAL RUBBER DUCKING\n' +
        'The technique scales beyond debugging. Architects use it to ' +
        'pressure-test designs: explain the system to the duck. If you ' +
        'struggle to articulate why a particular boundary exists, or why ' +
        'service A calls service B instead of the other way around, the ' +
        'design probably needs work — and you found that out before the ' +
        'review, not during it.\n\n' +
        'KEY INSIGHT\n' +
        'The duck does not have to be a duck. It can be a rubber chicken, ' +
        'a houseplant, a carefully chosen commit message, or a well-structured ' +
        'question typed into a chat window you never send. The medium is ' +
        'irrelevant; the articulation is the mechanism. But the duck is ' +
        'funnier, and fun matters.',
    },
  },

  'web-application-firewall': {
    floorId: FLOORS.PLATFORM_TEAM,
    content: {
      id: 'web-application-firewall',
      title: 'Web Application Firewall (WAF)',
      body:
        'A Web Application Firewall inspects HTTP(S) traffic on the way in ' +
        'and blocks requests that match known attack patterns \u2014 SQL ' +
        'injection, cross-site scripting, path traversal, command injection, ' +
        'credential-stuffing bursts, and so on. It sits in front of the app ' +
        '(at the CDN, load balancer, or ingress) and gives platform teams a ' +
        'place to enforce security policy without shipping code in every ' +
        'service.\n\n' +
        'WHY IT IS NECESSARY\n' +
        '  \u2022 Defence in depth. Applications ship vulnerabilities; the ' +
        'WAF is the layer that catches common exploits before they ever ' +
        'reach the service \u2014 especially useful for zero-day patching ' +
        'windows.\n' +
        '  \u2022 Uniform coverage. One rule applied at the edge protects ' +
        'every service behind it, including legacy systems that can\'t be ' +
        'changed quickly.\n' +
        '  \u2022 Compliance & bots. PCI-DSS, regulated industries, and ' +
        'OWASP-aware audits often require WAF-style controls. Rate limits, ' +
        'geo rules, and bot-scoring live here too.\n\n' +
        'THE FALSE-POSITIVE PROBLEM\n' +
        'A WAF\'s rules are heuristic. Patterns that look like SQL injection ' +
        '("OR 1=1") or script tags ("<script>") appear in perfectly ' +
        'legitimate form submissions \u2014 an e-commerce search for a ' +
        'product description, a CMS editor saving rich text, a developer ' +
        'pasting a code snippet into a support form. Block too aggressively ' +
        'and you silently break real user journeys; log-only mode and you ' +
        'miss the actual attacks. The cost of a bad rule is very visible: ' +
        'users get cryptic 403s and the team gets paged by customer ' +
        'support, not by the security stack.\n\n' +
        'WHY IT IS A PLATFORM \u2194 PRODUCT COLLABORATION\n' +
        'A WAF can only be tuned well when someone understands what ' +
        '"normal" looks like for each workload. That knowledge lives with ' +
        'the product team: which fields accept HTML, what the expected ' +
        'request rate is for a given customer segment, which endpoints ' +
        'handle file uploads, where bots are legitimate (partner APIs) and ' +
        'where they are not. The platform team owns the WAF capability \u2014 ' +
        'rule engine, telemetry, change control, incident playbooks \u2014 ' +
        'but the rules themselves are a joint product of both teams. ' +
        'Without that collaboration the WAF either lets attacks through ' +
        '(rules too permissive) or blocks paying customers (rules too ' +
        'strict). Neither outcome is acceptable.',
      links: [
        { label: 'OWASP \u2014 Web Application Firewall', url: 'https://owasp.org/www-community/Web_Application_Firewall' },
        { label: 'OWASP ModSecurity Core Rule Set (CRS)', url: 'https://coreruleset.org/' },
        { label: 'AWS WAF \u2014 Best practices', url: 'https://docs.aws.amazon.com/waf/latest/developerguide/waf-best-practices.html' },
        { label: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' },
      ],
      extendedInfo: {
        title: 'Deep Dive: Tuning a WAF',
        body:
          'DEPLOYMENT MODES\n' +
          'Most WAFs support detect-only (log alerts without blocking) and ' +
          'prevent (block matching requests). Roll new rules out in ' +
          'detect-only first; watch the alert stream for a full traffic ' +
          'cycle (usually at least a week, often a month if there are ' +
          'batch / end-of-month workloads) before enabling prevent mode. ' +
          'Skipping this step is the most common way a WAF takes down its ' +
          'own application.\n\n' +
          'THE RULE-SET TRADE-OFF\n' +
          'Off-the-shelf rule sets like the OWASP Core Rule Set (CRS) are ' +
          'a strong baseline but are deliberately paranoid. Paranoia levels ' +
          '(PL1 \u2192 PL4) trade detection rate against false-positive ' +
          'rate. PL1 is safe to enable; PL3+ almost always needs ' +
          'per-endpoint exceptions. This is where the platform team sits ' +
          'down with product owners to map the real traffic shape.\n\n' +
          'FALSE POSITIVES IN PRACTICE\n' +
          '  \u2022 Rich-text editors: "<script>" and "on*=" attributes look ' +
          'like XSS payloads. Allow-list the editor endpoints or strip ' +
          'before the WAF sees them.\n' +
          '  \u2022 Search boxes: user-entered SQL-keyword-ish text ("or ' +
          'all" / "union jacks") trips SQLi rules. Scope SQLi rules to ' +
          'request paths that actually touch a database.\n' +
          '  \u2022 Bulk APIs: legitimate partner traffic can look like ' +
          'scraping. Authenticated clients should bypass bot-scoring.\n' +
          '  \u2022 File uploads: binary payloads confuse generic rules. ' +
          'Use a dedicated upload endpoint with bypass + scan instead.\n\n' +
          'RULE LIFECYCLE\n' +
          'Treat WAF rules like code: version-controlled, peer-reviewed, ' +
          'rolled out behind feature flags (detect vs prevent, per-route), ' +
          'and measured. Good KPIs: blocked-request count, top-rule hit ' +
          'list, false-positive tickets per week, time-to-mitigate a new ' +
          'CVE via a virtual patch.\n\n' +
          'OBSERVABILITY & FEEDBACK LOOPS\n' +
          'Every block needs a traceable event: request id, rule id, ' +
          'user id (if authenticated), matched field. Surface these to ' +
          'product teams in dashboards they own. When a customer ' +
          'complaint comes in ("I keep getting a 403"), the two teams ' +
          'can correlate in minutes, not days. This is why "you build it, ' +
          'you run it" matters here too: product engineers seeing real ' +
          'WAF blocks on their service learn to write inputs and clients ' +
          'that don\'t look suspicious.\n\n' +
          'LIMITATIONS\n' +
          'A WAF is not a silver bullet. It does not stop business-logic ' +
          'abuse, broken authentication, or attacks that use legitimate ' +
          'API calls in legitimate ways. It is one layer \u2014 pair it ' +
          'with secure coding, SAST/DAST, dependency scanning, bot ' +
          'management, and runtime protection (RASP) for full coverage.\n\n' +
          'KEY INSIGHT\n' +
          'The technology is the easy part. A WAF that truly fits an ' +
          'application only exists when platform and product engineers ' +
          'share the same telemetry, the same language for "normal ' +
          'traffic", and the same on-call for the rules they ship ' +
          'together.',
      },
    },
  },
};
