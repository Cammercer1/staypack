export function AgentCard({
  agent,
  agency,
  cta,
}: {
  agent: {
    name: string;
    role_title: string;
    phone: string;
    email: string;
    photo_url: string;
  };
  agency: {
    phone: string;
    email: string;
  };
  cta?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/40 p-5">
      <div className="flex items-center gap-4">
        {agent.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.photo_url}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : null}
        <div>
          <p className="font-semibold">{agent.name || "Agent"}</p>
          <p className="text-sm text-muted-foreground">{agent.role_title}</p>
          <p className="text-sm">{agent.phone || "—"}</p>
          <p className="text-sm">{agent.email || "—"}</p>
        </div>
      </div>
      {cta ? <p className="max-w-sm text-sm">{cta}</p> : null}
    </div>
  );
}
