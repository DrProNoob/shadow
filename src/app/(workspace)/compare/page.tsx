import { CompareWorkspace } from "@/components/compare/compare-workspace";

type ComparePageProps = {
  searchParams: Promise<{
    left?: string | string[];
    right?: string | string[];
  }>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const query = await searchParams;
  return (
    <CompareWorkspace
      requestedLeftId={first(query.left)}
      requestedRightId={first(query.right)}
    />
  );
}
