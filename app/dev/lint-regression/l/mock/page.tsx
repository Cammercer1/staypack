import { notFound } from "next/navigation";

export default async function MockLandingFrame({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  if (process.env.NODE_ENV !== "development" && process.env.STAYPACK_REGRESSION_PREVIEW !== "1") notFound();
  const { template } = await searchParams;
  return <main className="p-8"><h1>Mock property page</h1><p>42 Oceanview Parade</p><p>Template: {template}</p></main>;
}
