# Compound Engineering

The AI-native engineering philosophy.

---

## Introduction

Compound engineering emerged from building Cora, an AI chief of staff for your inbox. The philosophy developed through battle-testing patterns and workflows. The approach will become the default way software is built.

---

## The Philosophy

The core principle: each unit of engineering work should make subsequent units easier—not harder.

Traditional codebases accumulate complexity over time. Features add fragility. After years, teams fight their system rather than build on it.

Compound engineering reverses this: features teach systems new capabilities, bug fixes prevent future bugs, and patterns become tools. Over time, codebases become easier to understand, modify, and trust.

---

## The Main Loop

Every runs five products with primarily single-person engineering teams using this four-step cycle:

**Plan → Work → Review → Compound → Repeat**

The first three steps follow traditional development. The fourth step distinguishes compound engineering.

Time allocation: plan and review comprise 80% of time; work and compound comprise 20%. Most thinking happens before and after code writing.

### Step 1: Plan

Planning transforms ideas into blueprints. Actions and questions:

- Understand the requirement: what's being built, why, what constraints exist?
- Research the codebase: how do similar features work, what patterns exist?
- Research externally: what do framework docs say, what are best practices?
- Design the solution: what's the approach, which files need changes?
- Validate the plan: does it hold together, is it complete?

### Step 2: Work

Execution follows the plan. The agent implements while the developer monitors:

- Set up isolation using git worktrees or branches
- Execute the plan step by step
- Run validations (tests, linting, type checking) after each change
- Track progress
- Handle issues by adapting the plan

Trust the plan—no need to watch every line of code.

### Step 3: Review (Assess)

This step catches issues and captures learnings for the next cycle:

- Have multiple agents review output in parallel
- Prioritize findings: P1 (must fix), P2 (should fix), P3 (nice to fix)
- Resolve findings based on feedback
- Validate fixes
- Capture patterns to prevent recurrence

### Step 4: Compound (The Most Important Step)

Traditional development stops at step three. Compound engineering produces a system that builds features better each time:

- Capture the solution: what worked, what didn't, what's reusable?
- Make it findable: add YAML frontmatter with tags, metadata, categories
- Update the system: add patterns to CLAUDE.md, create new agents as needed
- Verify the learning: would the system catch this automatically next time?

---

## The Plugin

The compound engineering workflow ships as a plugin. Installation requires zero configuration.

### What's Included

- **26 specialized agents**, each trained for specific jobs
- **23 workflow commands**, including the main loop and utilities
- **13 skills**, providing domain expertise like agent-native architecture and style guides

### Installation

**Claude Code:**
```
claude /plugin marketplace add https://github.com/EveryInc/every-marketplace
claude /plugin install compound-engineering
```

**OpenCode (experimental):**
```
bunx @every-env/compound-plugin install compound-engineering --to opencode
```

**Codex (experimental):**
```
bunx @every-env/compound-plugin install compound-engineering --to codex
```

### File Structure

```
your-project/
├── CLAUDE.md              # Agent instructions, preferences, patterns
├── docs/
│   ├── brainstorms/       # /workflows:brainstorm output
│   ├── solutions/         # /workflows:compound output (categorized)
│   └── plans/             # /workflows:plan output
└── todos/                 # /triage and review findings
    ├── 001-ready-p1-fix-auth.md
    └── 002-pending-p2-add-tests.md
```

CLAUDE.md is the most important file agents read each session. Include preferences, patterns, and project context. Document failures so agents learn.

docs/solutions/ builds institutional knowledge—each solved problem becomes searchable documentation that future sessions find automatically.

todos/ tracks work items with priority and status.

### Plugin Structure

```
agents/
├── review/      # 14 code review specialists
├── research/    # Codebase and documents researchers
├── design/      # User interface and Figma sync agents
├── workflow/    # Automation agents
└── docs/        # Documentation agents
commands/
├── workflows/   # Core loop commands
└── *.md         # Utility commands
skills/          # Domain expertise (14 skills)
```

---

## Core Commands

### /workflows:brainstorm

When requirements are fuzzy:
```
/workflows:brainstorm Add user notifications
```

Helps brainstorm what to build and how. Runs lightweight repo research, asks clarifying questions about purpose, users, constraints, and edge cases. Proposes approaches. Results captured in docs/brainstorms/ for handoff to /workflows:plan.

