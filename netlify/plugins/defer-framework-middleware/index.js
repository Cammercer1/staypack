import { join } from "node:path";
import { deferFrameworkMiddleware } from "./defer.js";

export async function onBuild() {
  await deferFrameworkMiddleware(join(process.cwd(), ".netlify", "edge-functions"));
  console.log("Deferred Next middleware initialization for public edge reports.");
}
