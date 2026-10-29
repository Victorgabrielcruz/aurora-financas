import {config} from 'dotenv';
import {fileURLToPath} from 'node:url';

// Resolve from the module so npm workspaces and compiled startup use the same file.
// Explicit process environment always takes precedence.
for (const path of ['../../.env.local', '../../.env', '../.env']) {
  config({path:fileURLToPath(new URL(path, import.meta.url))});
}
