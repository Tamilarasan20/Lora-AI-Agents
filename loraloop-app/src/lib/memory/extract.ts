import { callGemini } from '../gemini';
import { reconcileFact } from './reconcile';
import type { ExtractFactsInput } from './types';

/**
 * Extract atomic, durable facts from agent output / conversation / analysis.
 *
 * A "fact" is one self-contained statement that would still be true and
 * useful to the system six months from now. Ephemeral details are skipped.
 *
 * Each extracted fact is run through the reconciliation pipeline to decide
 * whether to ADD / UPDATE / DELETE / NOOP relative to existing memory.
 */
export async function extractAndStoreFacts(opts: ExtractFactsInput): Promise<{
  factsExtracted: number;
  factsAdded: number;
  factsUpdated: number;
  factsDeleted: number;
  factsNoop: number;
}> {
  const prompt = `Extract atomic, durable facts from the text below.

A "fact" must be:
- Self-contained (no "see above" / "as mentioned")
- Durable (would still be useful and accurate in 6 months)
- Specific (concrete numbers, names, claims — not vague observations)
- Layer-appropriate: this fact is being stored in the "${opts.layer}" memory layer

Skip ephemeral details, generic claims, and pure summaries of what just happened.

TEXT:
${opts.raw.slice(0, 12000)}

Return STRICT JSON: { "facts": ["fact 1", "fact 2", "..."] }

If nothing in the text qualifies, return: { "facts": [] }`;

  let facts: string[] = [];
  try {
    const res = await callGemini({
      taskType:  'social-strategy',
      prompt,
      mimeType:  'application/json',
      minLength: 15,
    });
    const parsed = JSON.parse(res.text) as { facts?: unknown };
    if (Array.isArray(parsed.facts)) {
      facts = (parsed.facts as unknown[]).filter((f): f is string => typeof f === 'string' && f.trim().length > 0);
    }
  } catch (err) {
    console.warn('[extract] Fact extraction failed:', err);
    return { factsExtracted: 0, factsAdded: 0, factsUpdated: 0, factsDeleted: 0, factsNoop: 0 };
  }

  const decisions = await Promise.all(
    facts.map((fact) =>
      reconcileFact({
        workspaceId:    opts.workspaceId,
        agentScope:     opts.agentScope,
        layer:          opts.layer,
        candidateFact:  fact,
        metadata:       opts.metadata ?? {},
        sourceType:     opts.sourceType,
        sourceId:       opts.sourceId,
      }).catch((err) => {
        console.warn(`[extract] Reconcile failed for fact "${fact.slice(0, 60)}...":`, err);
        return null;
      }),
    ),
  );

  const tally = { add: 0, update: 0, delete: 0, noop: 0 };
  for (const d of decisions) {
    if (d) tally[d.decision.action] += 1;
  }

  return {
    factsExtracted: facts.length,
    factsAdded:     tally.add,
    factsUpdated:   tally.update,
    factsDeleted:   tally.delete,
    factsNoop:      tally.noop,
  };
}
