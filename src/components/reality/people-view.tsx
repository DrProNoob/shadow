import { ShieldCheck, Users } from "lucide-react";
import type { PeopleOverview } from "@/application/queries";
import {
  MetricCard,
  RealityPageFrame,
  SectionHeading,
} from "@/components/reality/reality-page-frame";

export function PeopleView({ overview }: { overview: PeopleOverview }) {
  const protectedHeadcount = overview.teams.reduce(
    (total, team) => total + (team.protected ? team.headcount : 0),
    0,
  );

  return (
    <RealityPageFrame
      eyebrow="Reality · People context"
      title="People and teams"
      description="Usage is evaluated by role and team so an optimization can distinguish inactive capacity from operationally important access."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Employees"
          value={String(overview.employeeCount)}
          detail="Fixed ORBIT workforce"
        />
        <MetricCard
          label="Teams"
          value={String(overview.activeTeamCount)}
          detail="Curated operating cohorts"
        />
        <MetricCard
          label="Protected users"
          value={String(protectedHeadcount)}
          detail="Active Engineering users"
        />
      </div>

      <section className="mt-8" aria-labelledby="team-directory">
        <SectionHeading
          id="team-directory"
          title="Team directory"
          description="The demo uses deterministic cohorts and explicit decision-relevant identities, never random usage facts."
        />

        <ul className="mt-4 grid gap-3 md:grid-cols-2" aria-label="ORBIT teams">
          {overview.teams.map((team) => (
            <li
              key={team.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
                    <Users
                      aria-hidden="true"
                      className="h-4 w-4 text-[var(--text-muted)]"
                    />
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      {team.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                      {team.headcount} people
                    </p>
                  </div>
                </div>
                {team.protected && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--accent)] px-2.5 py-1 text-[10px] font-medium text-[var(--accent)]">
                    <ShieldCheck aria-hidden="true" className="h-3 w-3" />
                    Protected
                  </span>
                )}
              </div>

              <dl className="mt-5 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    Active licenses
                  </dt>
                  <dd className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {team.activeLicenseCount} across {team.subscriptionCount}{" "}
                    subscriptions
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    Department
                  </dt>
                  <dd className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {team.department}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      {overview.highlightedPeople.length > 0 && (
        <section className="mt-8" aria-labelledby="decision-relevant-people">
          <SectionHeading
            id="decision-relevant-people"
            title="Decision-relevant people"
            description="Explicit identities are used only where a future creates a meaningful tradeoff."
          />
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {overview.highlightedPeople.map((person) => (
              <li
                key={person.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {person.displayName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-faint)]">
                      {person.role} · {person.teamName}
                    </p>
                  </div>
                  <span className="text-right font-mono text-[10px] text-[var(--text-muted)]">
                    {person.productNames.join(" · ")}
                  </span>
                </div>
                <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs leading-5 text-[var(--text-muted)]">
                  {person.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <aside className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 sm:p-5">
        <p className="text-xs font-medium text-white">Default safety policy</p>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-[var(--text-muted)]">
          Active Engineering access is protected. A future may expose a failed
          check for inspection, but the human commit flow cannot override it.
        </p>
      </aside>
    </RealityPageFrame>
  );
}
