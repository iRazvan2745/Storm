import { format } from 'date-fns';
import chalk from 'chalk';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function formatTimestamp(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
}

export function logInfo(message: string): void {
  console.log(chalk.blue(`[INFO] ${message}`));
}

export function logSuccess(message: string): void {
  console.log(chalk.green(`[SUCCESS] ${message}`));
}

export function logError(message: string): void {
  console.log(chalk.red(`[ERROR] ${message}`));
}

export function logWarning(message: string): void {
  console.log(chalk.yellow(`[WARNING] ${message}`));
}
