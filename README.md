# gdoc2latex

Converts Google Docs files to LaTeX

Install from NPM with `npm install --global gdoc2latex`

## Usage

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

## Output

gdoc2latex will output two files: a `.tex` and `.bib`

Assuming `index.tex` and `index.bib`, compile with:

```
pdflatex index
bibtex index
pdflatex index
pdflatex index
```

This will result in a complete `index.pdf`

## Supported features

Text styles:

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
- Tables: Creates centered table with borders
- Unordered lists: Creates `itemize`
- Ordered lists: Creates `enumerate`
- References (use BibTeX footnotes): Creates `index.bib` and `\cite`s it
- Comments: Added at bottom of Latex document, indexed alphabetically
- Pagebreaks: Inserts `\pagebreak`

Not supported:

- Images
- URLs
- Table styling
- Emoji
- All mathematical latex escape symbols
- Footnotes (except for references)
- Monospace font
- Different font sizes (except for headers)

(these aren't necessarily out of scope, but just haven't been implemented yet and I want to be clear about what this package can do)

## Installing manually

1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Run `npm install -g`