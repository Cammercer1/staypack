import type { FinalReportJson } from "@/lib/types";
import { resolveBrochureAgents } from "@/lib/collateral/templates/sales-brochure/shared/resolveBrochureAgents";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function BrochureAgentContact({
  agent,
  uppercaseName = false,
}: {
  agent: FinalReportJson["agent"];
  uppercaseName?: boolean;
}) {
  return (
    <div className="text-[0.74rem] leading-snug text-neutral-700">
      {agent.name ? (
        <p
          className={
            uppercaseName
              ? "text-[0.82rem] font-bold uppercase tracking-wide text-neutral-900"
              : "text-[0.88rem] font-semibold text-neutral-900"
          }
          style={{ fontFamily: uppercaseName ? headingFont : bodyFont }}
        >
          {agent.name}
        </p>
      ) : null}
      {agent.role_title ? <p className="mt-0.5">{agent.role_title}</p> : null}
      {agent.phone ? <p className="mt-1">{agent.phone}</p> : null}
      {agent.email ? (
        <p className="mt-0.5 break-all text-neutral-600">{agent.email}</p>
      ) : null}
    </div>
  );
}

export function BrochureAgentContactStack({
  report,
  align = "right",
  uppercaseName = false,
  className = "",
}: {
  report: FinalReportJson;
  align?: "left" | "right";
  uppercaseName?: boolean;
  className?: string;
}) {
  const agents = resolveBrochureAgents(report);

  if (!agents.length) {
    return null;
  }

  return (
    <div
      className={`space-y-4 ${align === "right" ? "text-right" : "text-left"} ${className}`}
      style={{ fontFamily: bodyFont }}
    >
      {agents.map((agent, index) => (
        <BrochureAgentContact
          key={`${agent.name}-${agent.email}-${agent.phone}-${index}`}
          agent={agent}
          uppercaseName={uppercaseName}
        />
      ))}
    </div>
  );
}