### /workflows:plan

Describe what you want, get back a plan:
```
/workflows:plan Add email notifications when users receive new comments
```

Spawns three parallel research agents: repo-research-analyst, framework-docs-researcher, best-practices-researcher. Then spec-flow-analyzer examines user flows and edge cases. Results merge into a structured plan with affected files and implementation steps.

Enable ultrathink mode for extended reasoning with deeper research—spawns over 40 parallel research agents.

### /workflows:work

Where the agent actually writes code:
```
/workflows:work
```

Four phases: quick start (creates git worktree, sets up branch), execute (implements each task with progress tracking), quality check (optionally spawns five reviewer agents), ship it (runs linting, creates PR).

Each phase has clear entry and exit criteria.

### /workflows:review

Get your PR reviewed by specialized agents:
```
/workflows:review PR#123
```

Spawns 14+ specialized agents in parallel: security-sentinel, performance-oracle, data-integrity-guardian, architecture-strategist, pattern-recognition-specialist, code-simplicity-reviewer, and framework-specific reviewers (DHH-rails, Kieran-rails, TypeScript, Python).

#### Review Agents Detail

**Security:**
- security-sentinel: OWASP top 10, injection attacks, authentication/authorization flaws

**Performance:**
- performance-oracle: N+1 queries, missing indexes, caching opportunities, algorithmic bottlenecks

**Architecture:**
- architecture-strategist: system design, component boundaries, dependency directions
- pattern-recognition-specialist: design patterns, anti-patterns, code smells

**Data:**
- data-integrity-guardian: migrations, transaction boundaries, referential integrity
- data-migration-expert: ID mappings, rollback safety, production data validation

**Quality:**
- code-simplicity-reviewer: YAGNI, unnecessary complexity, readability
- kieran-rails-reviewer: Rails conventions, Turbo Streams, model/controller responsibilities
- kieran-python-reviewer: PEP 8, type hints, Pythonic idioms
- kieran-typescript-reviewer: Type safety, modern ES patterns, clean architecture
- dhh-rails-reviewer: 37signals conventions, simplicity, Omakase stack

**Deployment:**
- deployment-verification-agent: pre-deploy checklists, post-deploy verification, rollback plans

**Frontend:**
- julik-frontend-races-reviewer: Race conditions in JavaScript and Stimulus controllers

**Agent-native:**
- agent-native-reviewer: Features accessible to agents, not just humans

#### Output Format

```
P1 - CRITICAL (must fix):
[ ] SQL injection vulnerability in search query (security-sentinel)
[ ] Missing transaction around user creation (data-integrity-guardian)

P2 - IMPORTANT (should fix):
[ ] N+1 query in comments loading (performance-oracle)
[ ] Controller doing business logic (kieran-rails-reviewer)

P3 - MINOR (nice to fix):
[ ] Unused variable (code-simplicity-reviewer)
[ ] Could use guard clause (pattern-recognition-specialist)
```

The /resolve_pr_parallel command processes findings automatically. P1 issues fixed first, then P2s. Each fix runs in isolation.

### /triage

Present each finding for human decision:
```
/triage
```

Goes through findings one by one: approve (add to to-do list), skip (delete), or customize (modify priority/details). Approved items get status: ready and can be worked on with /resolve_todo_parallel. Use when filtering findings before committing to fixes.

### /workflows:compound

Document a solved problem for future reference:
```
/workflows:compound
```

Spawns six parallel subagents: context analyzer, solution extractor, related docs finder, prevention strategist, category classifier, documentation writer. Creates searchable markdown with YAML frontmatter that future sessions find automatically.

### /lfg

Full pipeline in one command:
```
/lfg Add dark mode toggle to settings page
```

Chains: plan → deepen-plan → work → review → resolve findings → browser tests → feature video → compound. Pauses for plan approval, then runs autonomously, spawns 50+ agents. Returns a PR ready to merge.

---

## Beliefs to Let Go

Eight beliefs about software development are now obstacles:

### 'The code must be written by hand'

The requirement is good code—maintainable code solving the right problem. Who types doesn't matter.

### 'Every line must be manually reviewed'

A core requirement is quality code. Manual line-by-line review is one method; automated systems catching the same issues work too. If you don't trust results, fix the system instead of compensating by doing everything yourself.

