import fs from 'fs';
import { read } from './utils';

// Ensures default_templates.ts and default_templates folder kept in sync
test('default_templates match', () => {
    const templateFiles: { [key: string]: string } = {};
    fs.readdirSync(__dirname + '/../default_templates').forEach(file => templateFiles[file.slice(0, file.lastIndexOf('.'))] = read(__dirname + '/../default_templates/' + file));
    const templateConsts: { [key: string]: string } = require('../src/default_templates');

    expect(templateFiles).toEqual(templateConsts);
});
