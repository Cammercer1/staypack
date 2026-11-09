import { createElement, lazy, Suspense, type ComponentType } from "react";

/** This entry runs only in the browser; preserve the existing report's lazy section/charts. */
export default function dynamic<P extends object>(
  loader: () => Promise<ComponentType<P> | { default: ComponentType<P> }>,
  options: { loading?: ComponentType; ssr?: boolean } = {},
): ComponentType<P> {
  const Loaded = lazy(async () => {
    const result = await loader();
    return { default: typeof result === "function" ? result : (result as { default: ComponentType<P> }).default };
  });
  return function ReportSection(props: P) {
    const Loading = options.loading;
    return <Suspense fallback={Loading ? <Loading /> : null}>{createElement(Loaded as ComponentType<P>, props)}</Suspense>;
  };
}
