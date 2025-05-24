// Types and interfaces for the docx2html package

export interface ConfigItem {
  text: string;
  link: string;
  display?: string;
}

export interface ConfigSection {
  text: string;
  items: ConfigItem[];
}

export type Config = ConfigSection[];

export interface CLIOptions {
  url?: string;
  configUrl?: string;
  source?: 'local' | 'remote';
  output?: string;
  dev?: boolean;
  debug?: boolean;
  markdown?: boolean;
  port?: string;
  wait?: string;
  autoMd?: boolean; // New option for the -M flag
}