### 'Solutions must originate from the engineer'

When AI researches approaches, analyzes tradeoffs, and recommends options, the engineer's job becomes adding taste—knowing which solution fits this codebase, team, and context.

### 'Code is the primary artifact'

A system producing code is more valuable than any individual piece. A single brilliant implementation matters less than a process consistently producing good implementations.

### 'Writing code is the core job function'

A developer's job is shipping value. Code is one input—planning, reviewing, and teaching the system count too. Effective compound engineers write less code and ship more.

### 'First attempts should be good'

First attempts have a 95% garbage rate. Second attempts are still 50%. This isn't failure—it's the process.

Make it your goal to get it right the first time. Focus on iterating fast enough that your third attempt lands in less time than attempt one.

### 'Code is self-expression'

Developers subconsciously see AI development as an identity attack.

But code belongs to the team, product, and users. Letting go of code as self-expression is liberating. No attachment means better feedback acceptance, refactoring without flinching, and skipping code-quality arguments.

### 'More typing equals more learning'

Understanding matters more than muscle memory today.

You learn by reviewing, catching mistakes, and knowing when AI is wrong. The developer reviewing 10 AI implementations understands more patterns than one hand-typing two.

### Transition Challenges

**Less typing feels like less work.** It isn't. Directing an agent requires more thinking than implementation because less time goes to keystrokes, more to important decisions.

**Letting go feels risky.** Autonomous execution triggers anxiety. This fades recognizing you're not ceding control—you're encoding it into constraints, conventions, and review processes scaling better than manual oversight.

**Who built this?** Features shipping without direct code writing feel like cheating. But planning, reviewing, ensuring quality is the work. You did the thinking. AI did the writing.

---

## Beliefs to Adopt

### Extract Your Taste Into the System

Every codebase reflects developer taste—naming conventions, error handling, testing approaches. This taste usually isn't documented; it lives in senior engineers' heads, transferred through code review. This neither scales nor helps others learn.

Solution: Extract and document these choices. Write preferences in CLAUDE.md or AGENTS.md so the agent reads them each session. Build specialized agents for reviewing, testing, deploying. Create skills reflecting your taste. Add slash commands encoding preferred approaches. Point agents to existing style guides, architecture docs, decision records with examples.

Once AI understands how you like writing code, it produces code you approve rather than code you fix.

### The 50/50 Rule

Previously suggested 80/20 for features: 80% planning and review, 20% working and compounding. For broader developer responsibilities: allocate 50% to building features, 50% to improving the system—work creating institutional knowledge rather than shipping something specific.

Traditional teams allocate 90% to features, 10% to everything else. Work that isn't a feature feels like distraction—something done with spare time, which never happens. But "everything else" makes future features easier: creating review agents, documenting patterns, building test generators. When treating that work as overhead instead of investment, codebases accumulate debt.

An hour creating a review agent saves 10 hours of review over the next year. Build a test generator saving weeks of manual test writing. System improvements make work progressively faster and easier; feature work doesn't.

### Trust the Process, Build Safety Nets

AI assistance doesn't scale if every line requires human review. You need trusting AI.

Trust doesn't mean blind faith. It means setting up guardrails such as tests, automatic review, and monitoring flagging issues so you don't watch every step.

When feeling unable to trust output, don't compensate by manually reviewing code. Add a system making that step trustworthy, like creating a review agent.

### Make Your Environment Agent-Native

If a developer can see or do something, the agent should be allowed to see or do it too.

- Running tests
- Checking production logs
- Debugging with screenshots
- Creating pull requests

Anything you don't let agents handle, you do manually. The goal: full environmental parity between human and AI developers.

### Parallelization Is Your Friend

You used to be the bottleneck because human attention allows one task at a time. The new bottleneck is compute—how many agents you can run at once.

Run multiple agents and features simultaneously. Perform review, testing, documentation at once. When stuck on one task, start another, let agents work while planning the next step.

### Plans Are the New Code

The plan document is the most important thing you produce. Instead of traditional code-first-then-document, start with a plan. This becomes the source of truth agents use generating, testing, validating code.

A plan helps capture decisions before they become bugs. Fixing ideas on paper costs less than fixing code later.

### Core Principles

