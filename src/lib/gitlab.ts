import { getPreferenceValues } from "@raycast/api";

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

export function prefs(): Prefs {
  const p = getPreferenceValues<Prefs>();
  return { ...p, instance: p.instance.trim().replace(/\/+$/, "") };
}

/** Project search endpoint. Empty query -> most recently active projects. */
export function searchUrl(instance: string, query: string, membershipOnly: boolean): string {
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

export const links = {
  repo: (p: Project) => p.web_url,
  pipelines: (p: Project) => `${p.web_url}/-/pipelines`,
  mergeRequests: (p: Project) => `${p.web_url}/-/merge_requests`,
  issues: (p: Project) => `${p.web_url}/-/issues`,
  branches: (p: Project) => `${p.web_url}/-/branches`,
  jobs: (p: Project) => `${p.web_url}/-/jobs`,
};
