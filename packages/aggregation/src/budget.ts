/**
 * Budget tracking and enforcement
 */
import type { BudgetConfig, BudgetStatus, AlertAction, TelemetryContext } from '@reaatech/llm-cost-telemetry';
import { roundTo, percentage } from '@reaatech/llm-cost-telemetry';

/**
 * Budget tracking state for a tenant
 */
interface TenantBudgetState {
  /** Total spent in the current daily period */
  dailySpent: number;
  /** Total spent in the current monthly period */
  monthlySpent: number;
  /** Daily period start */
  dailyPeriodStart: Date;
  /** Monthly period start */
  monthlyPeriodStart: Date;
  /** Alerts that have been triggered */
  triggeredAlerts: Set<string>;
}

/**
 * Budget manager for tracking and enforcing budgets
 */
export class BudgetManager {
  private config: BudgetConfig;
  private tenantStates: Map<string, TenantBudgetState> = new Map();

  constructor(config: BudgetConfig) {
    this.config = config;
  }

  /**
   * Check if a cost is within budget for a tenant
   */
  async check(options: {
    tenant: string;
    estimatedCost: number;
    context?: Partial<TelemetryContext>;
  }): Promise<BudgetStatus> {
    const { tenant, estimatedCost } = options;
    const state = this.getOrCreateState(tenant);
    this.resetPeriodsIfNeeded(state);

    const limits = this.getLimits(tenant);
    const dailyPercentage = percentage(state.dailySpent + estimatedCost, limits.daily);
    const monthlyPercentage = percentage(state.monthlySpent + estimatedCost, limits.monthly);

    const dailyExceeded = state.dailySpent + estimatedCost > limits.daily;
    const monthlyExceeded = state.monthlySpent + estimatedCost > limits.monthly;

    // Check alerts
    const alerts = this.checkAlerts(tenant, dailyPercentage, monthlyPercentage);

    return {
      tenant,
      withinBudget: !dailyExceeded && !monthlyExceeded,
      dailyPercentage: roundTo(dailyPercentage, 2),
      monthlyPercentage: roundTo(monthlyPercentage, 2),
      dailySpent: roundTo(state.dailySpent, 6),
      monthlySpent: roundTo(state.monthlySpent, 6),
      dailyLimit: limits.daily,
      monthlyLimit: limits.monthly,
      dailyExceeded,
      monthlyExceeded,
      alerts,
      activeAlerts: [],
    };
  }

  /**
   * Record a cost against a tenant's budget
   */
  async record(options: {
    tenant: string;
    cost: number;
    context?: Partial<TelemetryContext>;
  }): Promise<void> {
    const { tenant, cost } = options;
    const state = this.getOrCreateState(tenant);
    this.resetPeriodsIfNeeded(state);

    state.dailySpent = roundTo(state.dailySpent + cost, 6);
    state.monthlySpent = roundTo(state.monthlySpent + cost, 6);

    // Check and trigger alerts
    const limits = this.getLimits(tenant);
    const dailyPercentage = percentage(state.dailySpent, limits.daily);
    const monthlyPercentage = percentage(state.monthlySpent, limits.monthly);

    this.checkAlerts(tenant, dailyPercentage, monthlyPercentage);
  }

  /**
   * Get or create budget state for a tenant
   */
  private getOrCreateState(tenant: string): TenantBudgetState {
    const existing = this.tenantStates.get(tenant);
    if (existing) {
      return existing;
    }

    const dailyStart = new Date();
    dailyStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const state: TenantBudgetState = {
      dailySpent: 0,
      monthlySpent: 0,
      dailyPeriodStart: dailyStart,
      monthlyPeriodStart: monthStart,
      triggeredAlerts: new Set(),
    };
    this.tenantStates.set(tenant, state);
    return state;
  }

  /**
   * Reset periods if they've passed
   */
  private resetPeriodsIfNeeded(state: TenantBudgetState): void {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    if (todayStart.getTime() > state.dailyPeriodStart.getTime()) {
      state.dailySpent = 0;
      state.dailyPeriodStart = todayStart;
      state.triggeredAlerts.clear();
    }

    if (monthStart.getTime() > state.monthlyPeriodStart.getTime()) {
      state.monthlySpent = 0;
      state.monthlyPeriodStart = monthStart;
      state.triggeredAlerts.clear();
    }
  }

  /**
   * Get budget limits for a tenant
   */
  private getLimits(tenant: string): { daily: number; monthly: number } {
    const tenantLimits = this.config.tenants?.[tenant];

    return {
      daily: tenantLimits?.daily ?? this.config.global?.daily ?? Infinity,
      monthly: tenantLimits?.monthly ?? this.config.global?.monthly ?? Infinity,
    };
  }

  /**
   * Check alerts and return triggered ones
   */
  private checkAlerts(
    tenant: string,
    dailyPercentage: number,
    monthlyPercentage: number,
  ): AlertAction[] {
    const triggered: AlertAction[] = [];
    const state = this.tenantStates.get(tenant);
    if (!state) return triggered;

    const alerts = this.config.alerts ?? [];
    const maxPercentage = Math.max(dailyPercentage, monthlyPercentage);

    for (const alert of alerts) {
      const alertKey = `${alert.threshold}:${alert.action}`;

      if (maxPercentage >= alert.threshold * 100 && !state.triggeredAlerts.has(alertKey)) {
        triggered.push(alert.action);
        state.triggeredAlerts.add(alertKey);
      }
    }

    return triggered;
  }

  /**
   * Get current budget status for a tenant
   */
  getStatus(tenant: string): BudgetStatus {
    const state = this.getOrCreateState(tenant);
    this.resetPeriodsIfNeeded(state);

    const limits = this.getLimits(tenant);
    const dailyPercentage = percentage(state.dailySpent, limits.daily);
    const monthlyPercentage = percentage(state.monthlySpent, limits.monthly);

    return {
      tenant,
      withinBudget: state.dailySpent <= limits.daily && state.monthlySpent <= limits.monthly,
      dailyPercentage: roundTo(dailyPercentage, 2),
      monthlyPercentage: roundTo(monthlyPercentage, 2),
      dailySpent: roundTo(state.dailySpent, 6),
      monthlySpent: roundTo(state.monthlySpent, 6),
      dailyLimit: limits.daily,
      monthlyLimit: limits.monthly,
      dailyExceeded: state.dailySpent > limits.daily,
      monthlyExceeded: state.monthlySpent > limits.monthly,
      alerts: [],
      activeAlerts: [],
    };
  }

  /**
   * Set budget limits for a tenant
   */
  setLimits(tenant: string, limits: { daily?: number; monthly?: number }): void {
    if (!this.config.tenants) {
      this.config.tenants = {};
    }
    this.config.tenants[tenant] = {
      ...this.config.tenants[tenant],
      ...limits,
    };
  }

  /**
   * Reset budget for a tenant
   */
  reset(tenant: string): void {
    const state = this.tenantStates.get(tenant);
    if (state) {
      state.dailySpent = 0;
      state.monthlySpent = 0;
      state.triggeredAlerts.clear();
    }
  }

  /**
   * Get all tenant states
   */
  getAllStates(): Map<string, TenantBudgetState> {
    return new Map(this.tenantStates);
  }
}
