import { getPreferenceValues } from "@raycast/api";

/** Latest-pipeline lookups are capped so a wide search can't fan out into dozens of requests. */
export const PIPELINE_LOOKUP_LIMIT = 20;
const PIPELINE_CONCURRENCY = 6;

export interface Prefs {
  instance: string;
  token: string;
  membershipOnly: boolean;
}

export interface Project {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  web_url: string;
  description: string | null;
  avatar_url: string | null;
  archived: boolean;
  last_activity_at: string;
  ssh_url_to_repo: string;
  http_url_to_repo: string;
}

export interface Pipeline {
  id: number;
  status: string;
  ref: string;
  web_url: string;
  updated_at: string;
  source: string;
}

export function prefs(): Prefs {
  const p = getPreferenceValues<Prefs>();
  return { ...p, instance: p.instance.trim().replace(/\/+$/, "") };
}

/** Project search endpoint. Empty query -> most recently active projects. */
export function searchUrl(
  instance: string,
  query: string,
  membershipOnly: boolean,
): string {
  const params = new URLSearchParams({
    per_page: "30",
    order_by: "last_activity_at",
    sort: "desc",
    simple: "true",
  });
  const q = query.trim();
  if (q) {
    params.set("search", q);
    params.set("search_namespaces", "true");
  }
  if (membershipOnly) params.set("membership", "true");
  return `${instance}/api/v4/projects?${params.toString()}`;
}

/** Runs `fn` over `items` with a bounded number of requests in flight. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (let i = next++; i < items.length; i = next++) {
        results[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/**
 * Most recent pipeline per project, keyed by project id.
 *
 * A project with pipelines disabled, or one the token cannot read pipelines for,
 * resolves to null rather than failing the whole batch — a single 403 should not
 * blank out every other project's status.
 */
export async function fetchLatestPipelines(
  instance: string,
  token: string,
  projectIds: number[],
  signal?: AbortSignal,
): Promise<Record<number, Pipeline | null>> {
  const ids = projectIds.slice(0, PIPELINE_LOOKUP_LIMIT);

  const entries = await mapLimit(ids, PIPELINE_CONCURRENCY, async (id) => {
    try {
      const res = await fetch(
        `${instance}/api/v4/projects/${id}/pipelines?per_page=1`,
        {
          headers: { "PRIVATE-TOKEN": token, Accept: "application/json" },
          signal,
        },
      );
      if (!res.ok) return [id, null] as const;
      const pipelines = (await res.json()) as Pipeline[];
      return [id, pipelines[0] ?? null] as const;
    } catch {
      return [id, null] as const;
    }
  });

  return Object.fromEntries(entries);
}

export const links = {
  repo: (p: Project) => p.web_url,
  pipelines: (p: Project) => `${p.web_url}/-/pipelines`,
  mergeRequests: (p: Project) => `${p.web_url}/-/merge_requests`,
  issues: (p: Project) => `${p.web_url}/-/issues`,
  branches: (p: Project) => `${p.web_url}/-/branches`,
  jobs: (p: Project) => `${p.web_url}/-/jobs`,
};
