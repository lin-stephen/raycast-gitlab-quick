import { getPreferenceValues } from "@raycast/api";

const PAGE_SIZE = 30;

export interface Prefs {
  instance: string;
  token: string;
  membershipOnly: boolean;
}

export interface Pipeline {
  /** Uppercase enum from GraphQL, e.g. SUCCESS, FAILED, MANUAL. */
  status: string;
  ref: string;
  updatedAt: string;
  /** Instance-relative, e.g. /b2c/casa.backend/-/pipelines/2239798 */
  path: string;
}

export interface Project {
  name: string;
  fullPath: string;
  webUrl: string;
  archived: boolean;
  lastActivityAt: string;
  sshUrlToRepo: string;
  pipeline: Pipeline | null;
}

export function prefs(): Prefs {
  const p = getPreferenceValues<Prefs>();
  return { ...p, instance: p.instance.trim().replace(/\/+$/, "") };
}

/**
 * One GraphQL request covers search and, when asked, each project's latest
 * pipeline — the REST equivalent was 1 + N round trips.
 *
 * `membership` is inlined rather than passed as a variable so the argument is
 * absent entirely when the preference is off; passing `membership: false`
 * is not the same as not filtering.
 */
function buildQuery(membershipOnly: boolean): string {
  const membership = membershipOnly ? ", membership: true" : "";
  return `
    query ProjectSearch($search: String, $first: Int!, $sort: String, $withPipelines: Boolean!) {
      projects(search: $search, first: $first, sort: $sort${membership}) {
        nodes {
          name
          fullPath
          webUrl
          archived
          lastActivityAt
          sshUrlToRepo
          pipelines(first: 1) @include(if: $withPipelines) {
            nodes { status ref updatedAt path }
          }
        }
      }
    }`;
}

interface GraphQLProjectNode {
  name: string;
  fullPath: string;
  webUrl: string;
  archived: boolean;
  lastActivityAt: string;
  sshUrlToRepo: string;
  pipelines?: { nodes: Pipeline[] } | null;
}

export async function fetchProjects(
  instance: string,
  token: string,
  search: string,
  membershipOnly: boolean,
  withPipelines: boolean,
  signal?: AbortSignal,
): Promise<Project[]> {
  const res = await fetch(`${instance}/api/graphql`, {
    method: "POST",
    headers: {
      "PRIVATE-TOKEN": token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: buildQuery(membershipOnly),
      variables: {
        search: search.trim() || null,
        first: PAGE_SIZE,
        sort: "latest_activity_desc",
        withPipelines,
      },
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`GitLab returned ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as {
    data?: { projects?: { nodes: GraphQLProjectNode[] } };
    errors?: { message: string }[];
  };

  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }

  return (body.data?.projects?.nodes ?? []).map((node) => ({
    name: node.name,
    fullPath: node.fullPath,
    webUrl: node.webUrl,
    archived: node.archived,
    lastActivityAt: node.lastActivityAt,
    sshUrlToRepo: node.sshUrlToRepo,
    pipeline: node.pipelines?.nodes?.[0] ?? null,
  }));
}

export const links = {
  repo: (p: Project) => p.webUrl,
  pipelines: (p: Project) => `${p.webUrl}/-/pipelines`,
  mergeRequests: (p: Project) => `${p.webUrl}/-/merge_requests`,
  issues: (p: Project) => `${p.webUrl}/-/issues`,
  branches: (p: Project) => `${p.webUrl}/-/branches`,
  jobs: (p: Project) => `${p.webUrl}/-/jobs`,
  pipeline: (instance: string, pipeline: Pipeline) =>
    `${instance}${pipeline.path}`,
};
