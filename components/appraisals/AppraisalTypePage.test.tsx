// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppraisalTypePage } from "./AppraisalTypePage";
import { AppraisalDashboard } from "./AppraisalDashboard";
import { StrDashboard } from "@/components/str-appraisals/StrDashboard";

const mocks = vi.hoisted(() => ({ list: vi.fn(), supabase: {} }));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgency: async () => ({ agency: { id: "agency" }, supabase: mocks.supabase }) }));
vi.mock("@/lib/appraisals/workspace", () => ({ listWorkspaceAppraisals: mocks.list }));
const counts = { draft: 30, ready: 30, published: 0, failed: 0, archived: 0 };
const row = { report_id: "report", recipient_name: "Jordan", updated_at: "2026-10-14T00:00:00Z", report: { id: "report", status: "draft", updated_at: "2026-10-14T00:00:00Z", listing: { property_address: "12 Coast Street", hero_image_url: null, status: "active" } } };
afterEach(cleanup);
beforeEach(() => mocks.list.mockReset());

it.each([['lease', 'rental', 'Rental'], ['sales', 'sales', 'Sales']] as const)("keeps %s search, status and pagination inside its own workspace", async (kind, path, label) => {
  mocks.list.mockResolvedValue({ rows: [{ ...row, kind }], total: 60, counts });
  const { container } = render(await AppraisalTypePage({ kind, searchParams: Promise.resolve({ kind: kind === 'lease' ? 'sales' : 'lease', q: 'Coast', status: 'ready', page: '2' }) }));
  expect(mocks.list).toHaveBeenCalledWith(mocks.supabase, 'agency', { kind, q: 'Coast', status: 'ready', page: 2 });
  expect(screen.getByRole('heading', { name: `${label} appraisals` })).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Appraisal types' })).toBeNull();
  expect(screen.queryByText('Calculator widget')).toBeNull();
  expect(container.querySelector('form')?.getAttribute('action')).toBe(`/appraisals/${path}`);
  for (const [name, page] of [['Previous', '1'], ['Next', '3']]) {
    const url = new URL(screen.getByRole('link', { name }).getAttribute('href')!, 'http://localhost');
    expect(url.pathname).toBe(`/appraisals/${path}`);
    expect(url.searchParams.get('q')).toBe('Coast');
    expect(url.searchParams.get('status')).toBe('ready');
    expect(url.searchParams.get('page') ?? '1').toBe(page);
  }
  expect(screen.getByRole('link', { name: 'Clear filters' }).getAttribute('href')).toBe(`/appraisals/${path}`);
  expect(screen.getByRole('link', { name: 'Create appraisal' }).getAttribute('href')).toBe(`/appraisals/new?kind=${kind}`);
  expect(screen.getByRole('link', { name: /12 Coast Street/ }).getAttribute('href')).toBe('/appraisals/report');
});

it('retains type filters in All appraisals and the existing STR dashboard', () => {
  const view = render(<AppraisalDashboard rows={[]} total={0} counts={counts} filters={{ q: '', status: 'all', page: 1 }} />);
  expect(screen.getByRole('navigation', { name: 'Appraisal types' })).toBeTruthy();
  view.unmount();
  render(<StrDashboard rows={[]} total={0} counts={counts} filters={{ q: '', status: 'all', page: 1 }} pageSize={20} />);
  expect(screen.getByRole('heading', { name: 'Short-Term Rentals' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Calculator widget' })).toBeTruthy();
  for (const link of screen.getAllByRole('link', { name: 'Create appraisal' })) expect(link.getAttribute('href')).toBe('/short-term-rentals/appraisals/new');
});