- Every unit of work makes subsequent work easier. Code, documentation, tooling should build on each other.
- Taste belongs in systems, not review. Bake judgment into configuration, schemas, automated checks.
- Teach the system, don't do the work yourself. Time giving agents context pays exponential dividends.
- Build safety nets, not review processes. Build verification infrastructure, not manual gatekeeping.
- Make environments agent-native. Structure projects so AI agents navigate and modify them autonomously.
- Apply compound thinking everywhere. Every artifact enables the next iteration moving faster.
- Embrace the discomfort of letting go. Delegate to AI, accept imperfect results that scale.
- Ship more value. Type less code. Output measured by problems solved, not keystrokes.

---

## Getting Started: The Adoption Ladder

Most developers struggling with AI don't know their stage. Each rung builds mental models required for the next. Figure out where you are and focus on building from there.

### Stage 0: Manual Development

Writing code line by line without AI. Research via documentation and Stack Overflow. Debugging through code reading and print statements. Built great software for decades but isn't fast enough in 2025.

### Stage 1: Chat-Based Assistance

Using AI as a smart reference tool, querying ChatGPT, Claude, or Cursor, receiving snippets, copy-pasting what's useful. AI accelerates research and boilerplate generation, but you're fully in control, reviewing every line.

### Stage 2: Agentic Tools With Line-By-Line Review

Agentic tools enter: Claude Code, Cursor Composer, Copilot Chat. Allow AI to read files and make changes directly based on provided context. You're a gatekeeper, approving or rejecting everything—still painstaking.

Most developers plateau here, missing the upside of handing more to AI.

### Stage 3: Plan-First, PR-Only Review

Everything changes here. Collaborate with AI on detailed plans including requirements, approach, edge cases. Step away allowing AI to implement without supervision. Output is a pull request, which you review. You're out of code details, catching problems in PR review instead of babysitting.

Compound engineering begins—each planning, building, reviewing cycle teaches the system something making the next cycle faster and easier.

### Stage 4: Idea to PR (Single Machine)

Provide an idea; the agent handles everything: codebase research, planning, implementation, test execution, self-review, issue resolution, PR creation. Your involvement shrinks to three steps: ideation, PR review, merge. Running one thing at a time on your computer.

### Stage 5: Parallel Cloud Execution (Multiple Devices)

Move execution to the cloud, run things in parallel. Not tied to a laptop; direct agents from anywhere—coffee shop, beach, phone.

Kick off three features; three agents work independently; review PRs as they finish. Push further allowing agents to monitor feedback, propose fixes without asking. No longer an individual contributor—commanding a fleet.

---

## How to Level Up

### 0 → 1: Start Collaborating

- **Pick one tool.** Current preference: Cursor with Opus 4.5 or Claude Code.
- **Ask questions first.** Before writing code, ask AI to explain existing code.
- **Delegate boilerplate.** Hand over boring stuff first: tests, config files, repetitive functions.
- **Review everything.** Learning happens when you review every line.
- **Compounding move:** Keep running note of prompts that worked well. Good prompts are reusable.

### 1 → 2: Let the Agent In

- **Switch to agentic mode.** Give agent file system access.
- **Start with targeted changes.** Something narrow: "Add a test for this function."
- **Approve each action.** Build intuition about when to trust the agent.
- **Review diffs, not just code.** What changes matters more than what exists.
- **Compounding move:** Create a CLAUDE.md file, document preferences. When agent makes a mistake, add a note so it improves.

### 2 → 3: Trust the Plan (Key Transition)

- **Invest in planning.** Spell out requirements, approach, edge cases.
- **Let the agent research.** Allow AI to read the codebase, find patterns, suggest approaches.
- **Make the plan explicit.** Write the plan down, make it specific so it's reviewable later.
- **Execute and step away.** Ask agent to implement the plan, leave it running until complete.
- **Review at PR level.** Check the final result instead of individual steps or lines.
- **Compounding move:** After each implementation, document what the plan missed.

### 3 → 4: Describe, Don't Plan

- **Give outcomes, not instructions.** Tell agent to "Add email notifications for new comments," let it determine implementation.
- **Let the agent plan.** Planning should become its responsibility.
- **Approve the approach.** Review the plan before implementation, reject bad directions early.
- **Review the PR.** Agent reviews its own work; you check the final result.
- **Compounding move:** Build library of outcome-focused instructions that worked.

### 4 → 5: Parallelize Everything

