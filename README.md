# gdoc2latex

Converts Google Docs files to Latex

Install from NPM with `npm install -g gdoc2latex`

## Usage

See help with `gdoc2latex -h`:

```
$ gdoc2latex -h
Usage: gdoc2latex [options]

Converts Google Docs files to Latex

Options:
  -i, --input <file>           Input HTML file, downloaded from Google Docs (default: "index.html")
  -s, --template-start <file>  Starting template TeX source (default: "template_start.tex")
  -e, --template-end <file>    Ending template TeX source (default: "template_end.tex")
  -h, --help                   display help for command
```

For example, to specify all arguments use:

```
gdoc2latex --input doc.html --template-start start.tex --template.end end.tex
```

The input HTML file should be downloaded from Google Docs with `File > Download > Web page (.html)`

The template start should set up and open a Latex document

The template end should close a Latex document

See the `sample_templates` folder for examples

The resulting files will be created as `index.tex` and `index.bib`

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
- Tables: Creates centered table with borders
- Unordered lists: Creates `itemize`
- Ordered lists: Creates `enumerate`
- References (use BibTeX footnotes): Creates `index.bib` and `\cite`s it
- Comments: Added at bottom of Latex document, indexed alphabetically
- Pagebreaks: Inserts `\pagebreak`

Not supported:

- Images
- Superscript
- Subscript
- URLs
- Table styling
- Emoji
- All mathematical latex escape symbols
- Footnotes (except for references)

(these aren't necessarily out of scope, but just haven't been implemented yet and I want to be clear about what this package can do)

## Installing manually

1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Run `npm install -g`