/**
 * The words in the Triggers guide.
 *
 * Split out from the modal for the same reason PromptGuide splits its
 * content: the writing gets edited far more often than the layout, and
 * nobody should have to read JSX to fix a sentence.
 *
 * WHO THIS IS WRITTEN FOR — someone who builds agents and does not
 * write code. That rules out most of the vocabulary used everywhere
 * else in here: no "clause", no "sweep", no "event row", no
 * "dispatcher". If a sentence needs one of those to make sense, the
 * sentence is wrong.
 *
 * The per-TYPE sections are NOT in this file. They live in each type's
 * descriptor JSON — the same file the server reads — so adding a
 * trigger type means writing its guide beside its defaults, and this
 * file never has to know the type exists.
 */

export interface GuidePoint {
  label: string;
  text: string;
}

export interface GuideSection {
  id: string;
  /** Rail grouping. Sections sharing a group sit under one heading. */
  group: string;
  title: string;
  /** Paragraphs, in order. */
  body: string[];
  /** Labelled points under the paragraphs. */
  points?: GuidePoint[];
  /** Closing callout. */
  note?: string;
  /**
   * Mechanics an author can work without knowing, but will eventually
   * hit. Marked rather than hidden — someone scrolling past should be
   * able to tell "I can skip this for now" without opening anything.
   */
  advanced?: boolean;
}

/** Rail group order. Sections render in this order too. */
export const GUIDE_GROUPS = ['Basics', 'Running it', 'Watching it', 'When it goes wrong'];

