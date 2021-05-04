import fs from 'fs'
import gdoc2latex, { gdoc2latexFs } from '../src/index'

// Run an end to end test for a directory
const e2eTest = (directory: string) => {
    // Clean 'actual' directory by deleting it
    if (fs.existsSync(directory + '/actual')) {
        fs.rmdirSync(directory + '/actual', { recursive: true });
    }

    // Run gdoc2latex
    gdoc2latexFs({
        inputFile: directory + '/input.html',
        outputFile: directory + '/actual/output.tex',
        forceOverwrite: true,
        templateStartFile: __dirname + '/../default_templates/start.tex',
        templateEndFile: __dirname + '/../default_templates/end.tex'
    });

    // Check we've generated the right files
    const generatedFiles = fs.readdirSync(directory + '/actual');
    expect(generatedFiles).toContain('output.tex')
    if (fs.existsSync(directory + '/actual/output.bib')) {
        expect(generatedFiles).toContain('output.bib')
    } else {
        expect(generatedFiles).not.toContain('output.bib')
    }
    if (fs.existsSync(directory + '/images')) {
        expect(generatedFiles).toContain('images')
        expect(fs.readdirSync(directory + '/actual/images')).toEqual(fs.readdirSync(directory + '/images'))
    }

    // And that they're what we expect
    expect(read(directory + '/actual/output.tex')).toEqual(read(directory + '/expected/output.tex'))
    if (fs.existsSync(directory + '/actual/output.bib')) {
        expect(read(directory + '/actual/output.bib')).toEqual(read(directory + '/expected/output.bib'))
    }
    
    // Disabled for performance
    // if (fs.existsSync(directory + '/images')) {
    //     const images = fs.readdirSync(directory + '/actual/images');
    //     for (const image of images) {
    //         expect(fs.readFileSync(directory + '/actual/images/' + image)).toEqual(fs.readFileSync(directory + '/images/' + image))
    //     }
    // }

    // And check that the non-fs version also returns the correct LaTeX and BibTeX sources
    const { latex, bibtex } = gdoc2latex({
        inputHTML: read(directory + '/input.html'),
        outputFile: directory + '/actual/output.tex',
        templateStart: read(__dirname + '/../default_templates/start.tex'),
        templateEnd: read(__dirname + '/../default_templates/end.tex')
    });
    expect(latex).toEqual(read(directory + '/expected/output.tex'))
    if (bibtex) {
        expect(bibtex).toEqual(read(directory + '/expected/output.bib'))
    }
}

// Read a file at a path
const read = (fileName: string): string => fs.readFileSync(fileName, { encoding: 'utf8' })

test.each(fs.readdirSync(__dirname).filter(f => f != 'e2e.test.ts'))('%s', (folder) => {
    e2eTest(__dirname + '/' + folder)
});