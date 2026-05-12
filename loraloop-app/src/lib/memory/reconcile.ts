import { callGemini } from '../gemini';
import { retrieveMemories } from './retrieve';
import { upsertMemory, supersedeMemory, logEvent } from './store';
import type {
  MemoryRecord,
  ReconcileDecision,
  ReconcileInput,
} from './types';

/**
 * Mem0-style memory reconciliation.
 *
 * For each candidate fact, recall the closest existing memories in the same
 * layer + scope, then ask an LLM to decide ADD / UPDATE / DELETE / NOOP.
 *
 * Critical property: we never destructively overwrite memory. UPDATE creates
 * a new row and supersedes the old one via `superseded_by`, preserving the
 * full audit trail for replay and debugging.
 */
export async function reconcileFact(input: ReconcileInput): Promise<{
  decision: ReconcileDecision;
  resultingMemoryId?: string;
}> {
  const neighbours = await retrieveMemories({
    workspaceId: input.workspaceId,
    query:       input.candidateFact,
    layers:      [input.layer],
    agentScopes: [input.agentScope, 'shared'],
    limit:       5,
  });

  if (neighbours.length === 0) {
    const added = await upsertMemory({
      workspaceId: input.workspaceId,
      layer:       input.layer,
      agentScope:  input.agentScope,
      content:     input.candidateFact,
      metadata:    input.metadata ?? {},
      sourceType:  input.sourceType,
      sourceId:    input.sourceId,
      importance:  5,
      confidence:  1.0,
    });
    return {
      decision: { action: 'add', reason: 'no neighbours — first memory of its kind' },
      resultingMemoryId: added.id,
    };
  }

  const decision = await llmJudge(input.candidateFact, neighbours.map((n) => ({ id: n.id, content: n.content })));

  switch (decision.action) {
    case 'add': {
      const added = await upsertMemory({
        workspaceId: input.workspaceId,
        layer:       input.layer,
        agentScope:  input.agentScope,
        content:     decision.mergedContent ?? input.candidateFact,
        metadata:    input.metadata ?? {},
        sourceType:  input.sourceType,
        sourceId:    input.sourceId,
        importance:  5,
        confidence:  1.0,
      });
      return { decision, resultingMemoryId: added.id };
    }

    case 'update': {
      const merged = await upsertMemory({
        workspaceId: input.workspaceId,
        layer:       input.layer,
        agentScope:  input.agentScope,
        content:     decision.mergedContent ?? input.candidateFact,
        metadata:    { ...(input.metadata ?? {}), supersedes: decision.targetId },
        sourceType:  input.sourceType,
        sourceId:    input.sourceId,
        importance:  6,
        confidence:  1.0,
      });
      if (decision.targetId) {
        await supersedeMemory(decision.targetId, merged.id);
      }
      return { decision, resultingMemoryId: merged.id };
    }

    case 'delete': {
      if (decision.targetId) {
        await supersedeMemory(decision.targetId, decision.targetId);
        await logEvent({
          workspaceId: input.workspaceId,
          memoryId:    decision.targetId,
          agent:       input.agentScope,
          kind:        'delete',
          delta:       { reason: decision.reason },
        });
      }
      return { decision };
    }

    case 'noop': {
      await logEvent({
        workspaceId: input.workspaceId,
        agent:       input.agentScope,
        kind:        'noop',
        delta:       { candidate: input.candidateFact, reason: decision.reason },
      });
      return { decision };
    }
  }
}

async function llmJudge(
  candidate: string,
  existing: Array<Pick<MemoryRecord, 'id' | 'content'>>,
): Promise<ReconcileDecision> {
  const prompt = `You are a memory reconciliation judge for an autonomous AI marketing system.

Your job is to decide what to do with a CANDIDATE FACT given EXISTING MEMORIES on the same topic.

CANDIDATE FACT:
"${candidate}"

EXISTING MEMORIES:
${existing.map((m, i) => `[${i}] (id=${m.id}) ${m.content}`).join('\n')}

Decide ONE of:
- "add"    — the candidate adds new info that doesn't overlap any existing memory
- "update" — the candidate refines, corrects, or replaces a specific existing memory (provide its targetId and a single mergedContent that captures both)
- "delete" — the candidate negates / invalidates an existing memory (provide its targetId)
- "noop"   — the candidate adds nothing new; already represented

Return STRICT JSON:
{
  "action": "add" | "update" | "delete" | "noop",
  "targetId": "uuid (required for update/delete)",
  "mergedContent": "the merged fact (only for update)",
  "reason": "one sentence rationale"
}`;

  try {
    const res = await callGemini({
      taskType:  'social-strategy',
      prompt,
      mimeType:  'application/json',
      minLength: 20,
    });
    const parsed = JSON.parse(res.text) as ReconcileDecision;
    if (!['add', 'update', 'delete', 'noop'].includes(parsed.action)) {
      return { action: 'add', reason: 'invalid LLM action; defaulting to add' };
    }
    return parsed;
  } catch (err) {
    console.warn('[reconcile] LLM judge failed, defaulting to add:', err);
    return { action: 'add', reason: 'LLM judge unavailable; defaulting to add' };
  }
}
