import { publicReportHandler, type ViewerAssets } from "./handler";
import { snapshotCache } from "./cache";
import { workerDatabaseFetch, workerRouter } from "./worker";

declare const PUBLIC_REPORT_ASSETS: ViewerAssets;
const worker = { fetch: workerRouter(publicReportHandler(PUBLIC_REPORT_ASSETS, snapshotCache(workerDatabaseFetch()))) };
export default worker;
