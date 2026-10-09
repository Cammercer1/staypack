import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/requireUser";

import { validateAgentPhoto } from "@/lib/agents/photo";

export async function POST(request: Request) {
  try {
    const { agency } = await requireAgencyAdmin();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validationError = validateAgentPhoto(file);
    if (validationError)
      return NextResponse.json({ error: validationError }, { status: 400 });
    const extension = (
      {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/avif": "avif",
      } as Record<string, string>
    )[file.type];
    const path = `${agency.id}/${crypto.randomUUID()}.${extension}`;
    const admin = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await admin.storage
      .from("agent-assets")
      .upload(path, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("agent-assets").getPublicUrl(path);

    return NextResponse.json({ url: publicUrl, path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
