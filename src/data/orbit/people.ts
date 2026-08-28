import type { Person, PersonId, Team, TeamId } from "@/domain/model";

export const ORBIT_TEAM_ORDER = [
  "team-engineering",
  "team-design",
  "team-product",
  "team-sales",
  "team-marketing",
  "team-operations",
  "team-finance",
  "team-people",
] as const satisfies readonly TeamId[];

type TeamBlueprint = {
  id: (typeof ORBIT_TEAM_ORDER)[number];
  name: string;
  department: string;
  description: string;
  headcount: number;
  protected: boolean;
  roles: readonly string[];
};

const TEAM_BLUEPRINTS: readonly TeamBlueprint[] = [
  {
    id: "team-engineering",
    name: "Engineering",
    department: "Product & Technology",
    description: "Builds and operates ORBIT's customer-facing platform.",
    headcount: 96,
    protected: true,
    roles: ["Software Engineer", "Platform Engineer", "Engineering Manager"],
  },
  {
    id: "team-design",
    name: "Design",
    department: "Product & Technology",
    description: "Owns product design, research, and ORBIT's visual system.",
    headcount: 28,
    protected: false,
    roles: ["Product Designer", "Design Researcher", "Design Manager"],
  },
  {
    id: "team-product",
    name: "Product",
    department: "Product & Technology",
    description: "Sets product strategy and coordinates delivery.",
    headcount: 24,
    protected: false,
    roles: ["Product Manager", "Product Operations Manager", "Product Lead"],
  },
  {
    id: "team-sales",
    name: "Sales",
    department: "Go to Market",
    description: "Runs enterprise sales and account development.",
    headcount: 56,
    protected: false,
    roles: [
      "Account Executive",
      "Sales Development Representative",
      "Sales Manager",
    ],
  },
  {
    id: "team-marketing",
    name: "Marketing",
    department: "Go to Market",
    description: "Owns brand, demand generation, campaigns, and content.",
    headcount: 32,
    protected: false,
    roles: ["Campaign Manager", "Content Strategist", "Brand Designer"],
  },
  {
    id: "team-operations",
    name: "Operations",
    department: "Business Operations",
    description:
      "Coordinates internal systems, vendors, and business processes.",
    headcount: 36,
    protected: false,
    roles: [
      "Operations Manager",
      "Business Systems Analyst",
      "Program Manager",
    ],
  },
  {
    id: "team-finance",
    name: "Finance",
    department: "Business Operations",
    description: "Runs planning, accounting, procurement, and reporting.",
    headcount: 18,
    protected: false,
    roles: ["Financial Analyst", "Accountant", "Finance Manager"],
  },
  {
    id: "team-people",
    name: "People",
    department: "Business Operations",
    description:
      "Supports recruiting, talent operations, and the employee experience.",
    headcount: 22,
    protected: false,
    roles: ["People Partner", "Recruiter", "People Operations Manager"],
  },
] as const;

export const ORBIT_TEAMS: Record<TeamId, Team> = Object.fromEntries(
  TEAM_BLUEPRINTS.map((team) => [
    team.id,
    {
      id: team.id,
      name: team.name,
      department: team.department,
      description: team.description,
      protected: team.protected,
    },
  ]),
);

const FIRST_NAMES = [
  "Avery",
  "Jordan",
  "Riley",
  "Morgan",
  "Casey",
  "Taylor",
  "Cameron",
  "Sam",
  "Alex",
  "Jamie",
  "Robin",
  "Drew",
  "Quinn",
  "Remy",
  "Skyler",
  "Reese",
] as const;

const LAST_NAMES = [
  "Anders",
  "Bennett",
  "Clarke",
  "Dubois",
  "Evans",
  "Ferrer",
  "Gupta",
  "Ito",
  "Jensen",
  "Kovac",
  "Liu",
  "Mensah",
  "Novak",
  "Okafor",
  "Park",
  "Silva",
  "Tran",
  "Weber",
  "Young",
  "Zimmer",
] as const;

const FIGMA_MARKETING_IDENTITIES = [
  ["Maya Chen", "Brand Designer"],
  ["Theo Brooks", "Campaign Manager"],
  ["Nia Patel", "Content Strategist"],
  ["Lucas Meyer", "Campaign Manager"],
  ["Sofia Alvarez", "Brand Designer"],
  ["Noah Kim", "Content Strategist"],
  ["Emma Fischer", "Campaign Manager"],
  ["Amir Hassan", "Brand Designer"],
  ["Chloe Martin", "Content Strategist"],
  ["Leo Rossi", "Campaign Manager"],
  ["Zoe Walker", "Brand Designer"],
] as const;

function personId(teamId: string, index: number): PersonId {
  return `person-${teamId.replace("team-", "")}-${String(index + 1).padStart(3, "0")}`;
}

function buildPeople(): Record<PersonId, Person> {
  const people: Record<PersonId, Person> = {};
  let globalIndex = 0;

  for (const team of TEAM_BLUEPRINTS) {
    for (let index = 0; index < team.headcount; index += 1) {
      const id = personId(team.id, index);
      const explicitMarketingIdentity =
        team.id === "team-marketing"
          ? FIGMA_MARKETING_IDENTITIES[index]
          : undefined;
      const generatedName = `${FIRST_NAMES[globalIndex % FIRST_NAMES.length]} ${
        LAST_NAMES[
          Math.floor(globalIndex / FIRST_NAMES.length) % LAST_NAMES.length
        ]
      }`;

      people[id] = {
        id,
        displayName: explicitMarketingIdentity?.[0] ?? generatedName,
        role:
          explicitMarketingIdentity?.[1] ??
          team.roles[index % team.roles.length],
        teamId: team.id,
        employmentStatus: "active",
      };
      globalIndex += 1;
    }
  }

  return people;
}

export const ORBIT_PEOPLE = buildPeople();

export const FIGMA_AFFECTED_MARKETING_PERSON_IDS = Array.from(
  { length: FIGMA_MARKETING_IDENTITIES.length },
  (_, index) => personId("team-marketing", index),
);

export function getPersonIdsForTeam(teamId: TeamId): PersonId[] {
  return Object.values(ORBIT_PEOPLE)
    .filter((person) => person.teamId === teamId)
    .map((person) => person.id);
}

export const ORBIT_TEAM_HEADCOUNTS = Object.fromEntries(
  TEAM_BLUEPRINTS.map((team) => [team.id, team.headcount]),
) as Record<TeamId, number>;
