import { z } from "zod";
import { brandSchema } from "./brand";
import { proposalDataSchema } from "./data";
import { proposalDraftSchema } from "./template";

export const attachmentSchema = z.object({ id: z.uuid(), name: z.string().min(1).max(200), byte_size: z.number().int().positive() });
/** Public projection deliberately excludes the separate PDF rendering document. */
export const viewerSnapshotSchema = z.object({
  version: z.literal(1), data: proposalDataSchema, draft: proposalDraftSchema, brand: brandSchema,
  attachments: z.array(attachmentSchema).max(20),
  assignment: z.object({ name: z.string(), version: z.number().int().positive() }).optional(),
}).strict();
export type ViewerSnapshot = z.infer<typeof viewerSnapshotSchema>;
