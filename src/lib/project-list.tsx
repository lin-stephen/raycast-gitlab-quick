import {
  Action,
  ActionPanel,
  Color,
  Icon,
  Keyboard,
  List,
  open,
} from "@raycast/api";
import { useFetch, usePromise } from "@raycast/utils";
import { useRef, useState } from "react";
import {
  fetchLatestPipelines,
  links,
  Pipeline,
  prefs,
  Project,
  searchUrl,
} from "./gitlab";

type Target = "repo" | "pipelines";

/** GitLab's pipeline statuses, mapped to something glanceable. */
const PIPELINE_UI: Record<string, { icon: Icon; color: Color; label: string }> =
  {
    success: { icon: Icon.CheckCircle, color: Color.Green, label: "passed" },
    failed: { icon: Icon.XMarkCircle, color: Color.Red, label: "failed" },
    running: {
      icon: Icon.CircleProgress50,
      color: Color.Blue,
      label: "running",
    },
    pending: { icon: Icon.Clock, color: Color.Yellow, label: "pending" },
    created: { icon: Icon.Clock, color: Color.Yellow, label: "created" },
    preparing: { icon: Icon.Clock, color: Color.Yellow, label: "preparing" },
    waiting_for_resource: {
      icon: Icon.Clock,
      color: Color.Yellow,
      label: "waiting",
    },
    manual: { icon: Icon.Play, color: Color.Purple, label: "manual" },
    scheduled: { icon: Icon.Calendar, color: Color.Purple, label: "scheduled" },
    canceled: {
      icon: Icon.MinusCircle,
      color: Color.SecondaryText,
      label: "canceled",
    },
    skipped: { icon: Icon.Minus, color: Color.SecondaryText, label: "skipped" },
  };

function pipelineAccessory(pipeline: Pipeline): List.Item.Accessory {
  const ui = PIPELINE_UI[pipeline.status] ?? {
    icon: Icon.QuestionMark,
    color: Color.SecondaryText,
    label: pipeline.status,
  };
  return {
    icon: { source: ui.icon, tintColor: ui.color },
    text: pipeline.ref,
    tooltip: `Pipeline ${ui.label} on ${pipeline.ref}`,
  };
}

export function ProjectList({
  initialQuery = "",
  target,
}: {
  initialQuery?: string;
  target: Target;
}) {
  const [searchText, setSearchText] = useState(initialQuery);
  const { instance, token, membershipOnly } = prefs();
  const abortable = useRef<AbortController>(null);

  const { isLoading, data, error } = useFetch<Project[]>(
    searchUrl(instance, searchText, membershipOnly),
    {
      headers: { "PRIVATE-TOKEN": token, Accept: "application/json" },
      keepPreviousData: true,
      initialData: [],
    },
  );

  const toPipelines = target === "pipelines";
  const projects = data ?? [];

  // Statuses are a second round trip, so they only run where they earn their keep:
  // the pipelines command. The key keeps the request from refiring on every render.
  const projectIds = projects.map((p) => p.id);
  const idKey = projectIds.join(",");

  const { data: pipelines } = usePromise(
    async (key: string) => {
      if (!key) return {} as Record<number, Pipeline | null>;
      return fetchLatestPipelines(
        instance,
        token,
        key.split(",").map(Number),
        abortable.current?.signal,
      );
    },
    [idKey],
    { execute: toPipelines && idKey.length > 0, abortable },
  );

  const primary = toPipelines ? links.pipelines : links.repo;
  const secondary = toPipelines ? links.repo : links.pipelines;
  const primaryTitle = toPipelines ? "Open Pipelines" : "Open Repository";
  const secondaryTitle = toPipelines ? "Open Repository" : "Open Pipelines";

  const items = projects.map((project) => {
    const pipeline = pipelines?.[project.id] ?? null;

    return (
      <List.Item
        key={project.id}
        icon={
          project.avatar_url
            ? { source: project.avatar_url, fallback: Icon.Folder }
            : Icon.Folder
        }
        title={project.name}
        subtitle={project.path_with_namespace}
        accessories={[
          ...(project.archived ? [{ tag: "archived" }] : []),
          ...(pipeline ? [pipelineAccessory(pipeline)] : []),
          {
            date: new Date(pipeline?.updated_at ?? project.last_activity_at),
            tooltip: "Last activity",
          },
        ]}
        actions={
          <ActionPanel>
            <ActionPanel.Section>
              <Action
                title={primaryTitle}
                icon={toPipelines ? Icon.Rocket : Icon.Code}
                onAction={() => open(primary(project))}
              />
              <Action
                title={secondaryTitle}
                icon={toPipelines ? Icon.Code : Icon.Rocket}
                onAction={() => open(secondary(project))}
              />
              {pipeline ? (
                <Action.OpenInBrowser
                  title="Open Latest Pipeline"
                  icon={Icon.Bolt}
                  url={pipeline.web_url}
                  shortcut={{ modifiers: ["cmd"], key: "l" }}
                />
              ) : null}
            </ActionPanel.Section>
            <ActionPanel.Section>
              <Action.OpenInBrowser
                title="Open Merge Requests"
                icon={Icon.Switch}
                url={links.mergeRequests(project)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
              />
              <Action.OpenInBrowser
                title="Open Issues"
                icon={Icon.Bug}
                url={links.issues(project)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "i" }}
              />
              <Action.OpenInBrowser
                title="Open Jobs"
                icon={Icon.Hammer}
                url={links.jobs(project)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "j" }}
              />
              <Action.OpenInBrowser
                title="Open Branches"
                icon={Icon.Tree}
                url={links.branches(project)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "b" }}
              />
            </ActionPanel.Section>
            <ActionPanel.Section>
              <Action.CopyToClipboard
                title="Copy Project URL"
                content={project.web_url}
                shortcut={Keyboard.Shortcut.Common.Copy}
              />
              <Action.CopyToClipboard
                title="Copy SSH Clone URL"
                content={project.ssh_url_to_repo}
                shortcut={{ modifiers: ["cmd", "shift"], key: "." }}
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    );
  });

  return (
    <List
      isLoading={isLoading}
      filtering={false}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={
        toPipelines
          ? "Search projects to open pipelines…"
          : "Search GitLab projects…"
      }
      throttle
    >
      {error ? (
        <List.EmptyView
          icon={Icon.Warning}
          title="Could not reach GitLab"
          description={`${error.message} — check the GitLab URL and token in this command's preferences (⌘, in Raycast).`}
        />
      ) : items.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title={
            isLoading
              ? "Searching…"
              : searchText
                ? "No matching projects"
                : "Type to search your GitLab"
          }
        />
      ) : (
        items
      )}
    </List>
  );
}
