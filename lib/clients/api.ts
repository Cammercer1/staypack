import { ClientError } from "./service";
import { privateJson, strApiError } from "@/lib/str-appraisals/api";

export function clientApiError(error: unknown) {
  if (error instanceof ClientError) return privateJson({ error: error.message }, error.status);
  return strApiError(error);
}