- **Move execution to the cloud.** Agents run on remote infrastructure.
- **Run parallel work streams.** Give three agents three different features simultaneously.
- **Build a queue.** Put ideas, bugs, improvements into queue; agents work on them when they have capacity.
- **Enable proactive operation.** Agents can monitor feedback, spot opportunities, propose features without being asked.
- **Compounding move:** Document which tasks can be done in parallel well.

---

## Three Questions

Even without fancy multi-agent review systems, get benefits by asking three questions before approving any AI output:

1. **"What was the hardest decision you made here?"** Forces AI to reveal tricky parts where it made judgment calls.
2. **"What alternatives did you reject, and why?"** Shows options it considered; helps catch bad choices.
3. **"What are you least confident about?"** Gets AI to admit where it might be wrong.

---

## Best Practices

### Agent-Native Architecture

Agent-native architecture means giving the agent the same capabilities you have. If the agent can't run tests, you do. If it can't see logs, you debug. Every capability you withhold becomes a task you do yourself.

#### The Agent-Native Checklist

Can your agent:

**Development environment**
- Run your application locally
- Run your test suite
- Run linters and type checkers
- Run database migrations
- Seed development data

**Git operations**
- Create branches
- Make commits
- Push to remote
- Create pull requests
- Read PR comments

**Debugging**
- View local logs
- View production logs (read-only)
- Take screenshots of the UI
- Inspect network requests
- Access error tracking (Sentry, etc.)

#### Progressive Agent-Native

**Level 1: Basic Development**
Agents have file access, can run tests and git commits. This unlocks basic compound engineering.

**Level 2: Full Local**
Agents have browser access, local logs, ability to create pull requests. Enables stages 3–4.

**Level 3: Production Visibility**
Agents have production logs (read-only), error tracking, monitoring dashboards. Enables proactive debugging.

**Level 4: Full Integration**
Agents have ticket system access, deployment capabilities, external service integration. Enables stage 5.

#### The Agent-Native Mindset

- **When building features:** "How will the agent interact with this?"
- **When debugging:** "What would the agent need to see?"
- **When documenting:** "Will the agent understand this?"

### Skip Permissions

By default Claude Code asks for permission before every action. The `--dangerously-skip-permissions` flag turns those prompts off.

**Use it when:**
- You trust the process (good plan, good review systems)
- You're in a safe environment (sandbox, feature branch)
- You want velocity

**Don't use it when:**
- You're learning
- You're in production (never)
- You don't have good rollback

**Always run with skip permissions (alias):**
```
alias cc='claude --dangerously-skip-permissions'
```

**Safety without prompts:**
- Git is your safety net — `git reset --hard HEAD~1` to undo
- Tests catch mistakes
- Review before merge
- Worktrees isolate risk

### Design Workflow

#### The Baby App Approach

Create a throwaway project for iterating freely without worrying about tests, architecture, or breaking anything. Once design feels right, extract patterns and bring them back to the real project.

1. Create a prototype repo
2. Vibe code the design
3. Iterate until it looks right
4. Capture the design system (colors, spacing, typography, component patterns)
5. Transfer to main app

#### UX Discovery Loop

1. Generate multiple versions
2. Click through each one
3. Share with users
4. Collect feedback on functional prototypes
5. **Delete everything and start over with a proper plan**

#### Codifying Design Taste

```
# skill: our-design-system

## Colors
- Primary: #4F46E5
- Background: #F9FAFB

## Spacing
- Use 4px base unit
- Sections: 32px gap

## Patterns
- Buttons: 12px horizontal padding
- Cards: subtle shadows, not borders
- Forms: single-column, max-width 400px
```

#### Design Agents

- **design-iterator**: Takes screenshot, analyzes what's not working, makes improvements, repeats
- **figma-design-sync**: Pulls design from Figma, compares to what's built, fixes differences automatically
- **design-implementation-reviewer**: Checks implementations match Figma specifications

### Vibe Coding

For people who don't care about the code itself—they want results.

**The fast path:**
1. Describe what you want: `/lfg Create a web app that lets me track my daily habits with checkboxes`
2. Wait
3. Check if it works. If not, say what's wrong.

**Perfect for:** Personal projects, prototypes, experiments, internal tools, UX exploration

**Not great for:** Production systems, code others will maintain, security-sensitive apps, performance-critical systems

