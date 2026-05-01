import type { BudgetConfig } from '@reaatech/llm-cost-telemetry';
import { BudgetManager } from '@reaatech/llm-cost-telemetry-aggregation';
/**
 * Unit tests for budget management
 */
import { describe, expect, it } from 'vitest';

describe('Budget Manager', () => {
  const createBudgetConfig = (): BudgetConfig => ({
    global: {
      daily: 100,
      monthly: 2000,
    },
    tenants: {
      'test-tenant': {
        daily: 50,
        monthly: 1000,
      },
    },
    alerts: [
      { threshold: 0.5, action: 'log' },
      { threshold: 0.8, action: 'notify' },
      { threshold: 1.0, action: 'block' },
    ],
  });

  describe('check', () => {
    it('should return within budget when under limit', async () => {
      const config = createBudgetConfig();
      const manager = new BudgetManager(config);

      const status = await manager.check({
        tenant: 'test-tenant',
        estimatedCost: 10,
      });

      expect(status.withinBudget).toBe(true);
      expect(status.dailyPercentage).toBeLessThanOrEqual(20);
    });

    it('should return exceeded when over limit', async () => {
      const config: BudgetConfig = {
        tenants: {
          'test-tenant': { daily: 50, monthly: 1000 },
        },
        alerts: [],
      };
      const manager = new BudgetManager(config);

      // Record some spending first
      await manager.record({ tenant: 'test-tenant', cost: 45 });

      const status = await manager.check({
        tenant: 'test-tenant',
        estimatedCost: 10,
      });

      expect(status.withinBudget).toBe(false);
      expect(status.dailyExceeded).toBe(true);
    });

    it('should use global limits when tenant has no specific limits', async () => {
      const config: BudgetConfig = {
        global: { daily: 100, monthly: 2000 },
        alerts: [],
      };
      const manager = new BudgetManager(config);

      const status = await manager.check({
        tenant: 'unknown-tenant',
        estimatedCost: 10,
      });

      expect(status.dailyLimit).toBe(100);
      expect(status.monthlyLimit).toBe(2000);
    });

    it('should trigger alerts at thresholds', async () => {
      const config = createBudgetConfig();
      const manager = new BudgetManager(config);

      // Check with an estimated cost that would hit 50% threshold
      // 25 is 50% of 50 (tenant daily limit), which should trigger the 0.5 threshold alert
      const status = await manager.check({
        tenant: 'test-tenant',
        estimatedCost: 25,
      });

      // The alert should be triggered because the estimated cost hits the threshold
      expect(status.alerts).toContain('log');
    });
  });

  describe('record', () => {
    it('should record costs against budget', async () => {
      const config = createBudgetConfig();
      const manager = new BudgetManager(config);

      await manager.record({ tenant: 'test-tenant', cost: 10 });

      const status = manager.getStatus('test-tenant');
      expect(status.dailySpent).toBe(10);
      expect(status.monthlySpent).toBe(10);
    });

    it('should accumulate costs', async () => {
      const config = createBudgetConfig();
      const manager = new BudgetManager(config);

      await manager.record({ tenant: 'test-tenant', cost: 10 });
      await manager.record({ tenant: 'test-tenant', cost: 15 });

      const status = manager.getStatus('test-tenant');
      expect(status.dailySpent).toBe(25);
    });
  });

  describe('getStatus', () => {
    it('should return current budget status', () => {
      const config = createBudgetConfig();
      const manager = new BudgetManager(config);

      const status = manager.getStatus('test-tenant');

      expect(status.tenant).toBe('test-tenant');
      expect(status.dailyLimit).toBe(50);
      expect(status.monthlyLimit).toBe(1000);
      expect(status.dailySpent).toBe(0);
      expect(status.monthlySpent).toBe(0);
    });

    it('should calculate percentages correctly', async () => {
      const config = createBudgetConfig();
      const manager = new BudgetManager(config);

      await manager.record({ tenant: 'test-tenant', cost: 25 });

      const status = manager.getStatus('test-tenant');
      expect(status.dailyPercentage).toBe(50);
      expect(status.monthlyPercentage).toBe(2.5);
    });
  });

  describe('setLimits', () => {
    it('should set limits for a tenant', () => {
      const config: BudgetConfig = { tenants: {}, alerts: [] };
      const manager = new BudgetManager(config);

      manager.setLimits('new-tenant', { daily: 100, monthly: 2000 });

      const status = manager.getStatus('new-tenant');
      expect(status.dailyLimit).toBe(100);
      expect(status.monthlyLimit).toBe(2000);
    });

    it('should update existing limits', () => {
      const config = createBudgetConfig();
      const manager = new BudgetManager(config);

      manager.setLimits('test-tenant', { daily: 75 });

      const status = manager.getStatus('test-tenant');
      expect(status.dailyLimit).toBe(75);
      expect(status.monthlyLimit).toBe(1000); // unchanged
    });
  });

  describe('reset', () => {
    it('should reset budget for a tenant', async () => {
      const config = createBudgetConfig();
      const manager = new BudgetManager(config);

      await manager.record({ tenant: 'test-tenant', cost: 25 });

      let status = manager.getStatus('test-tenant');
      expect(status.dailySpent).toBe(25);

      manager.reset('test-tenant');

      status = manager.getStatus('test-tenant');
      expect(status.dailySpent).toBe(0);
      expect(status.monthlySpent).toBe(0);
    });
  });
});
