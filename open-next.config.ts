import { defineCloudflareConfig } from '@opennextjs/cloudflare';
// Public listing queries are request-time; no R2 resource is created implicitly.
export default defineCloudflareConfig({});