**The vibe coding paradox:** Vibe code to discover what you want, then spec to build it properly. The spec always wins for final implementation, but vibe coding accelerates discovery.

### Team Collaboration

**Traditional:** Person A writes code → Person B reviews → Discussion → Merge

**Compound:** Person A creates plan → AI implements → AI agents review → Person B reviews the AI review → Human approves → Merge

#### Team Standards

- **Plan approval:** Require explicit sign-off before implementation. Silence is not approval.
- **PR ownership:** The person who initiated the work owns the PR, regardless of who (or what) wrote the code.
- **Human review focus:** When AI agents have already analyzed a PR, human reviewers focus on intent, not implementation. Ask: Does this match what we agreed to build? Are there business logic issues?

#### Communication Patterns

**Async by default:** Plans can be created, reviewed, and approved without scheduling a meeting.

**Explicit handoffs:**
```
## Handoff: Email Notifications
From: Kieran → To: Dan
Status: Plan approved, implementation 50%
What's left: User preference settings, unsubscribe flow
How to continue: Run /work in the feature branch
```

**Compound docs = tribal knowledge:** Instead of "Ask Sarah, she knows how auth works," Sarah runs /compound after implementing. Now the solution is documented, and anyone can find it.

### User Research

#### Structuring Research

```yaml
# research/interviews/user-123.md
---
participant: Marketing Manager, B2B SaaS
date: 2025-01-15
focus: Dashboard usage patterns
---

## Key Insights

### Insight: Morning dashboard ritual
**Quote**: "First thing every morning, I check for red flags."
**Implication**: Dashboard needs to surface problems quickly.
**Confidence**: 4/5 participants
```

#### Building Persona Documents

```yaml
# personas/marketing-manager.md

## Goals
1. Prove marketing ROI to leadership
2. Identify underperforming campaigns quickly

## Frustrations
1. Too much data, hard to find what matters
2. Exporting for reports is tedious

## Quotes
- "I need to see problems, not everything."
- "My boss wants a PDF, not a link."
```

#### Research-Informed Planning

```
/workflows:plan Add export scheduling

Research context:
- 3/5 interviewed users mentioned exporting weekly
- The marketing-manager persona exports every Friday
- Current pain: manual export process

Design for: Automated weekly exports to email
```

### Data Pattern Extraction

Your users are already telling you what to build through how they use your product.

**Heavy usage patterns:** Features used way more than expected. Users returning to the same page repeatedly.

**Struggle patterns:** High dwell time on simple pages. Repeated attempts at same action. Error → retry → error loops.

**Workaround patterns:** Users exporting from one place and reimporting elsewhere. Copying/pasting between screens.

**Abandonment patterns:** Users drop off in flows. Features started but not completed.

**From patterns to features:**
- Users copying data between tables 50x/week → "sync to table B" button
- Users creating "template" projects and duplicating → first-class template support

### Copywriting

#### Copy Is Part of the Plan

```
## Feature: Password Reset Flow

### User-Facing Copy
- Email subject: "Reset your password"
- Success message: "Check your email. We sent a reset link."
- Error (not found): "We couldn't find an account with that email.
  Want to create one instead?"
```

#### Codify Your Voice

```
# skill: our-copy-voice

## Principles
1. Talk to users like humans, not robots
2. Error messages should help, not blame
3. Short sentences. Clear words.

## Words to Avoid
- "Invalid" → "didn't work"
- "Error" → describe what happened
- "Successfully" → just say what happened
- "Please" → just ask directly

## Examples
Bad: "Invalid credentials. Please try again."
Good: "That password isn't right. Try again or reset it."
```

### Product Marketing

The same system that builds features can announce them.

**The compound flow:**
1. Engineer creates plan that includes the product value proposition
2. AI implements feature
3. AI generates release notes from the plan
4. AI generates social posts from the release notes
5. AI generates screenshots using Playwright
6. Engineer reviews and ships everything together

**Generating release notes:**
```
Based on the plan and implementation for [feature], write release notes:
1. Lead with the user benefit (what can they do now?)
2. Include one concrete example
3. Mention any breaking changes
4. Keep it under 200 words
```

**Generating changelogs:**
```
/changelog
```
Looks at recent merges to main, reads the plans/PRs for each, generates an engaging changelog.
