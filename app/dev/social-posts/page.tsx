import { notFound } from "next/navigation";
import { SocialPostsPlayground } from "@/components/dev/SocialPostsPlayground";

export const metadata = {
  title: "Social post editor preview",
  robots: { index: false, follow: false },
};

export default function SocialPostsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SocialPostsPlayground />;
}
