import fs from 'fs-extra';
import path from 'path';

/**
 * Debug logger that can write debug info to files
 */
export class DebugLogger {
  private enabled: boolean;
  private outputDir: string;
  
  constructor(enabled: boolean, outputDir: string) {
    this.enabled = enabled;
    this.outputDir = outputDir;
  }
  
  /**
   * Log data to console and optionally write to file
   */
  async log(stage: string, data: any): Promise<void> {
    if (!this.enabled) return;
    
    console.log(`[DEBUG] ${stage}:`, data);
    
    try {
      // Create debug directory if it doesn't exist
      const debugDir = path.join(this.outputDir, 'debug');
      await fs.ensureDir(debugDir);
      
      // Write debug data to file
      const fileName = `${stage.replace(/\s+/g, '-')}.json`;
      const filePath = path.join(debugDir, fileName);
      
      await fs.writeFile(
        filePath, 
        JSON.stringify(data, null, 2),
        'utf-8'
      );
      
      console.log(`[DEBUG] Saved ${stage} data to ${filePath}`);
    } catch (error) {
      console.error(`[DEBUG] Error saving debug data: ${error}`);
    }
  }
}
