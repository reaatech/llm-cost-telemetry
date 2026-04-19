# Skill: Budget Alerts

## What It Is

Budget alerts monitor LLM spending against configured budgets and trigger notifications when thresholds are approached or exceeded. It supports per-tenant, per-feature, and global budgets with configurable alert actions (log, notify, block).

## Why It Matters

- **Cost Control** — Prevent runaway API costs
- **Proactive Alerts** — Get notified before budgets are exceeded
- **Multi-Level Budgets** — Set budgets at different granularities
- **Automated Enforcement** — Optionally block requests when budget exhausted

## How to Use It

### Configure Budget Manager

```typescript
import { BudgetManager } from 'llm-cost-telemetry';

const budgetManager = new BudgetManager({
  // Global budgets
  global: {
    daily: 500.00,
    monthly: 10000.00
  },
  // Per-tenant budgets
  tenants: {
    'acme-corp': {
      daily: 100.00,
      monthly: 2000.00
    },
    'startup-inc': {
      daily: 50.00,
      monthly: 1000.00
    }
  },
  // Alert thresholds
  alerts: [
    { threshold: 0.5, action: 'log' },      // 50% - log warning
    { threshold: 0.75, action: 'notify' },  // 75% - send notification
    { threshold: 0.9, action: 'block' }     // 90% - block requests
  ]
});
```

### Check Budget Before API Call

```typescript
import { BudgetManager } from 'llm-cost-telemetry';

const budgetManager = new BudgetManager({
  tenants: {
    'acme-corp': { daily: 100.00 }
  }
});

// Check budget before making an expensive call
const status = await budgetManager.check({
  tenant: 'acme-corp',
  estimatedCost: 5.00
});

if (!status.withinBudget) {
  console.warn(`Budget exceeded: ${status.dailyPercentage}% used`);
  // Optionally block the request
  throw new Error('Budget exhausted');
}

// Proceed with API call
```

### Set Up Notifications

Budget alerts trigger actions (`log`, `notify`, `block`) when thresholds are crossed. The `notify` action can be handled via the `onSpanFlush` callback or by monitoring the budget status:

```typescript
import { BudgetManager } from 'llm-cost-telemetry';

const budgetManager = new BudgetManager({
  tenants: {
    'acme-corp': { daily: 100.00 }
  },
  alerts: [
    {
      threshold: 0.75,
      action: 'notify'
      // Handle notifications by checking BudgetStatus.alerts
    }
  ]
});

// Check status and handle alerts
const status = await budgetManager.check({
  tenant: 'acme-corp',
  estimatedCost: 5.00
});

if (status.alerts?.includes('notify')) {
  // Send notification via your preferred channel
  console.log(`Budget alert: ${status.tenant} at ${status.dailyPercentage}%`);
}
```

### Get Budget Status

```typescript
import { BudgetManager } from 'llm-cost-telemetry';

const budgetManager = new BudgetManager({
  tenants: {
    'acme-corp': { daily: 100.00, monthly: 2000.00 }
  }
});

// Get current budget status
const status = await budgetManager.getStatus('acme-corp');

console.log(`Daily: $${status.dailySpent} / $${status.dailyBudget} (${status.dailyPercentage}%)`);
console.log(`Monthly: $${status.monthlySpent} / $${status.monthlyBudget} (${status.monthlyPercentage}%)`);
```

### Configure Alert Actions

```typescript
import { BudgetManager } from 'llm-cost-telemetry';

const budgetManager = new BudgetManager({
  tenants: {
    'acme-corp': { daily: 100.00 }
  },
  alerts: [
    // Log at 50%
    {
      threshold: 0.5,
      action: 'log',
      message: 'Budget at 50% - monitor closely'
    },
    // Notify at 75%
    {
      threshold: 0.75,
      action: 'notify'
    },
    // Block at 90%
    {
      threshold: 0.9,
      action: 'block',
      message: 'Budget exhausted - requests blocked'
    }
  ]
});
```

## Key Metrics

| Metric | Description | Thresholds |
|--------|-------------|------------|
| `budget_percentage` | Current budget utilization | 0-100% |
| `spent_today` | Amount spent today | USD |
| `spent_this_month` | Amount spent this month | USD |
| `remaining_daily` | Remaining daily budget | USD |
| `remaining_monthly` | Remaining monthly budget | USD |

## Best Practices

1. **Set multiple thresholds** — 50%, 75%, 90% for progressive alerts
2. **Use appropriate actions** — Log → Notify → Block progression
3. **Reset budgets daily** — Daily budgets reset at midnight UTC
4. **Monitor budget resets** — Ensure budgets reset correctly
5. **Review alert fatigue** — Don't set too many alerts

## Common Pitfalls

- **No soft limits** — Only having hard block limits causes surprises
- **Wrong reset time** — Budgets should reset at business-appropriate times
- **Blocking too early** — Don't block at 100% — leave room for critical requests
- **Ignoring small tenants** — Small tenants can have runaway costs too

## Alert Actions

| Action | Description | Use Case |
|--------|-------------|----------|
| `log` | Log warning to console/logs | Early warning (50%) |
| `notify` | Return alert status for external notification | Serious warning (75%) |
| `block` | Block further requests | Budget exhausted (90%+) |

## Related Skills

- [Tenant Aggregation](../tenant-aggregation/skill.md)
- [Cost Interception](../cost-interception/skill.md)
- [CloudWatch Export](../cloudwatch-export/skill.md)
- [Cost Optimization](../cost-optimization/skill.md)