export const GUIDE_INTRO =
  'Normally your agent only speaks when it is spoken to. A trigger lets it speak '
  + 'first — it watches this agent’s conversations, and when one matches a rule you '
  + 'wrote, it wakes up a crew to write a message to that person. Nothing here '
  + 'happens until you switch it on.';

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'what',
    group: 'Basics',
    title: 'What a trigger actually is',
    body: [
      'A trigger is a rule with a crew attached. The rule decides WHICH conversations '
      + 'deserve a message right now; the crew decides WHAT to say in each one.',
      'That split matters. The trigger never writes anything itself — it hands the '
      + 'conversation to a crew you picked, and that crew runs exactly as it would if '
      + 'the customer had just said something. It sees the whole conversation, and it '
      + 'has its own prompt, its tools and its knowledge. The only difference is that '
      + 'there is no new customer message to reply to.',
    ],
    points: [
      {
        label: 'Type',
        text: 'What the rule looks for. "Silence" is the one that exists today: the customer has stopped replying.',
      },
      {
        label: 'Crew',
        text: 'Who writes the message. Pick a crew that is allowed to look at the conversation, decide the moment is wrong, and say nothing.',
      },
      {
        label: 'Brief',
        text: 'Optional. One line telling the crew why it is being woken up — "they never finished signing up, get them back". Leave it empty and the crew simply runs as itself.',
      },
    ],
  },

  {
    id: 'switches',
    group: 'Basics',
    title: 'Three switches, and all three must be on',
    body: [
      'This is by far the most common reason a trigger does nothing. Each switch sits '
      + 'at a different level, and any one of them being off stops everything below it '
      + '— quietly and on purpose, because the alternative is messaging real customers '
      + 'by accident.',
    ],
    points: [
      {
        label: '1. The trigger',
        text: 'The ON/OFF on the trigger’s own card. Off means this one rule is not watching.',
      },
      {
        label: '2. The agent',
        text: 'The On/Off beside the Triggers title. Off means no trigger on this agent runs, however many you have.',
      },
      {
        label: '3. The clock',
        text: 'The bar at the top of this screen. Off means nothing is being checked anywhere — not for this agent, not for any other.',
      },
    ],
    note: 'All three start off. A trigger sends real messages to real people, so switching it on should be something you did deliberately.',
  },

  {
    id: 'clock',
    group: 'Running it',
    title: 'The clock',
    body: [
      'Triggers do not watch conversations continuously. A clock wakes up every so '
      + 'often, looks at every agent that has a trigger switched on, and asks each rule '
      + '"does any conversation match right now?". Every conversation that matches has '
      + 'its crew’s chain started. If none matches, the clock goes back to sleep until '
      + 'the next round.',
      'There is ONE clock for the whole server, and it is only an alarm — something '
      + 'that says "time to look". It is not a limit on anything. Every agent can have '
      + 'as many triggers as you like, and one round of the clock checks all of them, '
      + 'on every agent, in one go. Adding triggers does not need more clocks.',
      'This is why a trigger is never instant. If the clock runs every minute, a '
      + 'conversation that goes quiet is noticed within a minute — not the second it '
      + 'happens. About a minute is the sensible setting for real use; the short '
      + 'intervals exist so you do not have to wait around while testing.',
    ],
    points: [
      {
        label: 'Every',
        text: 'How often the clock wakes up. Short while you test, longer once it is live.',
      },
      {
        label: 'Reads',
        text: 'Which version of your agent it takes the triggers from. See the next section — this one catches people out.',
      },
      {
        label: 'Step once',
        text: 'Runs one check immediately instead of waiting for the next round. The fastest way to find out whether your rule matches anybody.',
      },
    ],
    note: 'Because that one clock covers everybody, turning it off stops every agent’s '
      + 'triggers, not only this agent’s. Running several clocks, or giving each agent '
      + 'its own, is possible — there is just no reason to: one alarm can wake up any '
      + 'number of triggers, and they each keep their own timing anyway.',
  },

  {
    id: 'testing',
    group: 'Running it',
    title: 'Testing without waiting for the clock',
    body: [
      'Three buttons run things by hand. Every one of them acts on the chat you have '
      + 'open in the builder chat panel and on nothing else — there is no button '
      + 'anywhere that messages everybody. All three work while the clock is switched '
      + 'off.',
    ],
    points: [
      {
        label: 'Check',
        text: 'On the clock bar. Asks every trigger on this agent whether the open chat is due right now and shows you the numbers — "quiet 4 hours, needs 2 days". Runs nothing, sends nothing, changes nothing. Start here.',
      },
      {
        label: 'Run all',
        text: 'On the clock bar. Runs every trigger on this agent against the open chat, including the ones not due yet — for seeing what the chains actually produce without waiting two days for "due" to arrive.',
      },
      {
        label: 'Run on the open chat',
        text: 'Inside a trigger, beside Delete. The same as Run all, narrowed to that one trigger — for when you are working on one and do not want the others running too.',
      },
    ],
    note: 'The two that RUN use exactly what you have on screen, unsaved edits included — trigger, agent and crew — the same as sending a message in the builder chat yourself. They are real runs: each uses up one of the trigger’s attempts and appears in Admin. "Check" changes nothing at all.',
  },

  {
    id: 'versions',
    group: 'Running it',
    advanced: true,
    title: 'Which version your trigger runs from',
    body: [
      'Your agent can have several versions, and a trigger belongs to the version you '
      + 'made it on. So a trigger you created on an earlier version lives on that '
      + 'version, and a newer one you have not finished does not have it.',
      'Two versions matter:',
    ],
    points: [
      {
        label: 'Published',
        text: 'What your customers have. This is the one that matters in production.',
      },
      {
        label: 'Active',
        text: 'The one you are working on. This is the one you test against.',
      },
    ],
    note: 'This is about the CLOCK. The two by-hand buttons are the exception — they run '
      + 'what is on your screen, saved or not, which is what makes them useful for testing. '
      + 'The bottom line: your trigger has to be on the published or the active version. '
      + 'A trigger sitting on a version that is neither will never run, however clearly '
      + 'you can see it on screen. "Reads" on the clock bar picks which of the two is used.',
  },

  {
    id: 'versions-deep',
    group: 'Running it',
    advanced: true,
    title: 'Why saving matters — the longer version',
    body: [
      'Triggers do not run in your browser. They run on the server, on the clock’s '
      + 'schedule, possibly hours after you have closed the builder. All the server '
      + 'has is what was saved — it cannot see what is on your screen.',
      'That applies to the whole chain, not only the trigger. The trigger names a '
      + 'crew, and the crew that runs is the SAVED one. So if you edit a crew’s '
      + 'prompt and do not save, the trigger still fires — using the older prompt. '
      + 'The message goes out, and it does not match what you were just looking at.',
    ],
    note: 'Save, and make sure the version holding your work is published or active. '
      + 'Everything else in this section follows from those two things — with one '
      + 'exception: the by-hand test buttons send your unsaved work up with the '
      + 'request, so they run what you are looking at. That is exactly why they are '
      + 'the right way to test an edit.',
  },

  {
    id: 'prod',
    group: 'Running it',
    advanced: true,
    title: 'Today: nothing runs in production yet',
    body: [
      'Proactive messaging is deliberately not switched on in production. The piece '
      + 'that would wake the clock up on the live server has not been deployed, so no '
      + 'trigger is reaching real customers right now, on any agent, whatever the '
      + 'switches on this screen say.',
      'Only development runs. A trigger you switch on here can act on the '
      + 'conversations you started yourself in the builder chat, and on nothing else — '
      + 'so you can build one, watch it fire, and know no customer is being messaged.',
    ],
    points: [
      {
        label: 'Testing it now',
        text: 'You do not have to wait for the clock. The next section is the four buttons that run things by hand.',
      },
    ],
    note: 'This is a decision, not a bug. It stays this way until the proactive feature has been checked end to end and is deliberately turned on for production.',
  },

  {
    id: 'fires',
    group: 'Running it',
    title: 'What happens when a conversation matches',
    body: [
      'Matching the rule is not the same as sending a message. Between "this person has '
      + 'been quiet long enough" and an actual message there are two more chances to '
      + 'stop, and then the crew itself gets the final say.',
    ],
    points: [
      {
        label: 'Quiet hours',
        text: 'If you set them, anything matching outside your allowed hours is held back. It is not saved for later — it simply is not sent, and it matches again on the next check inside the window.',
      },
      {
        label: 'Conditions',
        text: 'Optional extra rules about what the agent remembers about this person — "only if they have not paid yet". Anything that fails is skipped.',
      },
      {
        label: 'The crew’s chain',
        text: 'People expect this step to be "send a message". It is not. The trigger starts the crew’s chain — the same chain that runs when a customer writes in. What the chain does is up to the chain: it might look something up, update what the agent remembers, or decide the moment is wrong and stop. A message is one possible ending, not the point.',
      },
      {
        label: 'So no message is normal',
        text: 'A run that ends without a message is a success, not a failure — the chain looked and decided there was nothing worth saying. These show up in Admin as "ran → no message".',
      },
    ],
    note: 'Every one of those outcomes is written down, including the times nothing was sent. "It ran 40 times last night and never said anything" is a problem you can only notice if the quiet ones are recorded too.',
  },

  {
    id: 'delivery',
    group: 'Watching it',
    title: 'Where the message appears',
    body: [
      'When a chain does end in a message, it reaches the person the same way any '
      + 'other message does. There is nothing special about it having been the '
      + 'agent’s idea rather than a reply.',
    ],
    points: [
      {
        label: 'Watching right now',
        text: 'If the chat is open in front of them — the builder chat, or a customer with the chat open — the message arrives on its own, live. Nobody has to refresh, and nobody has to send something first to pull it in.',
      },
      {
        label: 'Not watching',
        text: 'If the chat is closed, the message is simply waiting there next time it is opened, in its right place in the conversation. Nothing is lost and nothing needs re-sending.',
      },
    ],
    note: 'So a nudge that goes out at 3am is not wasted because nobody was looking — it is read at 8am like any other message.',
  },

  {
    id: 'admin',
    group: 'Watching it',
    title: 'Admin → Triggers',
    body: [
      'This screen is for setting rules up. The Triggers tab in Admin is for seeing '
      + 'what they have been doing. Go there after switching something on, and any time '
      + 'you are wondering why a customer did or did not hear from you.',
    ],
    points: [
      {
        label: 'Rules on this agent',
        text: 'Every rule with a one-line heartbeat: when it was last checked and what happened. A rule saying "not checked yet" is telling you one of the three switches is off.',
      },
      {
        label: 'Recent activity',
        text: 'Every conversation any rule acted on, newest first, with the reason it matched. Five things can happen, and only the first is ever seen by a customer:',
      },
      { label: '· Sent a message', text: 'The agent spoke.' },
      { label: '· Stayed quiet', text: 'The crew ran and chose to say nothing.' },
      { label: '· Blocked by conditions', text: 'Matched the rule, then failed your extra conditions.' },
      { label: '· Held — quiet hours', text: 'Matched, but it was the wrong time of day.' },
      { label: '· Failed', text: 'Something went wrong. Open the details for the error.' },
    ],
  },

  {
    id: 'nothing',
    group: 'When it goes wrong',
    title: 'It is not doing anything. Why?',
    body: [
      'Check these in order, because each one hides the ones below it:',
    ],
    points: [
      {
        label: 'Did you save?',
        text: 'A trigger you have edited but not saved exists only in your browser. Save, then reload and check the card is still there.',
      },
      {
        label: 'Is it on the published or the active version?',
        text: 'A trigger only runs from one of those two. If you built it on some other version, nothing will ever happen — publish that version, or make it the active one.',
      },
      {
        label: 'Are all three switches on?',
        text: 'The card, the agent, and the clock. This is the answer most of the time.',
      },
      {
        label: 'Did you pick a crew?',
        text: 'A trigger with no crew has nobody to write the message, so it is skipped entirely.',
      },
      {
        label: 'Has anyone actually matched?',
        text: 'Read the heartbeat on the card or in Admin. It tells the difference between "nobody has been quiet long enough yet" and "somebody was quiet, but has already used all their attempts" — completely different problems with different fixes.',
      },
      {
        label: 'Is it simply too new?',
        text: 'A trigger only reaches conversations where the customer has spoken since you switched it on. It will never go back and nudge your history, so just after switching on there may genuinely be nobody to reach yet.',
      },
    ],
    note: 'Still stuck? Open a chat in the builder chat panel and press "Check" on the clock bar. It asks every trigger whether that one chat is due and tells you what each decided, with the numbers — in seconds, and without running or sending anything.',
  },
];
