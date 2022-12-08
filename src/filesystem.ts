import gdoc2latex from './lib';
import { checkType } from './helper';

const gdoc2latexFs = (options: { inputFile: string, outputFile: string, forceOverwrite: boolean, templateStartFile: string, templateEndFile: string }) => {
    const fs = require('fs')
    const path = require('path')

    checkType(options, "object", 'options');
    checkType(options.inputFile, "string", 'input file option');
    checkType(options.outputFile, "string", 'output file option');
    checkType(options.forceOverwrite, "boolean", 'force overwrite option');
    checkType(options.templateStartFile, "string", 'template start file option');
    checkType(options.templateEndFile, "string", 'template end file option');

    if (!options.inputFile.endsWith('.html')) {
        throw new Error('Input file should start with .html but is ' + options.inputFile);
    }

    if (!fs.existsSync(options.inputFile)) {
        throw new Error('Input HTML not found at ' + options.inputFile);
    }
    if (!fs.statSync(options.inputFile).isFile()) {
        throw new Error('Input HTML not a file at ' + options.inputFile);
    }

    if (!options.outputFile.endsWith('.tex')) {
        throw new Error('Output file should end with .tex but is ' + options.outputFile);
    }

    if (!fs.existsSync(path.dirname(options.outputFile))) {
        if (options.forceOverwrite) {
            fs.mkdirSync(path.dirname(options.outputFile), { recursive: true });
        } else {
            throw new Error('Output directory not found at ' + path.dirname(options.outputFile) + '. Use -f or --force to create.');
        }
    }
    if (fs.existsSync(options.outputFile) && fs.statSync(options.outputFile).isDirectory()) {
        throw new Error('Output is a directory at ' + options.outputFile + ', expected a file');
    }

    const inputImagesDirPath = path.dirname(options.inputFile) + '/images';
    const outputImagesDirPath = path.dirname(options.outputFile) + '/' + /* path.basename(options.output).slice(0, -4) + '_' + */ 'images';
    const bibtexPath = options.outputFile.slice(0, -4) + '.bib';

    if (fs.existsSync(outputImagesDirPath) && !fs.statSync(outputImagesDirPath).isDirectory()) {
        throw new Error('Images output directory is a file at ' + outputImagesDirPath + ', expected a directory.');
    }

    if (!options.forceOverwrite && fs.existsSync(options.outputFile)) {
        throw new Error('Output file already exists at ' + options.outputFile + '. Use -f or --force to overwrite.');
    }
    if (!options.forceOverwrite && fs.existsSync(bibtexPath)) {
        throw new Error('Output file already exists at ' + bibtexPath + '. Use -f or --force to overwrite.');
    }
    if (inputImagesDirPath !== outputImagesDirPath && !options.forceOverwrite && fs.existsSync(outputImagesDirPath) && fs.readdirSync(outputImagesDirPath).length > 0) {
        throw new Error('Images output directory is not empty at ' + outputImagesDirPath + '. Use -f or --force to overwrite.');
    }

    if (!fs.existsSync(options.templateStartFile)) {
        throw new Error('Start template not found at ' + options.templateStartFile);
    }

    if (!fs.existsSync(options.templateEndFile)) {
        throw new Error('End template not found at ' + options.templateEndFile);
    }

    const html: string = fs.readFileSync(options.inputFile, { encoding: 'utf8' });
    const templateStart: string = fs.readFileSync(options.templateStartFile, { encoding: 'utf8' })
    const templateEnd: string = fs.readFileSync(options.templateEndFile, { encoding: 'utf8' })

    const { latex, bibtex } = gdoc2latex({
        inputHTML: html,
        outputFile: path.basename(options.outputFile),
        templateStart,
        templateEnd
    });

    fs.writeFileSync(options.outputFile, latex, { flag: options.forceOverwrite ? 'w' : 'wx' });
    if (bibtex) fs.writeFileSync(bibtexPath, bibtex, { flag: options.forceOverwrite ? 'w' : 'wx' });

    // Copy images if necessary
    if (inputImagesDirPath != outputImagesDirPath && fs.existsSync(inputImagesDirPath)) {
        const inputImages = fs.readdirSync(inputImagesDirPath);
        if (inputImages.length > 0 && !fs.existsSync(outputImagesDirPath)) {
            fs.mkdirSync(outputImagesDirPath);
        }

        for (let i = 0; i < inputImages.length; i++) {
            fs.copyFileSync(inputImagesDirPath + '/' + inputImages[i], outputImagesDirPath + '/' + path.basename(inputImages[i]), options.forceOverwrite ? undefined : fs.constants.COPYFILE_EXCL);
        }
    }
}

export default gdoc2latexFs;
