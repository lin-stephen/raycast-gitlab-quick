import {
  Action,
  ActionPanel,
  Color,
  Icon,
  Keyboard,
  List,
  open,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useRef, useState } from "react";
import { fetchProjects, links, Pipeline, prefs, Project } from "./gitlab";

type Target = "repo" | "pipelines";

/** GitLab's PipelineStatusEnum, mapped to something glanceable. Keys are lowercased. */
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
    canceling: {
      icon: Icon.MinusCircle,
      color: Color.SecondaryText,
      label: "canceling",
    },
    canceled: {
      icon: Icon.MinusCircle,
      color: Color.SecondaryText,
      label: "canceled",
    },
    skipped: { icon: Icon.Minus, color: Color.SecondaryText, label: "skipped" },
  };

function pipelineAccessory(pipeline: Pipeline): List.Item.Accessory {
  const status = pipeline.status.toLowerCase();
  const ui = PIPELINE_UI[status] ?? {
    icon: Icon.QuestionMark,
    color: Color.SecondaryText,
    label: status,
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
  const toPipelines = target === "pipelines";

  const { isLoading, data, error } = usePromise(
    async (search: string, withPipelines: boolean) =>
      fetchProjects(
        instance,
        token,
        search,
        membershipOnly,
        withPipelines,
        abortable.current?.signal,
      ),
    [searchText, toPipelines],
    { abortable, keepPreviousData: true },
  );

  const primary = toPipelines ? links.pipelines : links.repo;
  const secondary = toPipelines ? links.repo : links.pipelines;
  const primaryTitle = toPipelines ? "Open Pipelines" : "Open Repository";
  const secondaryTitle = toPipelines ? "Open Repository" : "Open Pipelines";

  const items = (data ?? []).map((project: Project) => {
    const pipeline = project.pipeline;

    return (
      <List.Item
        key={project.fullPath}
        icon={Icon.Folder}
        title={project.name}
        subtitle={project.fullPath}
        accessories={[
          ...(project.archived ? [{ tag: "archived" }] : []),
          ...(pipeline ? [pipelineAccessory(pipeline)] : []),
          {
            date: new Date(pipeline?.updatedAt ?? project.lastActivityAt),
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
                  url={links.pipeline(instance, pipeline)}
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
                content={project.webUrl}
                shortcut={Keyboard.Shortcut.Common.Copy}
              />
              <Action.CopyToClipboard
                title="Copy SSH Clone URL"
                content={project.sshUrlToRepo}
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
