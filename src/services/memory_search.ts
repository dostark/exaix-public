import type { ExecutionMemory, Learning, MemorySearchResult, ProjectMemory } from "../schemas/memory_bank.ts";
import { MemoryStatus, MemoryType } from "../enums.ts";

export interface SearchDeps {
  projectsDir: string;
  getProjectMemory: (portal: string) => Promise<ProjectMemory | null>;
  getExecutionHistory: (portal?: string, limit?: number) => Promise<ExecutionMemory[]>;
  loadLearningsFromFile: () => Promise<Learning[]>;
  calculateFrequency: (text: string | undefined, keywordLower: string) => number;
  calculateRelevance: (titleFreq: number, descFreq: number) => number;
}

export async function searchMemory(
  query: string,
  options: { portal?: string; limit?: number } | undefined,
  deps: SearchDeps,
): Promise<MemorySearchResult[]> {
  const results: MemorySearchResult[] = [];
  const queryLower = query.toLowerCase();
  const limit = options?.limit || 50;

  // Search project memory
  for await (const entry of Deno.readDir(deps.projectsDir)) {
    if (entry.isDirectory) {
      if (options?.portal && entry.name !== options.portal) continue;

      const projectMem = await deps.getProjectMemory(entry.name);
      if (projectMem) {
        if (projectMem.overview.toLowerCase().includes(queryLower)) {
          results.push({
            type: MemoryType.PROJECT,
            portal: entry.name,
            title: `${entry.name} Overview`,
            summary: projectMem.overview.substring(0, 200),
            relevance_score: 0.9,
          });
        }

        for (const pattern of projectMem.patterns) {
          if (
            pattern.name.toLowerCase().includes(queryLower) ||
            pattern.description.toLowerCase().includes(queryLower)
          ) {
            results.push({
              type: MemoryType.PATTERN,
              portal: entry.name,
              title: pattern.name,
              summary: pattern.description,
              relevance_score: 0.8,
            });
          }
        }

        for (const decision of projectMem.decisions) {
          if (decision.decision.toLowerCase().includes(queryLower)) {
            results.push({
              type: MemoryType.DECISION,
              portal: entry.name,
              title: `Decision: ${decision.date}`,
              summary: decision.decision.substring(0, 200),
              relevance_score: 0.7,
            });
          }
        }
      }
    }
  }

  // Search execution memory
  const executions = await deps.getExecutionHistory(options?.portal, limit);
  for (const execution of executions) {
    if (execution.summary.toLowerCase().includes(queryLower)) {
      results.push({
        type: MemoryType.EXECUTION,
        portal: execution.portal,
        title: `Execution: ${execution.trace_id.slice(0, 8)}`,
        summary: execution.summary,
        relevance_score: 0.6,
        trace_id: execution.trace_id,
      });
    }
  }

  results.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  return results.slice(0, limit);
}

export async function searchByTags(
  tags: string[],
  options: { portal?: string; limit?: number } | undefined,
  deps: SearchDeps,
): Promise<MemorySearchResult[]> {
  const results: MemorySearchResult[] = [];
  const limit = options?.limit || 50;
  const normalizedTags = tags.map((t) => t.toLowerCase());

  for await (const entry of Deno.readDir(deps.projectsDir)) {
    if (entry.isDirectory) {
      if (options?.portal && entry.name !== options.portal) continue;

      const projectMem = await deps.getProjectMemory(entry.name);
      if (projectMem) {
        for (const pattern of projectMem.patterns) {
          const patternTags = (pattern.tags || []).map((t) => t.toLowerCase());
          if (normalizedTags.every((t) => patternTags.includes(t))) {
            results.push({
              type: MemoryType.PATTERN,
              portal: entry.name,
              title: pattern.name,
              summary: pattern.description,
              relevance_score: 0.9,
              tags: pattern.tags,
            });
          }
        }

        for (const decision of projectMem.decisions) {
          const decisionTags = (decision.tags || []).map((t) => t.toLowerCase());
          if (normalizedTags.every((t) => decisionTags.includes(t))) {
            results.push({
              type: MemoryType.DECISION,
              portal: entry.name,
              title: `Decision: ${decision.date}`,
              summary: decision.decision,
              relevance_score: 0.85,
              tags: decision.tags,
            });
          }
        }
      }
    }
  }

  // Global learnings
  const learnings = await deps.loadLearningsFromFile();
  for (const learning of learnings) {
    if (learning.status !== MemoryStatus.APPROVED) continue;
    const learningTags = (learning.tags || []).map((t) => t.toLowerCase());
    if (normalizedTags.every((t) => learningTags.includes(t))) {
      results.push({
        type: MemoryType.LEARNING,
        title: learning.title,
        summary: learning.description,
        relevance_score: 0.95,
        tags: learning.tags,
        id: learning.id,
      });
    }
  }

  results.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  return results.slice(0, limit);
}

