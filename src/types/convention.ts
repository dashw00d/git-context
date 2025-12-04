export type ImportPathStyle =
  | 'absolute'
  | 'relative'
  | 'alias'
  | 'package'
  | 'index'
  | 'extension'
  | 'no-extension';

export interface ImportPathConvention {
  style: ImportPathStyle;
  path: string;
  line: number;
}

export interface FileNamingConvention {
  style: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case' | 'SCREAMING_SNAKE' | 'mixed';
  filename: string;
  path: string;
}
