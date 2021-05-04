#!/usr/bin/env node

import { gdoc2latexFs } from './index';
import { program } from 'commander';

const cli = (args: string[]) => {
    program
        .description("Converts Google Docs files to LaTeX")
        .option('-i, --input <file>', 'Input HTML file, downloaded from Google Docs', 'index.html')
        .option('-o, --output <file>', 'Output TeX file', 'index.tex')
        .option('-f, --force', 'Overwrite output TeX file if it already exists and create output directory if necessary', false)
        .option('-s, --template-start <file>', 'Custom starting template TeX source')
        .option('-e, --template-end <file>', 'Custom ending template TeX source')
        .parse(args);

    const startTemplateLocation = program.templateStart ? program.templateStart : __dirname + '/../default_templates/start.tex'
    const endTemplateLocation = program.templateEnd ? program.templateEnd : __dirname + '/../default_templates/end.tex'
    
    gdoc2latexFs({ inputFile: program.input, outputFile: program.output, forceOverwrite: program.force, templateStartFile: startTemplateLocation, templateEndFile: endTemplateLocation })
}

try {
    cli(process.argv);
} catch (e) {
    // A bold red 'Error: '
    const errorPrefix = '\x1b[1;31mError:\x1b[0m ';

    const helpHint = '\x1b[1mHint:\x1b[0m View help with --help'

    if (e instanceof Error) {
        console.error(errorPrefix + e.message);
        console.error(helpHint);
        process.exit(1);
    } else {
        console.error(errorPrefix + e);
        console.error(helpHint);
        process.exit(2);
    }
}

export default cli;