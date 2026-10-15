/* Lybi — immersive site.
 *
 * Same pages, words and messages as the public site (lybi-website/, Hila & Noa's
 * approved copy — every sentence here is verbatim), told as full-screen scenes.
 * Every scene image carries its section's idea (see ART below); none is decoration.
 * Hash routes like the main site: #/ #/platform #/banking #/health #/trust
 * #/company #/contact #/demo.
 */
(function () {
  'use strict';

  var IMG = '/lybi-site/immersive/img/';
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Why each image is where it is. */
  var ART = {
    'home-hero': 'Countless possible paths, one chosen: a customer making a decision.',
    'blind-spot': 'Ordered process lines dissolving into the organic, hidden shape of a human decision.',
    'conation': 'The missing intelligence: one orb bridging the customer and the organization.',
    'journeys': 'Ready-made routes already laid out: prebuilt Decision Journeys.',
    'platform': 'Layers working together: the architecture of action.',
    'impact': 'A line rising above the horizon: where AI investment meets the top line.',
    'engine-core': 'The Conative Engine at the heart of the platform.',
    'banking': 'A bank built of light: banking-ready Decision Journeys.',
    'health': 'A path that continues out of the doorway: care beyond the appointment.',
    'trust': 'A core inside protective boundaries: your boundaries, built in.',
    'contact': 'Two threads meeting and continuing as one: let’s talk.',
    'founders': 'Three points of light joined into one crew: the three founders behind Lybi.'
  };

  /* ---------- Small builders ---------- */
  function words(text) { return text.split(' ').map(function (w, i) { return '<span class="w" style="--i:' + i + '">' + w + '</span>'; }).join(' '); }
  function title(cls, light, strong, tag) {
    tag = tag || 'h2';
    return '<' + tag + ' class="' + cls + ' wordrise">' + words(light) + (strong ? '<br><em>' + words(strong) + '</em>' : '') + '</' + tag + '>';
  }
  function art(key, alt) {
    return '<div class="scene__art" aria-hidden="true" data-parallax><img src="' + IMG + key + '.jpg" srcset="' + IMG + key + '-sm.jpg 900w, ' + IMG + key + '.jpg 2048w" sizes="100vw" alt="" loading="lazy" data-art-why="' + (ART[key] || '') + '"></div>';
  }
  function scene(id, label, key, inner, mod) {
    return '<section class="scene ' + (mod || '') + '" id="' + id + '" data-label="' + label + '">' + (key ? art(key) : '') + '<div class="scene__in">' + inner + '</div></section>';
  }
  function card(h, p, d, extra) { return '<article class="glass" data-reveal style="--d:' + (d || 0) + '">' + (extra || '') + (h ? '<h3>' + h + '</h3>' : '') + p + '</article>'; }
  var ICON = {
    orchestration: '<rect x="12" y="3" width="8" height="7" rx="1.5"/><path d="M16 10v6M7 21v-5h18v5"/><rect x="3" y="21" width="8" height="8" rx="1.5"/><rect x="21" y="21" width="8" height="8" rx="1.5"/>',
    memory: '<ellipse cx="16" cy="8" rx="11" ry="4"/><path d="M5 8v16c0 5 22 5 22 0V8M5 16c0 5 22 5 22 0"/>',
    control: '<path d="M4 7h5m6 0h13M4 16h15m6 0h3M4 25h7m6 0h11"/><circle cx="12" cy="7" r="3"/><circle cx="22" cy="16" r="3"/><circle cx="14" cy="25" r="3"/>',
    evaluation: '<path d="M4 26h24M5 20l7-7 5 4L27 7M19 7h8v8"/>',
    shield: '<path d="M16 3 27 7v8c0 7-5 11-11 14C10 26 5 22 5 15V7Z"/><path d="m11 15 4 4 7-7"/>',
    check: '<circle cx="16" cy="16" r="12"/><path d="m10 16 4 4 8-8"/>',
    loop: '<circle cx="9" cy="9" r="5"/><circle cx="23" cy="23" r="5"/><path d="M14 9h5a4 4 0 0 1 4 4v5M18 23h-5a4 4 0 0 1-4-4v-5"/>',
    lock: '<rect x="6" y="14" width="20" height="14" rx="3"/><path d="M11 14V10a5 5 0 0 1 10 0v4"/>',
    split: '<rect x="4" y="5" width="10" height="22" rx="2"/><rect x="18" y="5" width="10" height="22" rx="2"/>',
    key: '<circle cx="11" cy="16" r="5"/><path d="M16 16h12m-4 0v5m-4-5v3"/>',
    clock: '<circle cx="16" cy="16" r="12"/><path d="M16 9v7l5 3"/>',
    model: '<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="5"/>',
    method: '<path d="M7 9h18M7 16h18M7 23h12"/><circle cx="25" cy="23" r="3"/>',
    value: '<path d="m16 4 11 12-11 12L5 16Z"/>',
    book: '<path d="M6 6h9a3 3 0 0 1 3 3v17a3 3 0 0 0-3-3H6Zm20 0h-5a3 3 0 0 0-3 3v17a3 3 0 0 1 3-3h5Z"/>'
  };
  function ico(name) { return '<div class="ico" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg></div>'; }
  function cta(id, eyebrow, light, strong, text, actions) {
    return scene(id, 'Let’s talk', 'contact',
      '<div class="narrow stack"><p class="eyebrow" data-reveal>' + eyebrow + '</p>' + title('t2', light, strong) +
      '<p class="lead" data-reveal style="--d:2">' + text + '</p><div class="actions" data-reveal style="--d:3">' + actions + '</div></div>');
  }

  /* ================= Pages ================= */
  var PAGES = {};

  PAGES['/'] = { name: 'Home', render: function () {
    return scene('H01', 'Decision', 'home-hero',
      '<div class="narrow stack"><p class="eyebrow" data-reveal>In a world reshaped by agentic AI,</p>' +
      '<h1 class="t1 wordrise">' + words('Your growth still depends on') + '<br><b>' + words('customers making a') + '</b> <em>' + words('decision.') + '</em><br>' + words('And acting on it.') + '</h1>' +
      '<p class="lead" data-reveal style="--d:3"><strong>Introducing Lybi, the Conative AI platform.</strong><br>We model each customer’s decision and help move it into action—so your AI investment drives top-line growth.</p>' +
      '<div class="actions" data-reveal style="--d:4"><a class="btn" href="#/demo">Request a demo</a><a class="link" href="#/platform">Platform</a></div></div>') +

    scene('H03', 'The blind spot', 'blind-spot',
      '<div class="narrow stack"><p class="eyebrow" data-reveal>The agentic blind spot</p>' + title('t2', 'Advancing the process', 'is not the same as advancing the decision.') +
      '<p class="lead" data-reveal style="--d:2">Agentic AI gives your systems better reasoning and powerful execution. <strong>But human decisions don’t follow machine logic.</strong></p>' +
      '<p class="body" data-reveal style="--d:3">A customer’s decision is shaped by trust, hidden concerns, and unexpressed needs. To actually drive revenue, your AI must understand the human decision context and move customers from decision to action.</p></div>') +

    scene('missing', 'Conative AI', null,
      '<div class="stack" style="gap:44px"><div class="intro-split"><div class="stack"><p class="eyebrow" data-reveal>The missing intelligence</p>' + title('t2', 'Not a smarter agent.', 'A new kind of intelligence.') +
      '<p class="lead" data-reveal style="--d:2">Conative AI models what shapes each customer’s decision and connects that understanding with the value your organization can responsibly provide. It uses agentic capabilities to help customers decide and act.</p></div>' +
      '<div class="dict" data-reveal style="--d:3"><h3>Conation</h3><p class="pos">noun · psychology</p><p>The aspect of mental processes or behavior <strong>directed toward action or change</strong> and including impulse, desire, volition, and striving.</p><p class="src">The American Heritage® Dictionary of the English Language.</p></div></div>' +
      // The picture is the diagram: customer (left) · Conative AI, the orb (centre) · organization (right).
      '<figure class="bridge" data-reveal style="--d:2"><img src="' + IMG + 'conation.jpg" srcset="' + IMG + 'conation-sm.jpg 900w, ' + IMG + 'conation.jpg 2048w" sizes="(max-width: 900px) 100vw, 1400px" alt="" loading="lazy" data-art-why="' + ART.conation + '"></figure>' +
      '<div class="triad" data-reveal style="--d:3"><div class="triad__item"><h3>The customer</h3><p>Motives, priorities, barriers and readiness.</p></div>' +
      '<div class="triad__item triad__item--core"><h3>Conative AI</h3><p>Purpose-built to model and advance the customer’s decision.</p></div>' +
      '<div class="triad__item"><h3>Your organization</h3><p>Objectives, products, services and boundaries.</p></div></div></div>', 'scene--auto') +

    scene('H05', 'Conative Engine', null,
      '<div class="stack" style="gap:34px"><div class="narrow stack"><p class="eyebrow" data-reveal>The Conative Engine</p>' + title('t2', 'Human decision-making.', 'Modeled by Lybi.') +
      '<p class="body" data-reveal style="--d:2">Our Conative Engine builds a <strong>Live Decision State</strong> for each customer: an evolving model of what drives their decision, what stands in the way and what is still needed to act.</p>' +
      '<p class="body" data-reveal style="--d:3">With every interaction, the state <strong>updates.</strong> Guided by this state and your organization’s objectives, the <strong>engine continuously:</strong></p></div>' +
      '<div class="engine-frame" data-reveal style="--d:2"><iframe data-src="/lybi-site/engine.html" title="Conative Engine: interactions update the Live Decision State and shape the Decision Path" loading="lazy" sandbox="allow-scripts"></iframe></div>' +
      '<div class="verbs">' + card('DISCOVERS', '<p>the <strong>Drivers</strong> shaping each customer’s decision.</p>', 1) + card('ASSEMBLES', '<p>personal <strong>Value</strong> from what your organization can provide.</p>', 2) + card('ESTABLISHES', '<p>The <strong>conditions</strong> required to advance from deliberation to execution.</p>', 3) + '</div>' +
      '<p class="strong-line" data-reveal>The customer’s decision path develops and adapts through these interactions.</p>' +
      '<div class="actions" data-reveal><a class="link" href="#/platform?s=engine">Learn more</a></div></div>', 'scene--auto') +

    scene('H06', 'Decision Journeys', 'journeys',
      '<div class="stack" style="gap:40px"><div class="narrow stack"><p class="eyebrow" data-reveal>Don’t start from scratch</p>' + title('t2', 'Improve your top line', 'with ready-to-implement Decision Journeys.') +
      '<p class="lead" data-reveal style="--d:2">Start with a Decision Journey built for your industry, not an agent you have to design from scratch.</p></div>' +
      '<div class="duo">' + card('Prebuilt Decision Journeys.', '<p>Already built into each journey:</p><ul class="ticks"><li>Decision models</li><li>Professional methods</li><li>Value logic</li><li>Domain knowledge</li></ul>', 1, '<p class="eyebrow">Lybi brings</p>') +
      card('Your objectives. Your offer. Your oversight.', '<p>Adapt the journey to your offering, approved information and business rules.</p><p>Your team reviews the fit and retains final approval.</p>', 2, '<p class="eyebrow">Your team adapts</p>') + '</div>' +
      '<p class="strong-line" data-reveal>Less work for your teams. A quick path to launch.</p>' +
      '<div class="actions" data-reveal><a class="btn" href="#/banking">Banking Decision Journeys</a><a class="btn" href="#/health">Health Decision Journeys</a></div></div>', 'scene--auto') +

    scene('H07', 'Platform', 'platform',
      '<div class="stack" style="gap:40px"><div class="narrow stack"><p class="eyebrow" data-reveal>Lybi platform</p>' + title('t2', 'Built around the decision.', 'Engineered to advance it.') +
      '<p class="lead" data-reveal style="--d:2">Lybi’s platform puts the Conative Engine to work across interactions, systems and teams. It preserves the developing case, coordinates execution and gives your organization control over how the journey runs and improves.</p></div>' +
      '<div class="grid grid--3">' +
      card('Orchestration &amp; execution', '<p>Lybi coordinates agents, tools and people around the work the engine selects. Dependencies, parallel tasks and approval waits are managed; results return as evidence.</p>', 1, ico('orchestration')) +
      card('Memory &amp; compute', '<p>Conversation, decision and process memory preserve the case. Lybi selects task-specific context and models, managing token use, response time and cost.</p>', 2, ico('memory')) +
      card('Control &amp; adaptation', '<p>Professional logic stays separate from language models. Lybi aligns the journey to your organization and manages versions, tests and approvals when methods or models change.</p>', 3, ico('control')) +
      card('Evaluation &amp; improvement', '<p>Lybi relates each interaction’s purpose to the work performed and the observed response. That evidence supports improvements, assessed and compared before release.</p>', 1, ico('evaluation')) +
      card('Compliance &amp; safety by design.', '<p>Built-in safeguards govern information access, ground responses in approved sources and check proposed actions. When a check identifies a problem, Lybi can correct the output, block the action or involve the responsible professional, with a record of what happened and why.</p><p><a class="link" href="#/trust">Compliance &amp; safety</a></p>', 2, ico('shield')) +
      '</div><div class="actions" data-reveal><a class="link" href="#/platform">Learn more</a></div></div>', 'scene--auto') +

    scene('H08', 'Impact', 'impact',
      '<div class="stack" style="gap:40px"><div class="narrow stack"><p class="eyebrow" data-reveal>From decision intelligence to impact</p>' + title('t2', 'Where your AI investment', 'meets the top line.') +
      '<p class="lead" data-reveal style="--d:2">Traditional AI stops at completing a task. Lybi is engineered to drive actual business outcomes: definitive action, sustained product adoption, and lasting customer relationships.</p></div>' +
      '<div class="grid grid--3">' + card('Conversion &amp; completion', '<p>Help customers progress from interest to a considered decision and its practical next steps.</p>', 1, ico('check')) +
      card('Growth &amp; usage', '<p>Build reasons to choose and use the products and services that matter to them.</p>', 2, ico('evaluation')) +
      card('Relationship &amp; retention', '<p>Make each interaction relevant as needs, priorities and circumstances change.</p>', 3, ico('loop')) + '</div>' +
      '<details class="more" data-reveal><summary>How impact is evaluated</summary><p class="body">These are intended areas of impact, not measured results. For each application, agree the outcome, data sources, baseline, comparison and period.</p><p class="body">Assess decision evidence, verified action and sustained outcomes separately. Health applications have their own care objectives and measures.</p></details></div>', 'scene--auto') +

    cta('H09', 'Let’s talk', 'Choose a ready Decision Journey.', 'Put it to work for your growth.',
      'Start with a journey built for your domain. Let’s select the one that fits your priority and plan a quick launch.',
      '<a class="btn" href="#/demo">Request a demo</a><a class="link" href="#/?s=H06">Learn more</a>');
  } };

  var CAPS = [
    { key: 'orchestration', name: 'Orchestration & execution', sub: 'Coordinate the work.<br>Keep the decision moving.',
      body: ['Lybi coordinates agents, tools and people around the work selected by the engine. It manages dependencies, parallel tasks and waits for information or approval, then returns execution results to the developing case.', 'A process step can remain pending while discovery or value development continues. Equally, a customer can be ready to act while an organizational requirement remains unmet. The platform keeps these two forms of readiness distinct.'],
      more: ['Alongside your systems', 'System connections bring approved information, permitted actions and professional handoffs into the Decision Journey. Product details inform what Lybi can explain or develop; action results inform what happens next.', 'When work requires additional expertise or authority, Lybi involves the appropriate person. Responsibilities remain with the systems and people authorized to carry out the action.'],
      link: ['Discuss your technical requirements', '#/contact?interest=Technical%20review'] },
    { key: 'memory', name: 'Memory & compute', sub: 'Retain how the decision developed.<br>Use what matters now.',
      body: ['The <strong>Live Decision State</strong> holds the current understanding. <strong>Decision memory</strong> preserves how it developed: the evidence, revised hypotheses, options explored, customer responses and work still open.', 'The context component selects what is relevant to the task. Exploring a concern, developing a proposition and checking an action do not require the same information. Lybi dynamically selects task-specific context and models to manage response time, token use and cost.'],
      more: ['Continuity beyond conversation history', 'Conversation, decision and process memory preserve different aspects of the same case. Lybi retains the sources behind statements and system results, changes to hypotheses, responses to previous propositions and the status of suspended work.', 'That record keeps what was discussed, what was decided and what was carried out distinct. When a fact is corrected, the hypotheses and outputs that depend on it can be reconsidered. Open questions remain available when the conversation resumes.'] },
    { key: 'control', name: 'Control & adaptation', sub: 'Adapt the journey.<br>Preserve the professional foundation.',
      body: ['Your organization adapts a ready Decision Journey to its offering, objectives and professional boundaries. The decision models and methods are already part of the product.', 'Lybi keeps professional logic and interaction design separate from the language models that support them. Configuration, method and model changes can be versioned, tested and approved without rebuilding the professional foundation.'],
      more: ['Manage changes before they reach customers', 'Journey configuration aligns the offering, approved information, access and professional responsibilities to the application.', 'Changes to professional methods and interaction design are managed separately from language-model changes. A proposed model replacement is assessed against the journey’s criteria before release.', 'Your team reviews the fit and retains the required approvals. It does not need to recreate the professional methods or construct agent workflows from scratch.'] },
    { key: 'evaluation', name: 'Evaluation & improvement', sub: 'Evaluate what the interaction changed.',
      body: ['Lybi evaluates an interaction against what it was intended to achieve. The record links the decision state, interaction objective, method, delivery and observed response.', 'Did a question fill a relevant information gap? Did new evidence challenge a hypothesis? Did the work address a condition needed to proceed?', 'This makes it possible to distinguish progress in the customer’s decision from task completion, and to examine whether a problem arose in understanding, approach, value or execution.'],
      more: ['Improve through tested changes', 'Case reviews, tests and version comparisons provide a basis for proposed improvements to methods, configuration and system behavior. Proposed changes are assessed and compared before release.', 'Evaluation examines whether the change helps. Control & adaptation manages its version, approval and release. Reviews also account for appropriate decisions not to proceed, rather than treating completion as the only successful outcome.'] },
    { key: 'shield', name: 'Compliance & safety by design.', sub: '',
      body: ['Information permissions, grounded responses and action checks apply throughout the work. Professional judgment and additional approvals remain with the responsible people.'],
      link: ['Compliance & safety', '#/trust'] }
  ];
  var STATIONS = [
    ['Live Decision State', 'The current understanding of the customer’s decision, with evidence, working hypotheses and missing information kept distinct.'],
    ['Decision-Led Prioritisation', 'Prioritises the work across <strong>Discovery</strong>, <strong>Value</strong> and <strong>Conditions</strong>, using the <strong>Live Decision State</strong> and organizational objectives to define what the next interaction should achieve.'],
    ['Live Compilation', 'Selects the professional approach and assembles the methods, relevant information, tools and dependencies it requires.'],
    ['Interaction &amp; execution', 'The work takes shape as a question, explanation, comparison or permitted action. Execution orchestration coordinates the tasks, tools and people involved.'],
    ['Evidence &amp; update', 'Customer responses and action results become evidence for the next state update. The revised understanding informs the next interaction.']
  ];

  PAGES['/platform'] = { name: 'Platform', render: function () {
    return scene('PF01', 'Platform', 'engine-core',
      '<div class="narrow stack"><p class="eyebrow" data-reveal>The Lybi platform</p>' + title('t1', 'Engineered around', 'the human decision.', 'h1') +
      '<p class="lead" data-reveal style="--d:3">The Conative Engine sits at the heart of Lybi. It directs the work around each customer’s evolving decision, while shared platform capabilities coordinate execution, preserve continuity and support oversight and improvement.</p>' +
      '<div class="actions" data-reveal style="--d:4"><a class="link" href="#/platform?s=engine">Conative Engine</a><a class="link" href="#/platform?s=caps">Platform capabilities</a><a class="link" href="#/platform?s=PF03">Domain expertise &amp; journeys</a></div></div>') +

    scene('engine', 'What Lybi learns', null,
      '<div class="stack" style="gap:40px"><div class="narrow stack"><p class="eyebrow" data-reveal>The Conative Engine</p>' + title('t2', 'What Lybi learns', 'changes what happens next.') +
      '<p class="body" data-reveal style="--d:2">The Conative Engine uses the <strong>Live Decision State</strong> to define what the next interaction needs to achieve. New evidence can change the questions worth asking to <strong>uncover Drivers</strong>, the <strong>Value worth developing and assembling</strong>, or the <strong>Conditions that still need to be established</strong>.</p></div>' +
      '<div class="cycle" id="cycle" data-reveal>' + STATIONS.map(function (s, i) { return '<button class="station" type="button" data-i="' + i + '"><span class="station__dot">0' + (i + 1) + '</span><h3>' + s[0] + '</h3><p>' + s[1] + '</p></button>'; }).join('') + '</div>' +
      '<p class="cycle-note" data-reveal>The customer’s decision path develops through these interactions.</p>' +
      '<div class="engine-frame" data-reveal><iframe data-src="/lybi-site/engine.html" title="Conative Engine: interactions update the Live Decision State and shape the Decision Path" loading="lazy" sandbox="allow-scripts"></iframe></div></div>', 'scene--auto') +

    scene('caps', 'Capabilities', 'platform',
      '<div class="stack" style="gap:40px"><div class="narrow stack"><p class="eyebrow" data-reveal>Platform capabilities</p>' + title('t2', 'The architecture', 'of action.') +
      '<p class="lead" data-reveal style="--d:2">Shared capabilities keep the engine’s work coordinated across interactions, systems and people.</p></div>' +
      '<div class="tabs" data-reveal><div class="tabs__list" role="tablist" aria-label="Platform capabilities">' +
      CAPS.map(function (c, i) { return '<button class="tab" role="tab" id="cap-t' + i + '" aria-controls="cap-p" aria-selected="' + (i === 0) + '" data-i="' + i + '">' + c.name + '</button>'; }).join('') +
      '</div><div class="glass panel" id="cap-p" role="tabpanel"></div></div></div>', 'scene--auto') +

    scene('PF03', 'Expertise', 'journeys',
      '<div class="stack" style="gap:40px"><div class="narrow stack"><p class="eyebrow" data-reveal>Domain expertise &amp; Decision Journeys</p>' + title('t2', 'The expertise is already', 'in the journey.') +
      '<p class="body" data-reveal style="--d:2">Professional expertise is built into how Lybi models decisions, investigates what matters and develops the value and conditions needed to act.</p>' +
      '<p class="body" data-reveal style="--d:3">Each ready-to-implement <strong>Decision Journey</strong> organizes that expertise around the decisions and professional context it serves. It gives the engine more than reference information: it provides models and methods for applying that information to the customer’s developing decision.</p></div>' +
      '<div class="grid grid--4">' + card('Decision models', '<p>Define what the engine needs to understand about a decision and which evidence to seek. Motives, priorities, barriers and readiness guide the inquiry.</p>', 1, ico('model')) +
      card('Professional methods', '<p>Provide structured ways to investigate concerns, test hypotheses and work through competing considerations.</p>', 2, ico('method')) +
      card('Value logic', '<p>Guides how available products, services and support are combined into personal value, and why that combination matters to the customer.</p>', 3, ico('value')) +
      card('Domain knowledge', '<p>Grounds the journey’s work in the professional knowledge and reference information relevant to its domain.</p>', 4, ico('book')) + '</div>' +
      '<p class="lead" data-reveal>The Conative Engine applies this foundation to the individual case. What it learns can change which method is relevant, which options belong in the solution and what still needs to happen before the person can act.</p>' +
      '<details class="more" data-reveal><summary>Adapt and launch a ready journey</summary><p class="body">Start with the Decision Journey that fits your priority. Implementation aligns the existing journey to your products and services, approved information, system connections, permissions and professional responsibilities.</p><p class="body">Your team reviews the application and safeguards, retains the required approvals and agrees how outcomes will be assessed. Every journey runs on the Conative Engine with shared platform capabilities and controls.</p></details>' +
      '<p class="strong-line" data-reveal>Less work for your teams.<br>A quick path to launch.</p>' +
      '<div class="actions" data-reveal><a class="btn" href="#/banking">Explore Banking Decision Journeys</a><a class="btn" href="#/health">Explore Health Decision Journeys</a></div></div>', 'scene--auto');
  } };

  var BANK = [
    ['Account Opening', 'From opening an account to a primary banking relationship built around the customer.', 'A built-in journey to uncover joining motivations, match accounts and complementary products, address hesitations and encourage commitments such as salary transfer or adding a card. Customers start with a personally relevant account and a stronger foundation for deeper banking activity.', 'Account and product offerings, benefits, eligibility and fees, additional KYC requirements, activation priorities and exception handling.'],
    ['Personal Loans', 'From a loan request to a personal conversation that uncovers needs, broadens options and shapes the right financing solution.', 'A built-in journey that adapts to different attitudes toward borrowing, from reluctance to readiness. Responsible dialogue and loan structuring models help uncover needs, address concerns and shape the amount, term and repayment structure around each customer’s circumstances and ability to repay.', 'Loan offerings, rates and fees, credit and affordability criteria, repayment options, required information and documents, and exception handling.'],
    ['Deposits', 'From available funds to a savings choice that fits future plans.', 'A built-in journey to understand what available funds are for, when they may be needed and how much flexibility matters. It makes trade-offs between return, term and access clear, addresses hesitation about locking money away and matches deposits to the customer’s future plans.', 'Deposit offerings, rates and terms, eligibility and minimum amounts, withdrawal and renewal rules, funding requirements and exception handling.'],
    ['Credit Card Order', 'Win new cardholders and make your card their first choice for everyday spending.', 'A built-in journey to understand spending habits, uncover what would make a new card worth choosing and match benefits to everyday use. It addresses fee and switching concerns, guides the application and builds a personal reason to make this card the customer’s first choice.', 'Card offerings, fees and benefits, eligibility and limit policies, application requirements, delivery and activation options, and exception handling.'],
    ['Special Payments', 'From complex international payments to proactive guidance that anticipates requirements and keeps funds moving.', 'A built-in journey to proactively clarify a payment’s purpose, anticipate supporting documents and explain what is needed and why. It guides customers through requirements and approvals, follows up on missing information and addresses obstacles early to reduce uncertainty and avoidable delays.', 'Payment types covered, documentation and approval requirements, triggers for customer outreach, status updates and exception handling.'],
    ['Mortgage Guidance', 'From a fragmented mortgage process to personal guidance that connects understanding, planning and financing a home.', 'A built-in journey that brings clarity, continuity and personal direction to one of the customer’s biggest financial decisions. It builds understanding at the customer’s pace, explores how a mortgage fits their life and future plans, and helps weigh borrowing structures and repayment scenarios. Along the way, it organizes information and documents, prepares customers to assess proposals and keeps decisions connected as they move toward completion.', 'Your mortgage workflow, coordination with mortgage teams, journey routing and Lybi’s role in preparing customer files and collecting documents.']
  ];
  PAGES['/banking'] = { name: 'Banking', render: function () {
    return scene('B01', 'Banking', 'banking',
      '<div class="narrow stack"><p class="eyebrow" data-reveal>Lybi for banking</p>' + title('t1', 'Banking-ready', 'Decision Journeys.', 'h1') +
      '<p class="t3" data-reveal style="--d:2">Where your AI investment meets the top line.</p>' +
      '<p class="lead" data-reveal style="--d:3">High-value, customer-facing Decision Journeys built to advance the decisions that drive your bank’s top line, from new business to sustained product use and lasting relationships.</p>' +
      '<div class="actions" data-reveal style="--d:4"><a class="btn" href="#/demo?interest=Banking">Request a demo</a></div></div>') +
    scene('B02', 'Journeys', null,
      '<div class="stack" style="gap:40px"><div class="narrow stack"><p class="eyebrow" data-reveal>Explore our Decision Journeys</p>' + title('t2', 'Choose your', 'Banking Decision Journey.') + '</div>' +
      '<div class="jgrid" id="jgrid" data-reveal>' + BANK.map(function (j, i) { return '<button class="jcard" type="button" aria-expanded="false" data-i="' + i + '"><h3>' + j[0] + '</h3><p>' + j[1] + '</p><span class="go">Explore the journey</span></button>'; }).join('') + '</div>' +
      '<div class="stack" style="gap:20px"><p class="eyebrow" data-reveal>In development</p><div class="grid grid--3">' +
      [['Holistic Financing', 'From a financing need to the right combination of solutions.'], ['First-Year Onboarding', 'From a newly opened account to confident everyday banking.'], ['Relationship Deepening (Anchoring)', 'From everyday banking to more possibilities with your bank.']].map(function (j, i) {
        return '<article class="glass soon" data-reveal style="--d:' + i + '"><span class="tag">COMING SOON</span><h3 style="margin-top:14px">' + j[0] + '</h3><p>' + j[1] + '</p></article>'; }).join('') + '</div></div></div>', 'scene--auto') +
    cta('B-cta', 'Let’s talk', 'Choose a ready Decision Journey.', 'Put it to work for your growth.', 'Start with a journey built for your domain. Let’s select the one that fits your priority and plan a quick launch.', '<a class="btn" href="#/demo?interest=Banking">Request a demo</a>');
  } };

  PAGES['/health'] = { name: 'Health', render: function () {
    return scene('HY01', 'Health', 'health',
      '<div class="narrow stack"><p class="eyebrow" data-reveal>Lybi for health</p>' + title('t1', 'Keep care moving.', 'Beyond the appointment.', 'h1') +
      '<p class="lead" data-reveal style="--d:3">Help people turn health decisions into practical steps between medical encounters. Lybi brings professional expertise, personal understanding and proactive support to the part of the care journey that continues in everyday life.</p>' +
      '<p class="body" data-reveal style="--d:4">For health plans and care providers, Decision Journeys extend the reach of your offering, helping people understand relevant options, prepare for care and stay engaged between visits.</p>' +
      '<div class="actions" data-reveal style="--d:5"><a class="btn" href="#/demo?interest=Health">Request a demo</a></div></div>') +
    scene('HY02', 'Journeys', null,
      '<div class="stack" style="gap:40px"><div class="narrow stack"><p class="eyebrow" data-reveal>Health Decision Journeys</p>' + title('t2', 'Explore our', 'Health Decision Journeys.') + '</div>' +
      '<article class="glass" data-reveal style="padding:36px"><h3 style="font-size:32px;font-weight:300">Menopause Support · <span class="grad">Freeda</span></h3><p class="lead" style="margin:10px 0 26px">From uncertainty about menopause to informed decisions and practical steps for care and everyday health.</p>' +
      '<div class="duo"><div><p class="eyebrow">What comes ready</p><p class="body">A built-in journey that helps women make sense of what they are experiencing, explore concerns and priorities, and understand relevant care options. Menopause expertise and structured dialogue shape personal guidance, preparation for appointments and support between visits.</p><p class="body">A personal space brings together relevant information, symptom tracking and an initial action plan. Proactive follow-ups revisit questions, address barriers to taking the next step and adapt support as needs change, connecting preparation for care with ongoing attention to everyday health.</p></div>' +
      '<div><p class="eyebrow">Your organization adapts and approves</p><p class="body">Approved information, available services and eligibility, member pathways, outreach and follow-up priorities, and professional responsibilities and handoff arrangements.</p><p class="note" style="margin-top:18px">Clinical assessment and treatment decisions remain with qualified professionals and the woman receiving care.</p></div></div></article>' +
      '<div class="grid grid--2">' + ['Pregnancy Journey', 'Longevity Journey'].map(function (n, i) { return '<article class="glass soon" data-reveal style="--d:' + i + '"><span class="tag">COMING SOON</span><h3 style="margin-top:14px">' + n + '</h3></article>'; }).join('') + '</div></div>', 'scene--auto') +
    cta('HY-cta', 'Let’s talk', 'Which Decision Journey', 'will make the difference?', 'Select a ready Decision Journey and tell us the business or care result you want to improve. We’ll review the fit, outline the launch and agree how to assess progress.', '<a class="btn" href="#/contact?interest=Health">Let’s talk</a>');
  } };

  PAGES['/trust'] = { name: 'Trust & Control', render: function () {
    return scene('T01', 'Trust', 'trust',
      '<div class="narrow stack"><p class="eyebrow" data-reveal>Trusted by design</p>' + title('t1', 'Your boundaries.', 'Built into how Lybi works.', 'h1') +
      '<p class="t3" data-reveal style="--d:2">Protect information. Ground interactions. Govern actions.</p>' +
      '<p class="lead" data-reveal style="--d:3">Lybi brings data protection, professional boundaries and traceable controls into every Decision Journey, from the information it uses to the actions it takes.</p></div>') +
    scene('T02', 'Data', null,
      '<div class="stack" style="gap:40px"><div class="narrow stack"><p class="eyebrow" data-reveal>Data security &amp; privacy</p>' + title('t2', 'Protect the information.', 'Control its use.') + '</div>' +
      '<div class="grid grid--4">' + card('Encrypted data', '<p>Information is encrypted in transit and at rest.</p>', 1, ico('lock')) + card('Data separation', '<p>Your organization’s data is kept separate from other organizations’ data.</p>', 2, ico('split')) +
      card('Controlled access', '<p>Permissions govern who can access information and which data each task and tool may use.</p>', 3, ico('key')) + card('Retention &amp; deletion', '<p>Defined policies govern how long information is kept and when it is deleted.</p>', 4, ico('clock')) + '</div></div>', 'scene--auto') +
    scene('T03', 'Reliability', null,
      '<div class="duo" style="gap:24px">' +
      '<article class="glass" data-reveal style="padding:36px"><p class="eyebrow">Reliable interactions</p>' + title('t2', 'Ground the response.', 'Check before acting.') + '<p class="body" style="margin-top:22px">Lybi grounds responses in approved sources and checks relevant calculations, product terms and proposed actions before delivery or execution.</p><p class="body">When a check identifies a problem, the system can correct the output, block the action or involve the appropriate professional.</p></article>' +
      '<article class="glass" data-reveal style="--d:1;padding:36px"><p class="eyebrow">Policy &amp; professional oversight</p>' + title('t2', 'Your policies guide the work.', 'Your people retain authority.') + '<p class="body" style="margin-top:22px">Organizational rules, eligibility criteria and authority limits govern what Lybi can offer and do. Decisions requiring professional judgment or additional approval go to the responsible person.</p></article></div>', 'scene--auto') +
    scene('T04', 'Traceability', null,
      '<div class="stack" style="gap:30px"><div class="narrow stack"><p class="eyebrow" data-reveal>Traceability &amp; review</p>' + title('t2', 'Trace the evidence.', 'Audit the action.') +
      '<p class="body" data-reveal style="--d:2">Linked records connect customer evidence and decision state with the work selected, sources used, checks applied and observed results.</p>' +
      '<p class="body" data-reveal style="--d:3">Your teams can review why an interaction took a particular direction and whether an action was delivered, corrected, blocked or handed over.</p></div>' +
      '<div class="chain" id="chain" data-reveal><span class="chain__beam"></span>' + ['Evidence', 'Decision state', 'Selected work', 'Checks', 'Response &amp; result'].map(function (n) { return '<div class="chain__node"><i></i><span>' + n + '</span></div>'; }).join('') + '</div></div>', 'scene--auto') +
    cta('T05', 'Built into every Decision Journey', 'Shared safeguards.', 'Applied to your professional context.', 'The same platform controls support each Decision Journey. Your products, approved information, permissions and professional responsibilities define the boundaries within which it operates.', '<a class="btn" href="#/contact?interest=Technical%20review">Discuss your requirements</a>');
  } };

  var TEAM = [
    ['hila', 'Hila Carmel', 'Co-founder', 'Hila brings 25 years of experience connecting customer understanding, business strategy and technology. She founded a customer experience consultancy and an analytics platform, both acquired by EY, where she became a partner leading business transformation in Israel. She later founded Freeda, bringing AI-powered, continuous support to women navigating menopause. Across financial services and health, that work shaped the insight behind Lybi: technology needs to work with how people decide. Today, she is building that understanding into Conative AI.'],
    ['noa', 'Noa Assouline', 'Co-founder', 'Noa brings financial-services strategy and enterprise transformation experience to Lybi. At EY and Accenture, she worked across growth strategy, customer journeys, digital products and operating models, translating business ambitions into practical change. At Lybi, she brings that expertise into the product itself: turning domain knowledge and professional judgment into ready Decision Journeys, with the organizational goals, policies and operating requirements needed to put them to work.'],
    ['shlomi', 'Shlomi Zevin', 'Chief Technology Officer', 'Shlomi has co-founded and led engineering at startups and built systems using neural networks, decision trees and genetic algorithms. His conversational AI experience spans banking onboarding, sales negotiation and wellness.']
  ];
  PAGES['/company'] = { name: 'Company', render: function () {
    return scene('CO01', 'Company', 'founders',
      '<div class="narrow stack"><p class="eyebrow" data-reveal>Company</p>' + title('t1', 'Intelligence built for action.', 'Designed around the decision.', 'h1') +
      '<p class="lead" data-reveal style="--d:3">Lybi brings together experience in business transformation, financial services, health and conversational AI. We turn that perspective into a product for the decisions that stand between an organization’s offer and a person’s action.</p>' +
      '<div class="actions" data-reveal style="--d:4"><a class="btn" href="/lybi/team?from=immersive">Meet the team</a><a class="link" href="#/platform">Learn more</a></div></div>') +
    scene('CO01-STORY', 'Why Lybi', null,
      '<div class="duo" style="gap:60px;align-items:start"><div class="stack"><p class="eyebrow" data-reveal>Why Lybi</p>' + title('t2', 'Build for the decision.', 'Not only the process around it.') + '</div>' +
      '<div class="stack" style="gap:16px"><p class="lead" data-reveal style="--d:2">We built Lybi around the customer’s developing decision, not just the record of the customer or the status of a process.</p><p class="body" data-reveal style="--d:3">That requires more than conversational fluency. It requires domain methods, an explicit model and the operating capabilities to put both to work. Lybi brings them together in one platform.</p></div></div>', 'scene--auto') +
    scene('CO02', 'The team', null,
      '<div class="stack" style="gap:40px"><div class="narrow stack"><p class="eyebrow" data-reveal>The experience behind Lybi</p>' + title('t2', 'The experience to see the gap.', 'The expertise to build Lybi.') +
      '<p class="body" data-reveal style="--d:2">Customer experience and business transformation bring an understanding of how organizations create value. Financial-services and health experience bring the professional context of the decisions people face. Together with AI engineering, that experience becomes the decision models, professional methods and platform behind Lybi.</p></div>' +
      '<div class="founders">' + TEAM.map(function (f, i) {
        return '<a class="glass founder" href="/lybi/team?from=immersive&agent=' + f[0] + '" data-reveal style="--d:' + i + '"><img src="/lybi-site/team/img/' + f[0] + '-agent.jpg" alt="" loading="lazy"><div class="founder__b"><h3>' + f[1] + '</h3><p class="role">' + f[2] + '</p><p>' + f[3] + '</p><span class="founder__go">Ask ' + f[1].split(' ')[0] + '’s agent →</span></div></a>'; }).join('') + '</div></div>', 'scene--auto') +
    cta('CO04', 'Let’s talk', 'Which customer decision', 'drives your top-line growth?', 'Choose a ready Decision Journey built for your industry. Let’s align it to your growth priorities and plan a quick launch.', '<a class="btn" href="#/contact">Let’s talk</a>');
  } };

  var INTERESTS = ['Banking', 'Account Opening', 'Personal Loans', 'Deposits', 'Credit Cards', 'Special Payments', 'Mortgage Guidance', 'Health', 'Menopause Support · Freeda', 'Pregnancy Journey (planned)', 'Longevity Journey (planned)', 'Technical review', 'Another application'];
  PAGES['/contact'] = { name: 'Contact', render: function () {
    return scene('CT01', 'Let’s talk', 'contact',
      '<div class="duo" style="gap:48px;align-items:start"><div class="stack"><p class="eyebrow" data-reveal>Let’s talk</p>' + title('t1', 'Which Decision Journey', 'will make the difference?', 'h1') +
      '<p class="lead" data-reveal style="--d:3">Select a ready Decision Journey and tell us the business or care result you want to improve. We’ll review the fit, outline the launch and agree how to assess progress.</p>' +
      '<div class="starts glass" data-reveal style="--d:4"><h3>A useful starting point.</h3><div><b>The objective</b><span>What do you want to change?</span></div><div><b>The journey</b><span>Whose decisions and actions does it depend on?</span></div><div><b>The value</b><span>What products, services or support can your organization provide?</span></div><div><b>The environment</b><span>What systems, information and boundaries shape the work?</span></div><p class="note">Exploring the technology? Start with your architecture or evaluation questions.</p></div></div>' +
      '<form class="glass form" id="contact-form" novalidate data-reveal style="--d:2;padding:32px"><p class="eyebrow">Your application</p><h2 class="t3" style="margin:-8px 0 6px">Tell us which journey matters to you.</h2>' +
      '<div class="row"><div><label for="c-name">Name *</label><input id="c-name" name="name" required maxlength="160" autocomplete="name"></div><div><label for="c-org">Organization *</label><input id="c-org" name="organization" required maxlength="200" autocomplete="organization"></div></div>' +
      '<div><label for="c-email">Work email *</label><input id="c-email" name="email" type="email" required maxlength="254" autocomplete="email"></div>' +
      '<div class="row"><div><label for="c-role">Role<span class="opt">optional</span></label><input id="c-role" name="role" maxlength="160"></div><div><label for="c-interest">Area of interest</label><select id="c-interest" name="interest"><option value="">Select an area</option>' + INTERESTS.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div></div>' +
      '<div><label for="c-msg">The objective, journey or question you have in mind</label><textarea id="c-msg" name="message" maxlength="3000" placeholder="Tell us about the journey, your priorities or the questions you have."></textarea></div>' +
      '<p class="hint">Please do not include customer account details, patient records or other sensitive personal information.</p>' +
      '<div class="actions"><button class="btn" type="submit">Let’s talk</button></div><p class="status" id="c-status" role="status" aria-live="polite"></p></form></div>', 'scene--auto');
  } };

  PAGES['/demo'] = { name: 'Get a demo', render: function () {
    return scene('DM01', 'Demo', 'home-hero',
      '<div class="narrow stack"><p class="eyebrow" data-reveal>Get a demo</p>' + title('t1', 'See Lybi', 'in action.', 'h1') +
      '<p class="lead" data-reveal style="--d:2">Use your work email to request a demonstration of Lybi’s Decision Journeys.</p>' +
      '<form class="form glass" id="demo-form" novalidate data-reveal style="--d:3;padding:28px;max-width:560px"><div><label for="d-email">Work email</label><input id="d-email" name="email" type="email" required placeholder="name@organization.com" autocomplete="email" aria-describedby="d-help d-status"></div>' +
      '<p class="hint" id="d-help">Please use your organization’s email address. Personal email providers are not accepted.</p><div class="actions"><button class="btn" type="submit">Request a demo</button></div><p class="status" id="d-status" role="status" aria-live="polite"></p></form></div>');
  } };

  /* ================= Forms (same endpoint and rules as the main site) ================= */
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '' : 'https://aspect-agent-server-1018338671074.europe-west1.run.app';
  var PERSONAL = ['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.co.il', 'yahoo.fr', 'ymail.com', 'rocketmail.com', 'hotmail.com', 'hotmail.co.uk', 'hotmail.co.il', 'outlook.com', 'outlook.co.il', 'live.com', 'live.co.uk', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.de', 'mail.com', 'fastmail.com', 'yandex.com', 'yandex.ru', 'mail.ru', 'qq.com', '163.com', '126.com', 'walla.co.il', 'walla.com', 'nana.co.il', '012.net.il', '013.net.il', 'netvision.net.il', 'bezeqint.net'];
  function workEmail(raw) {
    var e = String(raw || '').trim(), m = e.match(/^[^\s@]+@([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,})$/);
    if (!m) return { ok: false, error: 'Please enter a valid work email address.' };
    var d = m[1].toLowerCase();
    if (PERSONAL.some(function (p) { return d === p || d.slice(-(p.length + 1)) === '.' + p; })) return { ok: false, error: 'Please use your organization’s email address, not a personal email provider.' };
    return { ok: true, email: e, domain: d };
  }
  function send(form, status, payload, done) {
    var b = form.querySelector('button[type=submit]'), label = b.textContent;
    b.disabled = true; b.textContent = 'Sending…'; status.className = 'status'; status.textContent = '';
    fetch(API + '/api/lybi/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); form.reset(); status.className = 'status ok'; status.textContent = done; Sound.play('stage', .6); })
      .catch(function () { status.className = 'status err'; status.textContent = 'We couldn’t send this just now. Please try again in a moment.'; })
      .then(function () { b.disabled = false; b.textContent = label; });
  }
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.id === 'contact-form') {
      e.preventDefault();
      var st = $('#c-status'), ok = true;
      $$('input[required]', f).forEach(function (i) { var good = !!i.value.trim() && i.checkValidity(); i.setAttribute('aria-invalid', String(!good)); if (!good) ok = false; });
      if (!ok) { st.className = 'status err'; st.textContent = 'Please complete the required fields.'; var bad = $('[aria-invalid="true"]', f); if (bad) bad.focus(); return; }
      var v = function (n) { return f.elements.namedItem(n).value.trim(); };
      send(f, st, { name: v('name'), email: v('email'), company: v('organization'), message: [v('role') && 'Role: ' + v('role'), v('interest') && 'Area of interest: ' + v('interest'), v('message')].filter(Boolean).join('\n\n') }, 'Thank you, we’ll be in touch.');
    }
    if (f.id === 'demo-form') {
      e.preventDefault();
      var s = $('#d-status'), input = $('#d-email'), r = workEmail(input.value);
      input.setAttribute('aria-invalid', String(!r.ok));
      if (!r.ok) { s.className = 'status err'; s.textContent = r.error; input.focus(); return; }
      send(f, s, { name: 'Demo request', email: r.email, company: r.domain, message: 'Demo request from lybi.ai (immersive site)' }, 'Thank you, we’ll be in touch to arrange your demo.');
    }
  });

  /* ================= Sound (optional; reuses the team page's audio) ================= */
  var Sound = (function () {
    var ctx, gain, mgain, music, bufs = {}, on = false, loading;
    function init() {
      if (ctx) return; var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC(); gain = ctx.createGain(); gain.gain.value = .4; gain.connect(ctx.destination); mgain = ctx.createGain(); mgain.gain.value = 0; mgain.connect(ctx.destination);
      loading = Promise.all(['select', 'stage', 'theme'].map(function (k) {
        return fetch('/lybi-site/team/audio/' + k + '.mp3').then(function (r) { return r.arrayBuffer(); }).then(function (b) { return new Promise(function (res, rej) { ctx.decodeAudioData(b, res, rej); }); }).then(function (x) { bufs[k] = x; }).catch(function () {});
      }));
    }
    function set(v) {
      on = v; $('#sound').setAttribute('aria-pressed', String(v));
      try { localStorage.setItem('lybi-im-sound', v ? '1' : '0'); } catch (e) {}
      if (v) { init(); if (!ctx) return; ctx.resume(); loading.then(function () { if (!on) return; if (!music && bufs.theme) { music = ctx.createBufferSource(); music.buffer = bufs.theme; music.loop = true; music.connect(mgain); music.start(); } ramp(.16, 2); }); }
      else if (ctx) ramp(0, .4);
    }
    function ramp(to, s) { var n = ctx.currentTime; mgain.gain.cancelScheduledValues(n); mgain.gain.setValueAtTime(mgain.gain.value, n); mgain.gain.linearRampToValueAtTime(to, n + s); }
    function play(k, vol) { if (!on || !bufs[k]) return; var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = bufs[k]; g.gain.value = vol || .4; s.connect(g); g.connect(gain); s.start(); }
    document.addEventListener('visibilitychange', function () { if (ctx) { if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); } });
    return { set: set, play: play, on: function () { return on; } };
  })();
  $('#sound').addEventListener('click', function () { Sound.set(!Sound.on()); });

  /* ================= Ambient light lines (same as the team page, softer) ================= */
  (function ambient() {
    var c = $('#ambient'), g = c.getContext('2d'), w, h, t = 0, last = 0, lines = [];
    for (var i = 0; i < 16; i++) lines.push({ y: Math.random(), amp: .03 + Math.random() * .08, f: 1 + Math.random() * 2, s: .15 + Math.random() * .3, ph: Math.random() * 6.28, a: .05 + Math.random() * .1, wd: .6 + Math.random() });
    function size() { var d = Math.min(devicePixelRatio || 1, 1.5); w = innerWidth; h = innerHeight; c.width = w * d; c.height = h * d; g.setTransform(d, 0, 0, d, 0, 0); }
    function draw() {
      g.clearRect(0, 0, w, h); g.globalCompositeOperation = 'lighter';
      lines.forEach(function (L) {
        var gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(174,128,255,0)'); gr.addColorStop(.5, 'rgba(174,128,255,' + L.a + ')'); gr.addColorStop(1, 'rgba(174,128,255,0)');
        g.strokeStyle = gr; g.lineWidth = L.wd; g.beginPath();
        for (var s = 0; s <= 40; s++) { var x = s / 40, y = L.y + Math.sin(x * L.f * Math.PI - t * L.s + L.ph) * L.amp; if (!s) g.moveTo(x * w, y * h); else g.lineTo(x * w, y * h); }
        g.stroke();
      });
    }
    function frame(n) { t += last ? Math.min(.05, (n - last) / 1000) : 0; last = n; draw(); if (!document.hidden) requestAnimationFrame(frame); else last = 0; }
    size(); draw(); addEventListener('resize', function () { size(); draw(); });
    if (!REDUCED) { requestAnimationFrame(frame); document.addEventListener('visibilitychange', function () { if (!document.hidden) { last = 0; requestAnimationFrame(frame); } }); }
  })();

  /* ================= Router + page behaviour ================= */
  var app = $('#app'), veil = $('#veil'), io, railIO, timers = [];
  function clearTimers() { timers.forEach(clearInterval); timers = []; }

  function mount(path, params) {
    var page = PAGES[path] || PAGES['/'];
    document.title = path === '/' ? 'Lybi · Conative AI' : 'Lybi · ' + page.name;
    clearTimers();
    app.innerHTML = page.render();
    $$('.nav__links > a').forEach(function (a) { if (a.getAttribute('href') === '#' + path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    closeMenus();
    observe();
    buildRail();
    wire();
    var target = params.get('s') && document.getElementById(params.get('s'));
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' }); else window.scrollTo({ top: 0, behavior: 'instant' });
    var h1 = $('h1', app); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  }
  function route(first) {
    var raw = location.hash.slice(1) || '/', parts = raw.split('?'), path = parts[0] || '/', params = new URLSearchParams(parts[1] || '');
    if (first || REDUCED) { mount(path, params); return; }
    veil.classList.add('on'); Sound.play('select', .3);
    setTimeout(function () { mount(path, params); requestAnimationFrame(function () { veil.classList.remove('on'); }); }, 280);
  }

  // Reveal on scroll; lazy-start iframes; light the trust chain.
  function observe() {
    if (io) io.disconnect();
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        $$('iframe[data-src]', e.target).forEach(function (f) { f.src = f.dataset.src; f.removeAttribute('data-src'); });
        if (e.target.id === 'T04') lightChain();
        io.unobserve(e.target);
      });
    }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
    $$('.scene, [data-reveal]', app).forEach(function (el) { io.observe(el); });
    if (REDUCED) $$('.scene, [data-reveal]', app).forEach(function (el) { el.classList.add('in'); });
    // Iframes start when their scene is near, whatever the reveal state.
    var fio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && e.target.dataset.src) { e.target.src = e.target.dataset.src; e.target.removeAttribute('data-src'); fio.unobserve(e.target); } }); }, { rootMargin: '400px 0px' });
    $$('iframe[data-src]', app).forEach(function (f) { fio.observe(f); });
  }

  function buildRail() {
    var rail = $('#rail'), scenes = $$('.scene[data-label]', app);
    rail.innerHTML = scenes.map(function (s) { return '<a href="#" data-to="' + s.id + '" aria-label="' + s.dataset.label + '"><span>' + s.dataset.label + '</span></a>'; }).join('');
    if (railIO) railIO.disconnect();
    railIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) $$('a', rail).forEach(function (a) { a.classList.toggle('on', a.dataset.to === e.target.id); }); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    scenes.forEach(function (s) { railIO.observe(s); });
  }
  $('#rail').addEventListener('click', function (e) { var a = e.target.closest('a'); if (!a) return; e.preventDefault(); var t = document.getElementById(a.dataset.to); if (t) t.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); });

  function wire() {
    // Platform: the five-station cycle plays by itself until someone picks a station.
    var cycle = $('#cycle');
    if (cycle) {
      var i = 0, touched = false, st = $$('.station', cycle);
      var show = function (k) { i = k; st.forEach(function (s, j) { s.classList.toggle('on', j === k); }); };
      show(0);
      st.forEach(function (s, j) { s.addEventListener('click', function () { touched = true; show(j); Sound.play('select', .3); }); });
      if (!REDUCED) timers.push(setInterval(function () { if (!touched) show((i + 1) % st.length); }, 2600));
    }
    // Platform: capabilities as a tab panel.
    var panel = $('#cap-p');
    if (panel) {
      var paint = function (k) {
        var c = CAPS[k];
        $$('.tab').forEach(function (t, j) { t.setAttribute('aria-selected', String(j === k)); t.tabIndex = j === k ? 0 : -1; });
        panel.setAttribute('aria-labelledby', 'cap-t' + k);
        panel.innerHTML = ico(c.key) + '<h3>' + c.name.replace('&', '&amp;') + '</h3>' + (c.sub ? '<p class="sub">' + c.sub + '</p>' : '') +
          c.body.map(function (p) { return '<p class="body">' + p + '</p>'; }).join('') +
          (c.more ? '<details class="more"><summary>' + c.more[0] + '</summary>' + c.more.slice(1).map(function (p) { return '<p class="body">' + p + '</p>'; }).join('') + '</details>' : '') +
          (c.link ? '<p style="margin-top:18px"><a class="link" href="' + c.link[1] + '">' + c.link[0].replace('&', '&amp;') + '</a></p>' : '');
        panel.animate && !REDUCED && panel.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,.7,.2,1)' });
      };
      paint(0);
      $$('.tab').forEach(function (t, j) {
        t.addEventListener('click', function () { paint(j); Sound.play('select', .3); });
        t.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); var n = (j + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : CAPS.length - 1)) % CAPS.length; paint(n); $$('.tab')[n].focus(); } });
      });
    }
    // Banking: a journey opens its detail right under its row.
    var grid = $('#jgrid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var b = e.target.closest('.jcard'); if (!b) return;
        var open = b.getAttribute('aria-expanded') === 'true', old = $('.jdetail', grid);
        if (old) old.remove();
        $$('.jcard', grid).forEach(function (c) { c.setAttribute('aria-expanded', 'false'); });
        if (open) return;
        b.setAttribute('aria-expanded', 'true'); Sound.play('select', .3);
        var j = BANK[+b.dataset.i], cards = $$('.jcard', grid), idx = cards.indexOf(b);
        var cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length, last = cards[Math.min(cards.length - 1, Math.floor(idx / cols) * cols + cols - 1)];
        var d = document.createElement('div'); d.className = 'jdetail';
        d.innerHTML = '<article class="glass"><p class="eyebrow">What comes ready</p><p>' + j[2] + '</p></article><article class="glass"><p class="eyebrow">Your bank adapts and approves</p><p>' + j[3] + '</p></article>';
        last.after(d);
      });
    }
    // Pointer light on glass cards.
    $$('.glass', app).forEach(function (g) {
      g.addEventListener('pointermove', function (e) { var r = g.getBoundingClientRect(); g.style.setProperty('--mx', (e.clientX - r.left) + 'px'); g.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    });
    // Contact: interest carried over from the link (?interest=…).
    var sel = $('#c-interest'), want = new URLSearchParams((location.hash.split('?')[1]) || '').get('interest');
    if (sel && want) Array.prototype.some.call(sel.options, function (o) { if (o.value === want || o.text === want) { sel.value = o.value || o.text; return true; } });
  }
  function lightChain() {
    var chain = $('#chain'); if (!chain) return;
    var nodes = $$('.chain__node', chain), beam = $('.chain__beam', chain);
    nodes.forEach(function (n, i) { setTimeout(function () { n.classList.add('lit'); beam.style.width = (80 * i / (nodes.length - 1)) + '%'; }, REDUCED ? 0 : 300 + i * 450); });
  }

  // Scene art drifts slower than the page.
  addEventListener('scroll', function () {
    $('#nav').classList.toggle('solid', scrollY > 30);
    if (REDUCED) return;
    $$('[data-parallax]', app).forEach(function (el) {
      var r = el.parentNode.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      el.style.transform = 'translate3d(0,' + (r.top * -0.12).toFixed(1) + 'px,0)';
    });
  }, { passive: true });

  // Menus
  function closeMenus() { $('#sol').classList.remove('open'); $('#sol > button').setAttribute('aria-expanded', 'false'); $('#nav').classList.remove('menu-open'); $('#menu-btn').setAttribute('aria-expanded', 'false'); }
  $('#sol > button').addEventListener('click', function (e) { e.stopPropagation(); var o = $('#sol').classList.toggle('open'); this.setAttribute('aria-expanded', String(o)); });
  $('#menu-btn').addEventListener('click', function () { var o = $('#nav').classList.toggle('menu-open'); this.setAttribute('aria-expanded', String(o)); });
  document.addEventListener('click', function (e) { if (!e.target.closest('#sol')) { $('#sol').classList.remove('open'); $('#sol > button').setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(); });
  // Same-hash links (e.g. a section link on the current page) still navigate.
  document.addEventListener('click', function (e) { var a = e.target.closest('a[href^="#/"]'); if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); } });

  addEventListener('hashchange', function () { route(); });
  route(true);
})();
