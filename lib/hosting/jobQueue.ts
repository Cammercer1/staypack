export type AppraisalQueueMessage = { kind: "lease" | "sales"; jobId: string; agencyId: string };

/** Netlify/local fallback. The Workers build replaces this module with a binding. */
export async function enqueueAppraisalJob(_message: AppraisalQueueMessage): Promise<boolean> {
  void _message;
  return false;
}
