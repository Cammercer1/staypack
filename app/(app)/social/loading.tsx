export default function SocialLoading() {
  return <div data-theme="staypack-workspace" role="status" className="space-y-6"><p>Loading social media…</p><div aria-hidden="true" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(id => <div key={id} className="du-skeleton aspect-square rounded-xl" />)}</div></div>;
}
