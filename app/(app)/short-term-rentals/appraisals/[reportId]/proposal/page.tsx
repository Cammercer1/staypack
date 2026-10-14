import { redirect } from "next/navigation";
export default async function ProposalEditorPage({ params }: { params: Promise<{ reportId: string }> }) {
  redirect(`/short-term-rentals/appraisals/${(await params).reportId}`);
}
