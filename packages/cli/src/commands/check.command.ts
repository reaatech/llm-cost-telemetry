import type { BudgetStatus } from '@reaatech/llm-cost-telemetry';
/**
 * Check command — Check budget status
 */
import type { BudgetManager } from '@reaatech/llm-cost-telemetry-aggregation';

export interface CheckOptions {
  tenant: string;
  threshold: number;
}

export async function checkBudget(
  budgetManager: BudgetManager,
  options: CheckOptions,
): Promise<BudgetStatus> {
  const { tenant, threshold } = options;

  const status = budgetManager.getStatus(tenant);

  if (threshold > 0) {
    const thresholdPercent = threshold * 100;
    if (
      status.dailyPercentage >= thresholdPercent ||
      status.monthlyPercentage >= thresholdPercent
    ) {
      status.withinBudget = false;
    }
  }

  return status;
}

export function formatBudgetStatus(status: BudgetStatus, format: 'json' | 'text' = 'json'): string {
  if (format === 'json') {
    return JSON.stringify(
      {
        tenant: status.tenant,
        withinBudget: status.withinBudget,
        daily: {
          spent: status.dailySpent,
          limit: status.dailyLimit,
          percentage: status.dailyPercentage,
          exceeded: status.dailyExceeded,
          remaining:
            status.dailyRemaining ?? Math.max(0, (status.dailyLimit ?? 0) - status.dailySpent),
        },
        monthly: {
          spent: status.monthlySpent,
          limit: status.monthlyLimit,
          percentage: status.monthlyPercentage,
          exceeded: status.monthlyExceeded,
          remaining:
            status.monthlyRemaining ??
            Math.max(0, (status.monthlyLimit ?? 0) - status.monthlySpent),
        },
      },
      null,
      2,
    );
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(`=== Budget Status: ${status.tenant} ===`);
  lines.push(`Within Budget: ${status.withinBudget ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push('Daily:');
  lines.push(`  Spent:     $${status.dailySpent.toFixed(6)}`);
  lines.push(`  Limit:     $${status.dailyLimit ?? 'N/A'}`);
  lines.push(`  Used:      ${status.dailyPercentage.toFixed(1)}%`);
  lines.push(`  Exceeded:  ${status.dailyExceeded ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push('Monthly:');
  lines.push(`  Spent:     $${status.monthlySpent.toFixed(6)}`);
  lines.push(`  Limit:     $${status.monthlyLimit ?? 'N/A'}`);
  lines.push(`  Used:      ${status.monthlyPercentage.toFixed(1)}%`);
  lines.push(`  Exceeded:  ${status.monthlyExceeded ? 'YES' : 'NO'}`);

  return lines.join('\n');
}
