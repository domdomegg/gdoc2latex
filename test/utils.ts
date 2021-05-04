import { readFileSync } from 'fs';

// Read a file at a path
export const read = (fileName: string): string => readFileSync(fileName, { encoding: 'utf8' })
