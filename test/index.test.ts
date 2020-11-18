import fs from 'fs'
import gdoc2latex from '../src/index'

test('example document', () => {
    // Clean 'actual' directory by deleting it
    if (fs.existsSync(__dirname + '/actual')) {
        fs.rmdirSync(__dirname + '/actual', { recursive: true });
    }

    // Run gdoc2latex
    gdoc2latex({
        input: __dirname + '/example.html',
        output: __dirname + '/actual/example.tex',
        force: true,
        templateStart: __dirname + '/../default_templates/start.tex',
        templateEnd: __dirname + '/../default_templates/end.tex'
    })

    // Check we've generated the right files
    expect(fs.readdirSync(__dirname + '/actual')).toEqual(['example.bib', 'example.tex'])

    // And that they're what we expect
    expect(file('actual/example.tex')).toEqual(file('expected/example.tex'))
    expect(file('actual/example.bib')).toEqual(file('expected/example.bib'))
})

// Load a file at a path relative to this test's directory
const file = (fileName: string) => fs.readFileSync(__dirname + '/' + fileName, { encoding: 'utf8' })