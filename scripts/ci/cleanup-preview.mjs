import { accountId, previewName, repository } from './config.mjs';
if (process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Cleanup must run from main');
const name = previewName(process.env.DELETED_BRANCH);
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${name}`, { method: 'DELETE', headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` } });
if (!response.ok && response.status !== 404) throw new Error(`Preview cleanup failed (${response.status})`);
console.log(`Removed disposable preview ${name}`);
