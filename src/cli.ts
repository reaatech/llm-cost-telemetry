#!/usr/bin/env node
/**
 * CLI entry point for llm-cost-telemetry
 */
import { Command } from 'commander';
import { BudgetManager } from './aggregation/budget.js';
import { loadConfig } from './config/index.js';
import { generateReport, formatReport } from './cli/commands/report.command.js';
import { checkBudget, formatBudgetStatus } from './cli/commands/check.command.js';
import { loadSpansInput } from './cli/input.js';
import packageJson from '../package.json' with { type: 'json' };

/* eslint-disable no-console */

const version = packageJson.version;

const program = new Command();

program
  .name('llm-cost-telemetry')
  .description('Enterprise-grade LLM cost telemetry CLI')
  .version(version);

program
  .command('report')
  .description('Generate cost report')
  .requiredOption('-p, --period <period>', 'Time period (minute, hour, day, week, month)')
  .option('-t, --tenant <tenant>', 'Filter by tenant')
  .option('-f, --format <format>', 'Output format (json, table)', 'json')
  .option('--start <date>', 'Start date (ISO format)')
  .option('--end <date>', 'End date (ISO format)')
  .option('-i, --input <path>', 'Path to a JSON file containing cost spans')
  .option('--group-by <dimensions>', 'Comma-separated dimensions to group by')
  .action(async (options) => {
    const validFormats = ['json', 'table'];
    if (!validFormats.includes(options.format)) {
      console.error(`Invalid format '${options.format}'. Use: ${validFormats.join(', ')}`);
      process.exit(1);
    }
    const validPeriods = ['minute', 'hour', 'day', 'week', 'month'];
    if (!validPeriods.includes(options.period)) {
      console.error(`Invalid period '${options.period}'. Use: ${validPeriods.join(', ')}`);
      process.exit(1);
    }

    const groupBy = options.groupBy ? options.groupBy.split(',') : undefined;
    const spans = await loadSpansInput(options.input);
    if (spans.length === 0) {
      console.error('No spans found. Pass --input or pipe a JSON array of cost spans to stdin.');
      process.exit(1);
    }

    const summary = await generateReport(spans, {
      tenant: options.tenant,
      period: options.period,
      format: options.format,
      start: options.start,
      end: options.end,
      groupBy,
    });

    console.log(formatReport(summary, options.format));
  });

program
  .command('check')
  .description('Check budget status')
  .requiredOption('-t, --tenant <tenant>', 'Tenant identifier')
  .option('--threshold <threshold>', 'Alert threshold (0-1)', '0.8')
  .option('-f, --format <format>', 'Output format (json, text)', 'json')
  .action(async (options) => {
    const threshold = parseFloat(options.threshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      console.error('Threshold must be a number between 0 and 1');
      process.exit(1);
    }
    const validFormats = ['json', 'text'];
    if (!validFormats.includes(options.format)) {
      console.error(`Invalid format '${options.format}'. Use: ${validFormats.join(', ')}`);
      process.exit(1);
    }

    const config = loadConfig();
    const budgetManager = new BudgetManager(config.budget);

    const status = await checkBudget(budgetManager, {
      tenant: options.tenant,
      threshold,
    });

    console.log(formatBudgetStatus(status, options.format));
  });

program
  .command('export')
  .description('Manual export trigger')
  .option('-e, --exporter <exporter>', 'Exporter type (cloudwatch, cloud-monitoring, phoenix)')
  .option('-p, --period <period>', 'Time period to export (hour, day)', 'hour')
  .option('-i, --input <path>', 'Path to a JSON file containing cost spans')
  .option('--dry-run', 'Build records without sending them to an exporter')
  .action(async (options) => {
    const config = loadConfig();
    const { buildExportPayload, triggerExport, formatExportResult } = await import(
      './cli/commands/export.command.js'
    );
    const spans = await loadSpansInput(options.input);
    if (spans.length === 0) {
      console.error('No spans found. Pass --input or pipe a JSON array of cost spans to stdin.');
      process.exit(1);
    }
    const records = buildExportPayload(spans);

    let exporter;
    if (!options.dryRun) {
      switch (options.exporter) {
        case 'cloudwatch': {
          const { CloudWatchExporter } = await import('./exporters/cloudwatch.js');
          const cwConfig = config.cloudWatch;
          exporter = new CloudWatchExporter(cwConfig);
          break;
        }
        case 'cloud-monitoring': {
          const { CloudMonitoringExporter } = await import('./exporters/cloud-monitoring.js');
          const cmConfig = config.cloudMonitoring;
          exporter = new CloudMonitoringExporter(cmConfig);
          break;
        }
        case 'phoenix': {
          const { PhoenixExporter } = await import('./exporters/phoenix.js');
          const phoenixConfig = config.phoenix;
          exporter = new PhoenixExporter(phoenixConfig);
          break;
        }
        default:
          console.error(`Unknown exporter: ${options.exporter}`);
          process.exit(1);
      }
    }

    if (!options.dryRun && !exporter) {
      console.error(`Unknown exporter: ${options.exporter}`);
      process.exit(1);
    }

    const result = options.dryRun
      ? {
          exporter: options.exporter ?? 'dry-run',
          period: options.period,
          recordsExported: records.length,
          success: true,
          durationMs: 0,
          errors: [],
        }
      : await triggerExport(exporter!, records, {
          exporter: options.exporter,
          period: options.period,
        });

    console.log(formatExportResult(result));
  });

program
  .command('config')
  .description('Show current configuration')
  .option('--format <format>', 'Output format (json, env)', 'json')
  .action(async (options) => {
    const config = loadConfig();
    const envConfig = {
      OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? '[set]' : '[not set]',
      AWS_REGION: process.env.AWS_REGION,
      GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
      LOKI_HOST: process.env.LOKI_HOST,
      DEFAULT_DAILY_BUDGET: process.env.DEFAULT_DAILY_BUDGET,
      DEFAULT_MONTHLY_BUDGET: process.env.DEFAULT_MONTHLY_BUDGET,
    };

    if (options.format === 'env') {
      console.log('# llm-cost-telemetry configuration');
      for (const [key, value] of Object.entries(envConfig)) {
        console.log(`${key}=${value}`);
      }
    } else {
      console.log(
        JSON.stringify({ config: sanitizeConfig(config), environment: envConfig }, null, 2),
      );
    }
  });

program
  .command('version')
  .description('Show version')
  .action(() => {
    console.log(version);
  });

function sanitizeConfig(config: ReturnType<typeof loadConfig>): Record<string, unknown> {
  return {
    telemetry: {
      serviceName: config.telemetry.serviceName,
      tracingEnabled: config.telemetry.tracingEnabled,
      metricsEnabled: config.telemetry.metricsEnabled,
    },
    budget: {
      global: config.budget.global,
      alerts: config.budget.alerts,
    },
    cloudWatch: {
      enabled: config.cloudWatch.enabled,
      region: config.cloudWatch.region,
      namespace: config.cloudWatch.namespace,
    },
    cloudMonitoring: {
      enabled: config.cloudMonitoring.enabled,
      projectId: config.cloudMonitoring.projectId,
    },
    phoenix: {
      enabled: config.phoenix.enabled,
      host: config.phoenix.host,
    },
  };
}

program.parse();
