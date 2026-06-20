import { getLogger } from './dist/index.js';

const logger = getLogger({ name: 'test' });

// Two-argument form as documented in README line 176:
// logBudgetAlert(tenant, status)
logger.logBudgetAlert('tenant-id', { threshold: 80, percentage: 85, action: 'warn' });
