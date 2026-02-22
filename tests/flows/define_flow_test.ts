interface FlowOverrides {
  id?: string;
  name?: string;
  description?: string;
  steps?: Array<
    { id: string; name: string; agent: string; dependsOn?: string[]; input?: { source: string; transform: string } }
  >;
}
