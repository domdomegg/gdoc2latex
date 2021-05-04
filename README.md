# gdoc2latex

Converts Google Docs files to LaTeX. Try it in your browser with the [gdoc2latex GUI](https://domdomegg.github.io/gdoc2latex-gui/).

## Install

1. Install [Node.js](https://nodejs.org/en/)
2. Install gdoc2latex with `npm i -g gdoc2latex`

## Use

1. Download your Google Doc with `File > Download > Web page (.html)`
2. Unzip the document, and run `gdoc2latex -i YourDocumentName.html`
3. Compile the generated LaTeX and BibTeX sources
4. ???
5. Profit!


## Supported features

Supported:

- Title: Sets the title (maximum 1)
- Subtitle: Sets the subtitle (maximum 1)
- Heading 1: Creates a `\section`
- Heading 2: Creates a `\subsection`
- Heading 3: Creates a `\subsubsection`
- Heading 4: Creates a `\subsubsubsection`
- Bold: Wraps in `\textbf`
- Underline: Wraps in `\underline`
- Italics: Wraps in `\textif`
- Superscript: Wraps in `\textsuperscript`
- Subscript: Wraps in `\textsubscript`
- Center algined text: Wraps in `\centering`
- Right algined text: Wraps in `\raggedleft`
- Tables: Creates centered table with borders
- Unordered lists: Creates `itemize`
- Ordered lists: Creates `enumerate`
- References (use BibTeX in footnotes): Creates `index.bib` and `\cite`s it
- Footnotes: Inserts `\footnote`
- Comments: Added at bottom of Latex document, indexed alphabetically
- Line breaks: Inserts `\\`
- Page breaks: Inserts `\pagebreak`
- Web and email links: Inserts `\href`
- Internal links to sections: Inserts `\hyperref`
- Images: Inserts figure
- Image captions (use alt text): Inserts `\caption`
- Charts (linked and unlinked): Inserts figure
- Chart captions (use alt text): Inserts `\caption`
- Drawings (linked and unlinked): Inserts figure
- Drawing captions (use alt text): Inserts `\caption`
- Custom image, chart and drawing widths
- Code \`inline\` and in blocks (\`\`\`)

Not supported:

- Custom fonts
- Headers and footers
- Custom table widths
- Custom table, image, chart and drawing alignment
- Custom font sizing

(these aren't necessarily out of scope, but just haven't been implemented yet)

## Detailed usage

See help with `gdoc2latex --help`:

```
$ gdoc2latex --help
Usage: gdoc2latex [options]

Converts Google Docs files to LaTeX

Options:
  -i, --input <file>           Input HTML file, downloaded from Google Docs (default: "index.html")
  -o, --output <file>          Output TeX file (default: "index.tex")
  -f, --force                  Overwrite output TeX file if it already exists and create output directory if necessary (default: false)
  -s, --template-start <file>  Custom starting template TeX source
  -e, --template-end <file>    Custom ending template TeX source
  -h, --help                   display help for command
```

For example:

```
gdoc2latex --input doc.html --output doc.tex --force --template-start mystart.tex --template-end myend.tex
```

The input HTML file should be downloaded from Google Docs with `File > Download > Web page (.html)`

The template start should set up and open a LaTeX document and the end should close a LaTeX document. See the `default_templates` folder for examples.

### Output

gdoc2latex will output two files: a `.tex` and `.bib`

With pdflatex and bibtex, `index.tex` and `index.bib` can be compiled with:

```
pdflatex -shell-escape index
bibtex index
pdflatex -shell-escape index
pdflatex -shell-escape index
```

This will result in a complete `index.pdf`

### Installing manually

1. Install [Node.js](https://nodejs.org/en/)
2. Clone this repository
3. Run `npm install`
4. Run `npm run build`
5. Run `npm install -g`

### Releases

Versions follow the [semantic versioning spec](https://semver.org/). Use `npm version <major | minor | patch>` to bump the version, then push. Ensure you have set follow tags option to true with `git config --global push.followTags true`. GitHub actions will then pick it up and handle the actual publishing to the NPM registry.
