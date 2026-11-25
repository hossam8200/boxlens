// BoxLens dashboards entry point. Bootstraps the theme, mounts the shell,
// starts the router, and polls /api/v1/health for the footer status.
import './dashboards/framework/styles.css';
import { initTheme } from './dashboards/framework/theme';
import { mountShell, pollHealth } from './dashboards/shell';

initTheme();

const root = document.getElementById('app');
if (!root) throw new Error('#app mount point missing');

const shell = mountShell(root);

// Poll platform health every 60s for the footer "Last update X ago" line.
void pollHealth(shell);
setInterval(() => void pollHealth(shell), 60_000);
