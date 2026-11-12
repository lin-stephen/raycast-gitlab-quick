import { Action, ActionPanel, Icon, Keyboard, List, open } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { useState } from "react";
import { links, prefs, Project, searchUrl } from "./gitlab";

type Target = "repo" | "pipelines";

export function ProjectList({
  initialQuery = "",
  target,
}: {
  initialQuery?: string;
  target: Target;
}) {
  const [searchText, setSearchText] = useState(initialQuery);
  const { instance, token, membershipOnly } = prefs();

  const { isLoading, data, error } = useFetch<Project[]>(
    searchUrl(instance, searchText, membershipOnly),
    {
      headers: { "PRIVATE-TOKEN": token, Accept: "application/json" },
      keepPreviousData: true,
      initialData: [],
    },
  );

  const toPipelines = target === "pipelines";
  const primary = toPipelines ? links.pipelines : links.repo;
  const secondary = toPipelines ? links.repo : links.pipelines;
  const primaryTitle = toPipelines ? "Open Pipelines" : "Open Repository";
  const secondaryTitle = toPipelines ? "Open Repository" : "Open Pipelines";

  const projects = data ?? [];

  const items = projects.map((project) => (
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
        { date: new Date(project.last_activity_at), tooltip: "Last activity" },
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
  ));

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
