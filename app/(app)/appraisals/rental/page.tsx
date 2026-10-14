import { AppraisalTypePage } from "@/components/appraisals/AppraisalTypePage";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AppraisalTypePage kind="lease" searchParams={searchParams} />;
}
