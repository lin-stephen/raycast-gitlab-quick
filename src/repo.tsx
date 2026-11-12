import { LaunchProps } from "@raycast/api";
import { ProjectList } from "./lib/project-list";

export default function Command(props: LaunchProps<{ arguments: { query?: string } }>) {
  return <ProjectList initialQuery={props.arguments?.query ?? ""} target="repo" />;
}
