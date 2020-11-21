import fs from 'fs'
import gdoc2latex from '../src/index'

// Run an end to end test for a directory
const e2eTest = (directory: string) => {
    // Clean 'actual' directory by deleting it
    if (fs.existsSync(directory + '/actual')) {
        fs.rmdirSync(directory + '/actual', { recursive: true });
    }

    // Run gdoc2latex
    gdoc2latex({
        input: directory + '/input.html',
        output: directory + '/actual/output.tex',
        force: true,
        templateStart: __dirname + '/../default_templates/start.tex',
        templateEnd: __dirname + '/../default_templates/end.tex'
    })

    // Check we've generated the right files
    const generatedFiles = fs.readdirSync(directory + '/actual');
    expect(generatedFiles).toContain('output.tex')
    expect(generatedFiles).toContain('output.bib')
    if (fs.existsSync(directory + '/images')) {
        expect(generatedFiles).toContain('images')
        expect(fs.readdirSync(directory + '/actual/images')).toEqual(fs.readdirSync(directory + '/images'))
    }

    // And that they're what we expect
    expect(file(directory + '/actual/output.tex')).toEqual(file(directory + '/expected/output.tex'))
    expect(file(directory + '/actual/output.bib')).toEqual(file(directory + '/expected/output.bib'))
    
    // Disabled for performance
    // if (fs.existsSync(directory + '/images')) {
    //     const images = fs.readdirSync(directory + '/actual/images');
    //     for (const image of images) {
    //         expect(fs.readFileSync(directory + '/actual/images/' + image)).toEqual(fs.readFileSync(directory + '/images/' + image))
    //     }
    // }
}

// Load a file at a path
const file = (fileName: string): string => fs.readFileSync(fileName, { encoding: 'utf8' })

test('example document', () => {
    e2eTest(__dirname + '/example')
})