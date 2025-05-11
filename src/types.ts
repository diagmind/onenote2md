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
}
