import type { Target } from '@storm/shared';
import { logInfo, logWarning, logError } from '@storm/shared';
import { ensureDir, pathExists, readJson, writeJson } from 'fs-extra';
import { resolve, dirname } from 'path';
import { watch } from 'chokidar';

export class TargetManager {
  private targets: Target[] = [];
  private configPath: string;
  private watcher: ReturnType<typeof watch> | null = null;
  private lastTargetId: number = 0;
  private lastUpdated: number = Date.now();

  constructor(configDir = './data/config') {
    this.configPath = resolve(configDir, 'targets.json');
    this.loadTargetsFromFile();
    this.watchConfigFile();
  }

  public async loadTargetsFromFile(): Promise<void> {
    try {
      if (await pathExists(this.configPath)) {
        const data = await readJson(this.configPath);
        if (data && Array.isArray(data.targets)) {
          // Validate targets before replacing the current ones
          const validTargets = data.targets.filter((target: any) => 
            target && 
            (typeof target.id === 'number' || typeof target.id === 'string') && 
            typeof target.name === 'string' && 
            typeof target.interval === 'number' && 
            typeof target.timeout === 'number' &&
            (
              // Validate HTTP targets
              (target.type === 'http' && typeof target.url === 'string') ||
              // Validate ICMP targets
              (target.type === 'icmp' && typeof target.host === 'string')
            )
          );
          
          if (validTargets.length !== data.targets.length) {
            logWarning(`Some targets in the configuration file were invalid and will be ignored. Valid: ${validTargets.length}, Total: ${data.targets.length}`);
          }
          
          // Log changes in targets
          const oldTargetIds = new Set(this.targets.map((t: Target) => t.id));
          const newTargetIds = new Set(validTargets.map((t: Target) => t.id));
          
          const addedTargets = validTargets.filter((t: Target) => !oldTargetIds.has(t.id));
          const removedTargets = this.targets.filter((t: Target) => !newTargetIds.has(t.id));
          const changedTargets = validTargets.filter((t: Target) => {
            const oldTarget = this.targets.find(old => old.id === t.id);
            if (!oldTarget) return false;
            
            return JSON.stringify(t) !== JSON.stringify(oldTarget);
          });
          
          // Update the targets
          this.targets = validTargets;
          
          // Update the last target ID to ensure new IDs are incremental
          this.updateLastTargetId();
          
          // Update the lastUpdated timestamp
          this.lastUpdated = Date.now();
          
          // Log detailed information about the changes
          logInfo(`Loaded ${this.targets.length} targets from configuration file at ${new Date(this.lastUpdated).toISOString()}`);
          
          if (addedTargets.length > 0) {
            logInfo(`Added ${addedTargets.length} new targets: ${addedTargets.map((t: Target) => `${t.name} (${t.id})`).join(', ')}`);
          }
          
          if (removedTargets.length > 0) {
            logInfo(`Removed ${removedTargets.length} targets: ${removedTargets.map((t: Target) => `${t.name} (${t.id})`).join(', ')}`);
          }
          
          if (changedTargets.length > 0) {
            logInfo(`Updated ${changedTargets.length} targets: ${changedTargets.map((t: Target) => `${t.name} (${t.id})`).join(', ')}`);
          }
          
          if (addedTargets.length === 0 && removedTargets.length === 0 && changedTargets.length === 0) {
            logInfo('No changes detected in targets configuration');
          }
        } else {
          logWarning('Invalid targets configuration format. Expected { targets: Target[] }');
        }
      } else {
        logWarning(`Targets configuration file not found at ${this.configPath}`);
      }
    } catch (error) {
      logError(`Failed to load targets from file: ${error}`);
    }
  }
  
  private updateLastTargetId(): void {
    this.lastTargetId = this.targets.reduce((maxId, target) => {
      const id = typeof target.id === 'number' ? target.id : parseInt(String(target.id), 10);
      return !isNaN(id) && id > maxId ? id : maxId;
    }, 0);
    
    logInfo(`Last target ID updated to ${this.lastTargetId}`);
  }

  private generateTargetId(): number {
    this.lastTargetId++;
    return this.lastTargetId;
  }

  private watchConfigFile(): void {
    try {
      this.watcher = watch(this.configPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100
        }
      });

      this.watcher.on('change', async () => {
        logInfo(`Targets configuration file changed at ${this.configPath}`);
        const oldTargets = [...this.targets];
        
        await this.loadTargetsFromFile();
        logInfo(`Targets updated at ${new Date(this.lastUpdated).toISOString()}`);
      });

      logInfo(`Watching for changes to targets configuration at ${this.configPath}`);
    } catch (error) {
      logError(`Failed to set up file watcher: ${error}`);
    }
  }

  public addTarget(target: Target): void {
    const existingIndex = this.targets.findIndex(t => t.id === target.id);
    
    if (existingIndex !== -1) {
      this.targets[existingIndex] = target;
      logInfo(`Updated target: ${target.name} (${target.url || target.host})`);
    } else {
      const newTarget = {
        ...target,
        id: target.id && target.id !== 0 ? target.id : this.generateTargetId()
      };
      
      this.targets.push(newTarget);
      logInfo(`Added target: ${newTarget.name} (${newTarget.url || newTarget.host}) with ID ${newTarget.id}`);
    }
    
    this.lastUpdated = Date.now();
    this.saveTargetsToFile();
  }

  public async saveTargetsToFile(): Promise<void> {
    try {
      await ensureDir(dirname(this.configPath));
      await writeJson(this.configPath, { targets: this.targets }, { spaces: 2 });
      logInfo(`Saved ${this.targets.length} targets to configuration file`);
    } catch (error) {
      logError(`Failed to save targets to file: ${error}`);
    }
  }

  public removeTarget(targetId: number): boolean {
    const initialLength = this.targets.length;
    this.targets = this.targets.filter(target => target.id !== targetId);
    
    const removed = this.targets.length < initialLength;
    
    if (removed) {
      this.lastUpdated = Date.now();
      logInfo(`Removed target with ID: ${targetId}`);
      this.saveTargetsToFile();
    } else {
      logWarning(`Target with ID ${targetId} not found`);
    }
    
    return removed;
  }

  public updateTarget(targetId: number, updates: Partial<Target>): void {
    const target = this.targets.find(t => t.id === targetId);
    if (target) {
      Object.assign(target, updates);
      logInfo(`Updated target: ${target.name} (${target.url || target.host})`);
      
      this.lastUpdated = Date.now();
      this.saveTargetsToFile();
    }
  }

  public getTarget(targetId: number): Target | undefined {
    return this.targets.find(t => t.id === targetId);
  }
  
  public getTargetByName(name: string): Target | undefined {
    return this.targets.find(t => t.name === name);
  }

  public getTargets(): Target[] {
    return [...this.targets];
  }

  public hasUpdatedSince(timestamp: number): boolean {
    return this.lastUpdated > timestamp;
  }

  public closeWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  public getLastUpdated(): number {
    return this.lastUpdated;
  }
}