"use client";
export default function CalculatorError({ reset }: { reset: () => void }) {
  return <div data-theme="staypack-workspace" className="space-y-4"><h1 className="text-2xl font-semibold">STR calculator</h1><p role="alert">We couldn’t load your calculator and leads. Please try again.</p><button onClick={reset} className="du-btn du-btn-primary">Try again</button></div>;
}
