import type { FinalReportJson } from "@/lib/types";

type Props = {
  report: FinalReportJson;
};

type FooterAgent = FinalReportJson["agent"];

function resolveFooterAgents(report: FinalReportJson): FooterAgent[] {
  if (report.agents?.length) {
    return report.agents.filter(
      (agent) => agent.name || agent.photo_url || agent.phone || agent.email,
    );
  }

  if (
    report.agent.name ||
    report.agent.photo_url ||
    report.agent.phone ||
    report.agent.email
  ) {
    return [report.agent];
  }

  return [];
}

function AgentContactLine({
  label,
  value,
  compact,
}: {
  label?: string;
  value: string;
  compact: boolean;
}) {
  return (
    <p className={`leading-snug text-neutral-700 ${compact ? "break-all text-xs" : "text-sm"}`}>
      {label ? `${label} ${value}` : value}
    </p>
  );
}

function AgentBlock({
  agent,
  compact = false,
}: {
  agent: FooterAgent;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {agent.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agent.photo_url}
          alt=""
          className={
            compact
              ? "h-20 w-[4.5rem] shrink-0 object-cover object-top"
              : "h-24 w-20 shrink-0 object-cover object-top"
          }
        />
      ) : null}

      <div className="min-w-0 flex-1 text-left">
        {agent.name ? (
          <p className={`font-semibold text-neutral-900 ${compact ? "text-sm" : ""}`}>
            {agent.name}
          </p>
        ) : null}
        {agent.role_title ? (
          <p className={`text-neutral-600 ${compact ? "text-xs" : "text-sm"}`}>
            {agent.role_title}
          </p>
        ) : null}
        {agent.phone ? (
          <AgentContactLine label={compact ? undefined : "P:"} value={agent.phone} compact={compact} />
        ) : null}
        {agent.email ? (
          <AgentContactLine label={compact ? undefined : "E:"} value={agent.email} compact={compact} />
        ) : null}
      </div>
    </div>
  );
}

export function ClassicAgentFooter({ report }: Props) {
  const agents = resolveFooterAgents(report);
  const hasQr = Boolean(report.assets.qr_code_url);

  if (agents.length === 0 && !hasQr) {
    return null;
  }

  const multiAgent = agents.length > 1;

  return (
    <footer className="shrink-0 border-t border-neutral-200 px-10 py-4">
      <div className="flex items-center justify-between gap-6">
        {agents.length > 0 ? (
          <div
            className={
              multiAgent
                ? "grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-3"
                : "flex min-w-0 flex-1 items-center"
            }
          >
            {agents.map((agent) => (
              <AgentBlock
                key={agent.name || agent.email || agent.phone}
                agent={agent}
                compact={multiAgent}
              />
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {hasQr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={report.assets.qr_code_url}
            alt="QR code"
            className="h-20 w-20 shrink-0"
          />
        ) : null}
      </div>
    </footer>
  );
}