export async function searchByKeyword(
  keyword: string,
  options: { portal?: string; limit?: number } | undefined,
  deps: SearchDeps,
): Promise<MemorySearchResult[]> {
  const results: MemorySearchResult[] = [];
  const limit = options?.limit || 50;
  const keywordLower = keyword.toLowerCase();

  for await (const entry of Deno.readDir(deps.projectsDir)) {
    if (entry.isDirectory) {
      if (options?.portal && entry.name !== options.portal) continue;

      const projectMem = await deps.getProjectMemory(entry.name);
      if (projectMem) {
        for (const pattern of projectMem.patterns) {
          const titleFreq = deps.calculateFrequency(pattern.name, keywordLower);
          const descFreq = deps.calculateFrequency(pattern.description, keywordLower);
          if (titleFreq > 0 || descFreq > 0) {
            results.push({
              type: MemoryType.PATTERN,
              portal: entry.name,
              title: pattern.name,
              summary: pattern.description,
              relevance_score: deps.calculateRelevance(titleFreq, descFreq),
              tags: pattern.tags,
            });
          }
        }

        for (const decision of projectMem.decisions) {
          const titleFreq = deps.calculateFrequency(decision.decision, keywordLower);
          const descFreq = deps.calculateFrequency(decision.rationale, keywordLower);
          if (titleFreq > 0 || descFreq > 0) {
            results.push({
              type: MemoryType.DECISION,
              portal: entry.name,
              title: `Decision: ${decision.date}`,
              summary: decision.decision,
              relevance_score: deps.calculateRelevance(titleFreq, descFreq),
              tags: decision.tags,
            });
          }
        }

        const overviewFreq = deps.calculateFrequency(projectMem.overview, keywordLower);
        if (overviewFreq > 0) {
          results.push({
            type: MemoryType.PROJECT,
            portal: entry.name,
            title: `${entry.name} Overview`,
            summary: projectMem.overview.substring(0, 200),
            relevance_score: deps.calculateRelevance(0, overviewFreq),
          });
        }
      }
    }
  }

  const learnings = await deps.loadLearningsFromFile();
  for (const learning of learnings) {
    if (learning.status !== MemoryStatus.APPROVED) continue;
    const titleFreq = deps.calculateFrequency(learning.title, keywordLower);
    const descFreq = deps.calculateFrequency(learning.description, keywordLower);
    if (titleFreq > 0 || descFreq > 0) {
      results.push({
        type: MemoryType.LEARNING,
        title: learning.title,
        summary: learning.description,
        relevance_score: deps.calculateRelevance(titleFreq, descFreq),
        tags: learning.tags,
        id: learning.id,
      });
    }
  }

  results.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  return results.slice(0, limit);
}

export async function searchMemoryAdvanced(
  options: {
    tags?: string[];
    keyword?: string;
    portal?: string;
    limit?: number;
  },
  deps: SearchDeps,
): Promise<MemorySearchResult[]> {
  const limit = options.limit || 50;
  const results: MemorySearchResult[] = [];
  const seenIds = new Set<string>();

  const getResultKey = (r: MemorySearchResult) => `${r.type}:${r.portal || ""}:${r.title}`;

  if (options.tags && options.tags.length > 0) {
    const tagResults = await searchByTags(options.tags, { portal: options.portal, limit }, deps);
    for (const result of tagResults) {
      const key = getResultKey(result);
      if (seenIds.has(key)) {
        const existing = results.find((r) => getResultKey(r) === key);
        if (existing) existing.relevance_score = (existing.relevance_score || 0) + 0.2;
      } else {
        seenIds.add(key);
        results.push(result);
      }
    }
  }

  if (options.keyword) {
    const keywordResults = await searchByKeyword(options.keyword, { portal: options.portal, limit }, deps);
    for (const result of keywordResults) {
      const key = getResultKey(result);
      if (seenIds.has(key)) {
        const existing = results.find((r) => getResultKey(r) === key);
        if (existing) {
          existing.relevance_score = Math.max(existing.relevance_score || 0, (result.relevance_score || 0) + 0.05);
        }
      } else {
        seenIds.add(key);
        results.push(result);
      }
    }
  }

  results.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  return results.slice(0, limit);
}
