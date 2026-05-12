# Architecture Refactor — Agents Consolidation & `modules/` Flattening

Branch: `refactor/architecture-cleanup`

## Motivation

`apps/api/src` mixes two architectural conventions: most features live at the
top-level (`auth/`, `billing/`, `media/`, `agents/`, ...), but a `modules/`
sub-tree nests `agents/`, `image-generation/`, and `lora/`. There are also
**two** `AgentsModule` definitions (`AgentsModule` and `Phase1AgentsModule`),
each owning a disjoint set of agents. This refactor flattens `modules/` and
consolidates agents into a single coherent module.

## Constraints

- Pure structural refactor — **no runtime behaviour changes**.
- Use `git mv` so history is preserved.
- Do **not** touch knowledge-base / brand / crawler / knowledge / seo modules.
- Do **not** touch `loraloop-py/` or `loraloop-ui/`.
- Do **not** delete dead code; flag it instead.

## Before

```
apps/api/src/
├── agents/                       # AgentsModule (Clara/Sarah/Mark/Sophie/Theo/Elena)
│   ├── agents.module.ts
│   ├── base-agent.ts
│   ├── clara/   { clara.agent.ts, clara.prompts.ts, clara.tools.ts }
│   ├── elena/   { elena.agent.ts, elena.prompts.ts, elena.tools.ts }
│   ├── mark/    { ... }
│   ├── sarah/   { ... }
│   ├── sophie/  { ... }
│   └── theo/    { ... }
├── media/        # MediaModule
├── modules/                      # ← anomaly
│   ├── agents/                   # Phase1AgentsModule (Lora/Sam/Clara/Steve/Sarah)
│   │   ├── agent.types.ts
│   │   ├── agents.module.ts
│   │   ├── agents.service.ts
│   │   ├── prompts/  { lora|sam|clara|steve|sarah.prompt.ts }
│   │   └── steve/    { steve.service.ts }
│   ├── image-generation/
│   │   ├── image-generation.module.ts
│   │   ├── image-generation.service.ts
│   │   ├── image-generation.types.ts
│   │   └── providers/ { gemini-image.provider.ts, openai-image.provider.ts }
│   └── lora/                     # LoraModule (orchestrator)
│       ├── lora.controller.ts
│       ├── lora.gateway.ts
│       ├── lora.module.ts
│       ├── lora.orchestrator.ts
│       ├── lora.service.ts
│       ├── dto/
│       └── processors/
└── (rest of features at top-level)
```

## After

```
apps/api/src/
├── agents/                       # SINGLE unified AgentsModule
│   ├── agents.module.ts          # exports all agents + AgentsService
│   ├── agents.service.ts         # moved from modules/agents/
│   ├── agent.types.ts            # moved from modules/agents/
│   ├── base-agent.ts
│   ├── clara/   { clara.agent.ts, clara.prompts.ts, clara.tools.ts, clara.system-prompt.ts }
│   ├── elena/   { ... }
│   ├── mark/    { ... }
│   ├── sarah/   { sarah.agent.ts, sarah.prompts.ts, sarah.tools.ts, sarah.system-prompt.ts }
│   ├── sophie/  { ... }
│   ├── theo/    { ... }
│   ├── steve/   { steve.service.ts, steve.system-prompt.ts }     # promoted from modules/agents/steve/
│   ├── lora/    { lora.system-prompt.ts }                        # Phase-1 lora reviewer prompt
│   └── sam/     { sam.system-prompt.ts }
├── media/
│   ├── media.module.ts
│   ├── media.service.ts
│   ├── media.controller.ts
│   └── image-generation/         # promoted from modules/image-generation/
│       ├── image-generation.module.ts
│       ├── image-generation.service.ts
│       ├── image-generation.types.ts
│       └── providers/ { gemini-image.provider.ts, openai-image.provider.ts }
├── lora/                         # promoted from modules/lora/ — orchestrator feature module
│   ├── lora.module.ts
│   ├── lora.controller.ts
│   ├── lora.service.ts
│   ├── lora.orchestrator.ts
│   ├── lora.gateway.ts
│   ├── dto/
│   └── processors/
└── (rest unchanged)
```

`apps/api/src/modules/` is removed entirely.

## File moves (all via `git mv`)

### modules/agents/* → agents/

