/**
 * The words in the "Work with your AI" wizard.
 *
 * Split out from the component for the same reason the other guides split
 * theirs: the writing gets edited far more often than the layout, and
 * nobody should have to read JSX to fix a sentence.
 *
 * WHO THIS IS WRITTEN FOR — someone who builds agents and does not write
 * code, following along on their own machine for the first time.
 *
 * WHAT CHANGED, AND WHY IT MATTERS. This used to walk through installing
 * Git and cloning the repository. It no longer does: a repository cannot
 * be granted per-folder, so a clone hands over everything, and it put a
 * GitHub account and two command-line steps in front of someone who does
 * not use a terminal. The Builder now writes the platform files straight
 * into a folder she picks.
 *
 * DELIBERATELY TOOL-AGNOSTIC. The instructions are one plain markdown
 * file with no special format; the only thing that differs between the
 * tools is what it gets saved as. That difference lives HERE, in the
 * wizard — never in a second copy of the file.
 */

/** An AI coding tool the instructions work with. */
export interface WizardTool {
  id: string;
  label: string;
  /** Where to download it. */
  installUrl: string;
  /** What the instructions file must be called for this tool to load it
   *  automatically. */
  filename: string;
  /** One line on the choice — what this tool is like to use. */
  about: string;
}

/**
 * The file is identical for both; only the name changes. Claude Code
 * reads CLAUDE.md, Codex reads AGENTS.md.
 */
export const TOOLS: WizardTool[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    installUrl: 'https://claude.ai/download',
    filename: 'CLAUDE.md',
    about: 'Desktop app. No terminal needed.',
  },
  {
    id: 'codex',
    label: 'OpenAI Codex',
    installUrl: 'https://chatgpt.com/codex',
    filename: 'AGENTS.md',
    about: 'Desktop app, CLI or IDE — whichever you use.',
  },
];

/**
 * Which tool she actually uses, remembered across sessions.
 *
 * The choice used to live in the dialog's own state, which meant it reset
 * to the first tool every time the dialog opened — she re-picked Codex on
 * every visit, and nothing outside the dialog could know what she had
 * chosen. The toolbar button now says the name of the app she installed
 * ("Claude Code", "Codex") rather than the word "AI", and that only works
 * if the answer outlives the dialog.
 */
const TOOL_KEY = 'builder:aiTool';

/** The tool she picked, or the first one for someone who never opened the
 *  chooser — a default is honest here, since the two differ only in what
 *  the instructions file gets called. */
export function chosenTool(): WizardTool {
  let id: string | null = null;
  try { id = localStorage.getItem(TOOL_KEY); } catch { /* private mode */ }
  return TOOLS.find(t => t.id === id) ?? TOOLS[0];
}

export function rememberTool(id: string): void {
  try { localStorage.setItem(TOOL_KEY, id); } catch { /* private mode */ }
}

export interface WizardStep {
  id: string;
  title: string;
  /** Paragraphs, in order. */
  body: string[];
  /** Closing caution or aside. */
  note?: string;
}

export const WIZARD_INTRO =
  'Build agents by talking to an AI assistant on your own computer. It reads the real platform code and the real conversations, and writes its changes to a draft file — you review the draft here in the Builder and press save. Nothing becomes real until you do, so you cannot break anything.';

export const STEPS: WizardStep[] = [
  {
    id: 'install',
    title: 'Install your AI tool',
    body: [
      'Download it and sign in. Pick the desktop app if the tool offers one — then you never need a terminal.',
    ],
    note: 'It has to run on your own computer. The browser versions run on a remote machine and cannot see your files, which is how all of this works.',
  },
  {
    id: 'folder',
    title: 'Pick a folder',
    body: [
      'Make a new folder inside your Documents — call it something you will recognise, like "lybi-agents" — and choose it. This is where your assistant will work.',
      'Keep it in Documents: that is how the Builder can tell your assistant exactly where to find everything. The picker opens there for you.',
      'You only do this once; the Builder remembers it. Your browser will ask permission to edit files in that folder — that prompt is the browser’s own, and you have to allow it.',
    ],
  },
  {
    id: 'files',
    title: 'Get the platform files',
    body: [
      'This writes everything your assistant needs into that folder: how the Builder actually runs an agent, what every addon does, the field and prompt rules, and the instructions telling it how to work with you.',
      'About ninety files. Takes a few seconds.',
    ],
    note: 'When we change the platform, this step will tell you your copy is out of date — one click to refresh it.',
  },
  {
    id: 'send',
    title: 'Your draft now lives there',
    body: [
      'From now on, the agent you are editing saves into that folder every time you change something — the same way the Builder already keeps a draft for you in the browser.',
      'That means your assistant is always looking at your current work. There is nothing to send and nothing to remember.',
    ],
  },
  {
    id: 'prompt',
    title: 'Start the conversation',
    body: [
      'Open your AI tool, point it at that folder, and paste this as your first message. It tells the assistant what it is working on, where everything is, and what it must not do.',
    ],
  },
  {
    id: 'go',
    title: 'Then just talk to it',
    body: [
      'Ask for what you want — "show me how the classification crew works", or "the agent ignored my instruction in conversation 412, find out why".',
      'When it changes something, the Builder tells you and asks whether to load it. Read what changed, then Save if it is right.',
    ],
  },
];

/**
 * The first message to paste into the AI session.
 *
 * Worth handing over rather than leaving to chance: a session that starts
 * by reading the instructions and the real code behaves completely
 * differently from one that starts by guessing. `{{FILENAME}}` and
 * `{{AGENT}}` are filled in from live values.
 */
export const STARTING_PROMPT = `{{WHERE}}

Before anything else, check that you can actually see ./{{FILENAME}} and ./aspect-agent-server/ in your working directory. If you cannot see them, STOP and tell me — do not go looking elsewhere and do not guess. It means you were opened in the wrong folder, and everything after this depends on being in the right one.

Your job is to help me build, change and debug agents on the Lybi platform — writing their prompts, adding fields, addons and crews, and working out why one behaved the way it did in a real conversation.

Once you can see them, read ./{{FILENAME}} — it explains how the Builder works, how to read an agent, how to create a crew, and how to investigate a conversation that went wrong. Follow it.

Some orientation:

- ./aspect-agent-server/ holds the platform's own source code. That is the real code that runs the agents — read it rather than guessing how something behaves.
- I am working on the agent "{{AGENT}}". Its current version is ./drafts/{{SLUG}}.json. If that file is not there, pull the agent from the API the way the instructions describe and write it yourself — tell me you did that, but do not send me back to the Builder to create it.
- My builder id is in ./.lybi/config.json. You need it for the API calls described in the instructions.

How we work together:

- You edit ./drafts/{{SLUG}}.json. I review your changes in the Builder and save them myself — never call anything that writes to the server.
- Make small, targeted edits rather than rewriting the whole file, so I can see what actually changed.
- You can add a crew by putting it in that file; I will see it and save it. You cannot delete one — tell me and I will. A brand-new agent needs a call you should ask me about first.
- Ask me when something is ambiguous instead of guessing.

Start by reading the instructions file, then tell me in a sentence or two what you can see and what you can do.`;

/** Shown under the steps — the handful of habits that decide whether this
 *  works well or badly. */
export const TIPS: string[] = [
  'One thing at a time. A short request you can check beats a long specification pasted in one go.',
  'Look at the draft in the Builder as you go, not only at the end.',
  'Let it ask you questions — answering one costs a minute, a wrong guess costs the afternoon.',
  'Tell it when it is wrong. It cannot see your screen.',
  'If it seems to be guessing, tell it to go and read the actual code or the actual conversation. It has both.',
];
