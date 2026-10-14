// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { NewBrochureFlow } from "./NewBrochureFlow";
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/listings/NewListingFlow', () => ({ NewListingFlow: () => <p>Import a property</p> }));
vi.mock('@/components/properties/PropertySetup', () => ({ PropertySetup: ({ onDirtyChange }: {onDirtyChange:(dirty:boolean)=>void}) => <><button onClick={() => onDirtyChange(true)}>Edit property</button><button onClick={() => onDirtyChange(false)}>Save property</button></> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('opens the chosen brochure type and blocks leaving property edits unsaved', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ path: '/brochures/existing' })); vi.stubGlobal('fetch', fetcher);
  render(<NewBrochureFlow initialListing={createLintRegressionFixtures().listing} storageKey="test" />);
  fireEvent.click(screen.getByLabelText('Rental brochure'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit details/photos' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit property' }));
  expect((screen.getByRole('button', { name: 'Continue to brochure' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Change property' }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save property' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue to brochure' }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/brochures/existing'));
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ listing_id:'mock-listing', type:'rental_brochure', restore_archived:false });
});
it('restores an archived brochure only after the user chooses Restore brochure', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ code:'brochure_archived', error:'Archived brochure' }, {status:409})).mockResolvedValueOnce(Response.json({path:'/brochures/restored'})); vi.stubGlobal('fetch',fetcher);
  render(<NewBrochureFlow initialListing={createLintRegressionFixtures().listing} storageKey="test" />);
  fireEvent.click(screen.getByRole('button',{name:'Continue to brochure'}));
  await screen.findByRole('button',{name:'Restore brochure'});
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Restore brochure'}));
  await waitFor(()=>expect(router.push).toHaveBeenCalledWith('/brochures/restored'));
  expect(JSON.parse(fetcher.mock.calls[1][1].body).restore_archived).toBe(true);
});