| From                                              | To                                             |
| ------------------------------------------------- | ---------------------------------------------- |
| `modules/agents/agents.service.ts`                | `agents/agents.service.ts`                     |
| `modules/agents/agent.types.ts`                   | `agents/agent.types.ts`                        |
| `modules/agents/steve/steve.service.ts`           | `agents/steve/steve.service.ts`                |
| `modules/agents/prompts/lora.prompt.ts`           | `agents/lora/lora.system-prompt.ts`            |
| `modules/agents/prompts/sam.prompt.ts`            | `agents/sam/sam.system-prompt.ts`              |
| `modules/agents/prompts/clara.prompt.ts`          | `agents/clara/clara.system-prompt.ts`          |
| `modules/agents/prompts/steve.prompt.ts`          | `agents/steve/steve.system-prompt.ts`          |
| `modules/agents/prompts/sarah.prompt.ts`          | `agents/sarah/sarah.system-prompt.ts`          |

`modules/agents/agents.module.ts` (Phase1AgentsModule) is **deleted** — its
`AgentsService` provider is merged into the unified `AgentsModule` at
`agents/agents.module.ts`.

`modules/agents/prompts/` directory is removed after the file moves.

### modules/image-generation/* → media/image-generation/

| From                                                                | To                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `modules/image-generation/image-generation.module.ts`               | `media/image-generation/image-generation.module.ts`                 |
| `modules/image-generation/image-generation.service.ts`              | `media/image-generation/image-generation.service.ts`                |
| `modules/image-generation/image-generation.types.ts`                | `media/image-generation/image-generation.types.ts`                  |
| `modules/image-generation/providers/gemini-image.provider.ts`       | `media/image-generation/providers/gemini-image.provider.ts`         |
| `modules/image-generation/providers/openai-image.provider.ts`       | `media/image-generation/providers/openai-image.provider.ts`         |

### modules/lora/* → lora/

| From                            | To                       |
| ------------------------------- | ------------------------ |
| `modules/lora/lora.module.ts`   | `lora/lora.module.ts`    |
| `modules/lora/lora.controller.ts` | `lora/lora.controller.ts` |
| `modules/lora/lora.service.ts`  | `lora/lora.service.ts`   |
| `modules/lora/lora.orchestrator.ts` | `lora/lora.orchestrator.ts` |
| `modules/lora/lora.gateway.ts`  | `lora/lora.gateway.ts`   |
| `modules/lora/dto/**`           | `lora/dto/**`            |
| `modules/lora/processors/**`    | `lora/processors/**`     |

## Import updates

### `apps/api/src/app.module.ts`

```diff
- import { LoraModule } from './modules/lora/lora.module';
+ import { LoraModule } from './lora/lora.module';
```

### `apps/api/src/agents/agents.module.ts` (rewritten)

Adds `AgentsService` provider/export and `SteveService`. Imports
`LlmRouterModule` and `PrismaModule` (transitively used by `AgentsService` and
`SteveService`). `Phase1AgentsModule` deleted.

### `apps/api/src/agents/agents.service.ts` (formerly `modules/agents/agents.service.ts`)

```diff
- import { LlmRouterService } from '../../llm-router/llm-router.service';
- import { PrismaService } from '../../prisma/prisma.service';
+ import { LlmRouterService } from '../llm-router/llm-router.service';
+ import { PrismaService } from '../prisma/prisma.service';
- import { LORA_SYSTEM_PROMPT } from './prompts/lora.prompt';
- import { SAM_SYSTEM_PROMPT } from './prompts/sam.prompt';
- import { CLARA_SYSTEM_PROMPT } from './prompts/clara.prompt';
- import { STEVE_SYSTEM_PROMPT } from './prompts/steve.prompt';
- import { SARAH_SYSTEM_PROMPT } from './prompts/sarah.prompt';
+ import { LORA_SYSTEM_PROMPT } from './lora/lora.system-prompt';
+ import { SAM_SYSTEM_PROMPT } from './sam/sam.system-prompt';
+ import { CLARA_SYSTEM_PROMPT } from './clara/clara.system-prompt';
+ import { STEVE_SYSTEM_PROMPT } from './steve/steve.system-prompt';
+ import { SARAH_SYSTEM_PROMPT } from './sarah/sarah.system-prompt';
```

### `apps/api/src/agents/steve/steve.service.ts`

```diff
- import { PrismaService } from '../../../prisma/prisma.service';
- import { ImageGenerationService } from '../../image-generation/image-generation.service';
- import { LoraGateway } from '../../lora/lora.gateway';
- import type { AgentsService } from '../agents.service';
- import type { ImageTaskType, BrandContext } from '../../image-generation/image-generation.types';
+ import { PrismaService } from '../../prisma/prisma.service';
+ import { ImageGenerationService } from '../../media/image-generation/image-generation.service';
+ import { LoraGateway } from '../../lora/lora.gateway';
+ import type { AgentsService } from '../agents.service';
+ import type { ImageTaskType, BrandContext } from '../../media/image-generation/image-generation.types';
```

### `apps/api/src/lora/lora.module.ts`

