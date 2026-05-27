import type { FinalReportJson } from "@/lib/types";

type Props = {
  report: FinalReportJson;
};

function resolveFooterAgents(report: FinalReportJson) {
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

export function ClassicAgentFooter({ report }: Props) {
  const accent = report.agency.primary_colour;
  const { agency } = report;
  const agents = resolveFooterAgents(report);
  const hasQr = Boolean(report.assets.qr_code_url);

  if (agents.length === 0 && !hasQr) {
    return null;
  }

  const [primaryAgent, ...secondaryAgents] = agents;
  const primaryPhone = primaryAgent?.phone || agency.phone;
  const primaryEmail = primaryAgent?.email || agency.email;

  return (
    <footer className="mt-auto border-t border-neutral-200 px-10 py-6">
      <div className="flex items-end justify-end gap-6">
        {agents.length > 0 ? (
          <div className="flex flex-col items-end gap-4">
            <div className="flex items-end gap-3">
              {agents.map((agent) =>
                agent.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={agent.name}
                    src={agent.photo_url}
                    alt=""
                    className="h-28 w-24 object-cover object-top"
                  />
                ) : null,
              )}
            </div>

            <div className="text-right">
              {primaryAgent?.name ? (
                <p className="font-semibold text-neutral-900">{primaryAgent.name}</p>
              ) : null}
              {primaryAgent?.role_title ? (
                <p className="text-sm text-neutral-600">{primaryAgent.role_title}</p>
              ) : null}
              {primaryPhone ? (
                <p className="text-sm" style={{ color: accent }}>
                  P: {primaryPhone}
                </p>
              ) : null}
              {primaryEmail ? (
                <p className="text-sm" style={{ color: accent }}>
                  E: {primaryEmail}
                </p>
              ) : null}
              {secondaryAgents.map((agent) =>
                agent.name ? (
                  <p key={agent.name} className="mt-2 font-semibold text-neutral-900">
                    {agent.name}
                  </p>
                ) : null,
              )}
            </div>
          </div>
        ) : null}

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
