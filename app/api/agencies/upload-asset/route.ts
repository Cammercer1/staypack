import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/requireUser";

const ALLOWED_TYPES = {
  logo: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  "logo-light": ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  "logo-dark": ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  font: [
    "font/woff",
    "font/woff2",
    "application/font-woff",
    "application/font-woff2",
    "application/x-font-woff",
    "application/x-font-ttf",
    "font/ttf",
    "font/otf",
    "application/octet-stream",
  ],
  "heading-font": [
    "font/woff",
    "font/woff2",
    "application/font-woff",
    "application/font-woff2",
    "application/x-font-woff",
    "application/x-font-ttf",
    "font/ttf",
    "font/otf",
    "application/octet-stream",
  ],
  "body-font": [
    "font/woff",
    "font/woff2",
    "application/font-woff",
    "application/font-woff2",
    "application/x-font-woff",
    "application/x-font-ttf",
    "font/ttf",
    "font/otf",
    "application/octet-stream",
  ],
};

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

    if (!isLogoUpload && type !== "font" && type !== "heading-font" && type !== "body-font") {
      return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
    }

    const allowed = ALLOWED_TYPES[type as keyof typeof ALLOWED_TYPES];
    if (!allowed.includes(file.type) && isLogoUpload) {
      return NextResponse.json(
        { error: "Logo must be PNG, JPG, WEBP or SVG" },
        { status: 400 },
      );
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const storageType =
      type === "heading-font"
        ? "heading-font"
        : type === "body-font"
          ? "body-font"
          : type === "logo"
            ? "logo-dark"
            : type;
    const path = `${agency.id}/${storageType}.${extension}`;
    const admin = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await admin.storage.from("agency-assets").upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
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
