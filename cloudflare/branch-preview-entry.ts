import application from "vinext/server/fetch-handler";
import { branchPreviewHandler } from "./branchPreview";

const worker = {
  async fetch(request: Request, env: Parameters<ReturnType<typeof branchPreviewHandler>>[1], context: { waitUntil(promise: Promise<unknown>): void }) {
    return branchPreviewHandler(req => application.fetch(req, env, context))(request, env);
  },
};
export default worker;
