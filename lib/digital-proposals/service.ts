import { z } from "zod";
import { assetUrlSchema } from "./data";

/** Brand-owned service copy is part of the published snapshot, never a live website embed. */
export const proposalServiceSchema = z.object({
  eyebrow: z.string().trim().min(1).max(100),
  headline: z.string().trim().min(1).max(180),
  introduction: z.string().trim().min(1).max(600),
  imageUrl: assetUrlSchema,
  imageAlt: z.string().trim().min(1).max(180),
  imageCaption: z.string().trim().max(120),
  highlights: z.array(z.object({
    icon: z.enum(["strategy", "care", "hospitality", "communication"]),
    title: z.string().trim().min(1).max(100),
    body: z.string().trim().min(1).max(400),
  }).strict()).min(1).max(4),
  platforms: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    imageUrl: assetUrlSchema,
  }).strict()).max(8).optional(),
  proof: z.object({
    value: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(400),
  }).strict().optional(),
}).strict();
export type ProposalService = z.infer<typeof proposalServiceSchema>;

export function serviceTokenTexts(service: ProposalService): string[] {
  return [service.eyebrow, service.headline, service.introduction, service.imageAlt, service.imageCaption,
    ...service.highlights.flatMap(item => [item.title, item.body]),
    ...(service.proof ? [service.proof.value, service.proof.label, service.proof.body] : [])];
}
