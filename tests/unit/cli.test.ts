import { describe, it, expect } from 'vitest';
import { execFile } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const cliPath = resolve('dist/cli.js');

function createSpansFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'llm-cost-telemetry-cli-'));
  const filePath = join(dir, 'spans.json');
  writeFileSync(
    filePath,
    JSON.stringify([
      {
        id: 'span-1',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.01,
        startTime: '2026-04-19T00:00:00.000Z',
        endTime: '2026-04-19T00:00:01.000Z',
        telemetry: {
          tenant: 'acme-corp',
          feature: 'chat',
          route: '/api/chat',
        },
      },
    ]),
  );
  return filePath;
}

describe('CLI', () => {
  it('should show version', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, 'version'], { timeout: 10000 });
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should show help', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, '--help'], { timeout: 10000 });
    expect(stdout).toContain('llm-cost-telemetry');
    expect(stdout).toContain('report');
    expect(stdout).toContain('check');
    expect(stdout).toContain('export');
    expect(stdout).toContain('config');
  });

  it('should run report command', async () => {
    const inputPath = createSpansFile();
    const { stdout } = await execFileAsync(
      'node',
      [cliPath, 'report', '--period', 'day', '--format', 'table', '--input', inputPath],
      { timeout: 10000 },
    );
    expect(stdout).toContain('Cost Report');
  });

  it('should run check command', async () => {
    const { stdout } = await execFileAsync(
      'node',
      [cliPath, 'check', '--tenant', 'acme-corp', '--format', 'text'],
      { timeout: 10000 },
    );
    expect(stdout).toContain('Budget Status');
  });

  it('should run export command', async () => {
    const inputPath = createSpansFile();
    const { stdout } = await execFileAsync(
      'node',
      [cliPath, 'export', '--exporter', 'cloudwatch', '--input', inputPath, '--dry-run'],
      { timeout: 10000 },
    );
    expect(stdout).toContain('exporter');
  });

  it('should run config command in json format', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, 'config'], { timeout: 10000 });
    expect(stdout).toContain('environment');
  });

  it('should run config command in env format', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, 'config', '--format', 'env'], {
      timeout: 10000,
    });
    expect(stdout).toContain('OTEL_SERVICE_NAME');
  });
});
