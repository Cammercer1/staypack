import { randomUUID } from "node:crypto";
import {
  validateBrandAsset,
  type BrandAssetType,
} from "@/lib/branding/assetUpload";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/requireUser";

export async function POST(request: Request) {
  try {
    const { agency } = await requireAgencyAdmin();
    const formData = await request.formData();
    const file = formData.get("file");
    const type = String(formData.get("type") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const isLogoUpload =
      type === "logo" || type === "logo-light" || type === "logo-dark";

    if (
      !isLogoUpload &&
      type !== "font" &&
      type !== "heading-font" &&
      type !== "body-font"
    ) {
      return NextResponse.json(
        { error: "Invalid upload type" },
        { status: 400 },
      );
    }

    const validationError = validateBrandAsset(file, type as BrandAssetType);
    if (validationError)
      return NextResponse.json({ error: validationError }, { status: 400 });

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const storageType =
      type === "heading-font"
        ? "heading-font"
        : type === "body-font"
          ? "body-font"
          : type === "logo"
            ? "logo-dark"
            : type;
    const path = `${agency.id}/${storageType}-${randomUUID()}.${extension}`;
    const admin = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await admin.storage
      .from("agency-assets")
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("agency-assets").getPublicUrl(path);

    return NextResponse.json({ url: publicUrl, path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