```diff
- import { Phase1AgentsModule } from '../agents/agents.module';
- import { LlmRouterModule } from '../../llm-router/llm-router.module';
- import { PrismaModule } from '../../prisma/prisma.module';
- import { StorageModule } from '../../storage/storage.module';
- import { ImageGenerationModule } from '../image-generation/image-generation.module';
- import { QueueModule } from '../../queue/queue.module';
- import { BillingModule } from '../../billing/billing.module';
- import { SteveService } from '../agents/steve/steve.service';
+ import { AgentsModule } from '../agents/agents.module';
+ import { LlmRouterModule } from '../llm-router/llm-router.module';
+ import { PrismaModule } from '../prisma/prisma.module';
+ import { StorageModule } from '../storage/storage.module';
+ import { ImageGenerationModule } from '../media/image-generation/image-generation.module';
+ import { QueueModule } from '../queue/queue.module';
+ import { BillingModule } from '../billing/billing.module';
```

`Phase1AgentsModule` replaced by `AgentsModule`. `SteveService` continues to
be provided/exported by `LoraModule` (not `AgentsModule`) because it depends
on `LoraGateway`; moving it into `AgentsModule` would create a circular
module dependency (`AgentsModule` → `LoraModule` → `AgentsModule`). The
service file itself still lives at `agents/steve/steve.service.ts` for
filesystem coherence.

### `apps/api/src/lora/lora.orchestrator.ts`

```diff
- import { PrismaService } from '../../prisma/prisma.service';
- import { LlmRouterService } from '../../llm-router/llm-router.service';
- import { AgentsService } from '../agents/agents.service';
- } from '../agents/agent.types';
- import { LORA_SYSTEM_PROMPT } from '../agents/prompts/lora.prompt';
+ import { PrismaService } from '../prisma/prisma.service';
+ import { LlmRouterService } from '../llm-router/llm-router.service';
+ import { AgentsService } from '../agents/agents.service';
+ } from '../agents/agent.types';
+ import { LORA_SYSTEM_PROMPT } from '../agents/lora/lora.system-prompt';
```

### `apps/api/src/lora/lora.service.ts`, `lora.controller.ts`, `lora.gateway.ts`

`../../` → `../` for all foundation imports.

### `apps/api/src/lora/processors/*.ts`

All `../../../foo` → `../../foo` and `../../../modules/agents/...` → `../../agents/...`.

### `apps/api/src/media/image-generation/image-generation.module.ts`, `image-generation.service.ts`

`../../storage/...` → `../../storage/...` (depth unchanged — moved one up, one
down, net zero). Verified: still `../../`.

### `apps/api/src/media/image-generation/providers/*.ts`

No external-package imports change; only relative imports within
`image-generation/` (unchanged depth).

## Cleanup

After all moves, `apps/api/src/modules/` directory is empty and will be removed.

## Verification

Run `pnpm --filter @loraloop/api exec tsc --noEmit` after the changes. If the
workspace lacks installed dependencies and install is too slow in this
environment, the typecheck is skipped and noted in the commit message.

## Dead-code / smell flags (NOT touched in this refactor)

- `apps/api/src/agents/agents.service.ts` (new location) uses **mock outputs**
  as fallbacks throughout — this is intentional but should be revisited once
  the LLM router is universally injected.
- `agents.service.ts` defines its own `AgentName` union (`Lora | Sam | Clara |
  Steve | Sarah`) while the agent-class agents (Mark, Sophie, Theo, Elena) are
  not represented in that union. There's a latent dual-naming problem: some
  agents are Nest providers (BaseAgent subclasses), others are dispatched
  via a string union inside `AgentsService`. Worth unifying long-term.
- `apps/api/src/agents/agent.types.ts` `assignAgent()` only routes to the
  five Phase-1 agents — it never returns Mark/Sophie/Theo/Elena.
- `steve.service.ts` imports `AgentsService` only as `type` (unused at
  runtime) — could be removed but kept to preserve behaviour.
- Nick is referenced in docs but no `nick/` agent directory exists yet.
- `loraloop-py/` and `loraloop-ui/` are intentionally untouched per
  instructions.
- `apps/api/src/seo/` and `apps/api/src/visual/` define full NestJS modules
  (`SeoModule`, `VisualModule`) but neither is imported in `app.module.ts` —
  they are wired nowhere and currently inert. Per instructions the knowledge
  base / SEO funnel must not be modified, so left in place. Worth confirming
  whether they should be registered or removed.
- `apps/api/src/agents/sam/` and `apps/api/src/agents/lora/` contain only a
  `*.system-prompt.ts` (no `.agent.ts`, no `.tools.ts`). They are intentional
  for prompt-driven Phase-1 agents — kept this way so each agent still owns
  its own directory.
