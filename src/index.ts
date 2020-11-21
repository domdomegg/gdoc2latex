import fs from 'fs';
import path from 'path';
import querystring from 'querystring';
import he from 'he';
// @ts-ignore
import * as himalaya from 'himalaya';

/**
 * Array of CSS selectors that can select an element
 * @example ['.aclass', '#some_id', 'h3'] 
 */
type Selectors = string[] 
interface TextFormatSelectors {
    bold: Selectors
    italic: Selectors
    underlined: Selectors
    superscript: Selectors
    subscript: Selectors
    center: Selectors
    right: Selectors
}
type AddEntryFn = (entry: string) => void;
type AddKeyEntryFn = (key: string, entry: string) => void;
type SetTitleFn = (type: 'title' | 'subtitle', value: string) => void;

interface HimalayaAttribute {
    key: string
    value: string
}
type HimalayaNode = HimalayaElement | HimalayaText | HimalayaComment;
interface HimalayaElement {
    type: 'element'
    tagName: string
    children: HimalayaNode[]
    attributes: HimalayaAttribute[]
}
interface HimalayaText {
    type: 'text'
    content: string
}
interface HimalayaComment {
    type: 'comment'
    content: string
}

const notNully = (x: any) => !!x;

const getTextFormatSelectors = (css: string): TextFormatSelectors => {
    return {
        bold: getSelector(css, 'font-weight:700'),
        italic: getSelector(css, 'font-style:italic'),
        underlined: getSelector(css, 'text-decoration:underline'),
        superscript: getSelector(css, 'vertical-align:super'),
        subscript: getSelector(css, 'vertical-align:sub'),
        center: getSelector(css, 'text-align:center'),
        right: getSelector(css, 'text-align:right')
    }
}

const getSelector = (css: string, selector: string): Selectors => 
    css.split(selector).slice(0, -1).map(fragment => {
        const newFragment = fragment.slice(0, fragment.lastIndexOf('{'));
        return newFragment.slice(newFragment.lastIndexOf('}')+1);
    });

const mapToLatex = (tfs: TextFormatSelectors, addBibliographyEntry: AddEntryFn, addFootnoteEntry: AddKeyEntryFn, setTitle: SetTitleFn) => (elem: HimalayaNode): string | undefined => {
    if (elem.type == 'text') {
        return transformText(elem.content);
    }

    if (elem.type == 'comment') {
        return undefined;
    }

    const id = elem.attributes.find(attr => attr.key == 'id')

    if (elem.tagName == 'hr' && elem.attributes[0].key == 'style' && elem.attributes[0].value.includes('page-break-before:always')) {
        return '\\pagebreak';
    }

    if (!elem.children || elem.children.length == 0) {
        return undefined;
    }

    if (elem.tagName == 'div') {
        const content: string | undefined = elem.children.map(mapToLatex(tfs, addBibliographyEntry, addFootnoteEntry, setTitle)).filter(notNully).join('\n\n');

        // See footnote content detection elsewhere
        // This is pretty disgusting, pls don't hate me
        if (content && content.startsWith('FOOTNOTE<')) {
            const key = content.slice('FOOTNOTE<'.length, content.indexOf('>'));

            // Slice off footnote marker
            const footnoteContent = content
                .slice('FOOTNOTE<>'.length + key.length)
                .trim();

            // BibTeX citation
            if (footnoteContent.startsWith('@')) {
                // Unescape braces, replace key, remove blank lines and trim whitespace
                const bibtexContent = footnoteContent
                    .replace(/\\{/g, '{')
                    .replace(/\\}/g, '}')
                    .replace(/@([a-zA-Z]+?)\s*{\s*[^,]+\s*,/, '@$1{' + key + ',')
                    .replace(/(^[ \t]*\n)/gm, '')
                    .trim();

                addBibliographyEntry(bibtexContent);
                return undefined;
            }

            // Other footnotes need to be backpatched
            addFootnoteEntry(key, footnoteContent);
            return undefined;
        }

        return content;
    }

    if (elem.tagName == 'ul') {
        return '\\begin{itemize}\n' + elem.children.map(mapText(tfs)).filter(notNully).map(t => '  \\item ' + t).join('\n') + '\n\\end{itemize}';
    }

    if (elem.tagName == 'ol') {
        return '\\begin{enumerate}\n' + elem.children.map(mapText(tfs)).filter(notNully).map(t => '  \\item ' + t).join('\n') + '\n\\end{enumerate}';
    }

    if (elem.tagName == 'table') {
        const rows = (elem.children[0] as HimalayaElement).children as HimalayaElement[];
    
        let latex = '\\begin{center}\\begin{tabular}{ |' + 'l|'.repeat(rows[0].children.length) + ' }\n  \\hline\n';
    
        for (const row of rows) {
            latex += '  ' + row.children.map(mapText(tfs)).join(' & ') + ' \\\\\n  \\hline\n';
        }
    
        latex += '\\end{tabular}\\end{center}';
    
        return latex;
    }

    if (elem.tagName == 'p' && !selectorMatches(elem, ['.title', '.subtitle'])) {
        return mapText(tfs)(elem);
    }

    const childrenText = elem.children.map(mapText(tfs)).filter(notNully).join('') || undefined;
    if (!childrenText) {
        return undefined;
    }

    // Special cases (yucky)
    if (selectorMatches(elem, ['.title'])) {
        setTitle('title', childrenText)
        return undefined;
    }
    if (selectorMatches(elem, ['.subtitle'])) {
        setTitle('subtitle', childrenText)
        return undefined;
    }

    if (elem.tagName == 'h1') {
        if (id) return '\\section{' + childrenText + '}\\label{id:' + id.value + '}';
        return '\\section{' + childrenText + '}'
    }

    if (elem.tagName == 'h2') {
        if (id) return '\\subsection{' + childrenText + '}\\label{id:' + id.value + '}';
        return '\\subsection{' + childrenText + '}'
    }

    if (elem.tagName == 'h3') {
        if (id) return '\\subsubsection{' + childrenText + '}\\label{id:' + id.value + '}';
        return '\\subsubsection{' + childrenText + '}'
    }

    if (elem.tagName == 'h4') {
        if (id) return '\\subsubsubsection{' + childrenText + '}\\label{id:' + id.value + '}';
        return '\\subsubsubsection{' + childrenText + '}'
    }

    throw new Error('Unsupported tag ' + elem.tagName);
}

const mapText = (tfs: TextFormatSelectors) => (elem: HimalayaNode): string | undefined => {
    if (elem.type == 'text') {
        return transformText(elem.content);
    }

    if (elem.type == 'comment') {
        return undefined;
    }

    if (elem.tagName == 'br') {
        return '\\\\~';
    }

    if (elem.tagName == 'img') {
        const src = elem.attributes.find(attr => attr.key == 'src')

        if (!src) {
            throw new Error('img without src attribute')
        }

        let latex = '\\begin{figure}[h!]\n  \\centering\n';

        let lineWidths = '1';
        const style = elem.attributes.find(attr => attr.key == 'style')
        if (style) {
            let widthText = style.value.slice(style.value.indexOf('width:'));
            widthText = widthText.slice(6, widthText.indexOf(';')).trim();
            const widthMatch = widthText.match(/^(\d+\.?\d*)px$/);
            if (widthMatch) {
                lineWidths = (parseFloat(widthMatch[1]) / 588).toFixed(3);
            }
        }

        latex += '  \\includegraphics[width=' + lineWidths + '\\linewidth]{' + src.value + '}\n'
        
        const alt = elem.attributes.find(attr => attr.key == 'alt')
        if (alt?.value) {
            latex += '  \\caption{' + alt.value + '}\n'
        }
        
        const title = elem.attributes.find(attr => attr.key == 'title')
        if (title?.value) {
            latex += '  \\label{figure:' + title.value + '}\n'
        }

        latex += '\\end{figure}';
        return latex;
    }

    if (!elem.children || elem.children.length == 0) {
        return undefined;
    }

    const childrenText: string | undefined = elem.children.map(mapText(tfs)).filter(notNully).join('') || undefined;
    if (!notNully(childrenText)) {
        return undefined;
    }

    if (elem.tagName == 'a') {
        // In-text footnote 
        const id = elem.attributes.find(attr => attr.key == 'id');
        if (id && id.value.startsWith('ftnt_')) {
            const key = id.value.slice('ftnt_'.length);
            return '\\cite{' + key + '}'
        }

        // Footnote content
        const href = elem.attributes.find(attr => attr.key == 'href');
        if (href && href.value.startsWith('#ftnt_')) {
            const key = href.value.slice('#ftnt_'.length);
            // Look it's been a long day... please don't hate me, future me.
            return 'FOOTNOTE<' + key + '>';
        }

        // URL
        if (href) {
            // Within document
            if (href.value.startsWith('#')) {
                return '\\hyperref[id:' + href.value.slice(1) + ']{' + childrenText  + '}'
            }

            // Attempt to remove Google redirects
            if (href.value.startsWith('https://www.google.com/url?')) {
                const q = querystring.parse(href.value.slice(href.value.indexOf('?') + 1), '&amp;').q;
                if (typeof q == "string") {
                    return '\\href{' + transformText(q) + '}{' + childrenText + '}'
                }
            }

            // Other links
            return '\\href{' + transformText(href.value) + '}{' + childrenText + '}'
        }
    }

    if (elem.tagName == 'p' || elem.tagName == 'span' || elem.tagName == 'sup' || elem.tagName == 'sub' || elem.tagName == 'a' || elem.tagName == 'li' || elem.tagName == 'td') {
        let s = childrenText;

        if (selectorMatches(elem, tfs.bold)) {
            s = '\\textbf{' + s + '}';
        }
        if (selectorMatches(elem, tfs.italic)) {
            s = '\\textit{' + s + '}';
        }
        if (selectorMatches(elem, tfs.underlined)) {
            s = '\\underline{' + s + '}';
        }
        if (selectorMatches(elem, tfs.superscript)) {
            s = '\\textsuperscript{' + s + '}';
        }
        if (selectorMatches(elem, tfs.subscript)) {
            s = '\\textsubscript{' + s + '}';
        }
        if (selectorMatches(elem, tfs.center)) {
            s = '{\\centering ' + s + ' \\par}';
        }
        if (selectorMatches(elem, tfs.right)) {
            s = '{\\raggedleft ' + s + ' \\par}';
        }

        return s;        
    }

    throw new Error('Unsupported tag ' + elem.tagName);
}

// Returns whether any of the given selectors match the element
const selectorMatches = (elem: HimalayaElement, selectors: Selectors) => {    
    return selectors.some(s => {
        // Selectors like '.aclass'
        if (s.startsWith('.')) {
            const c = s.slice(1);
            const value = (elem.attributes.find(attr => attr.key == 'class') || { value: '' }).value;
            return value == c || value.startsWith(c + ' ') || value.endsWith(' ' + c) || value.includes(' ' + c + ' ')
        }

        // Selectors like 'h3'
        if (s.charAt(0) >= 'a' && s.charAt(0) <= 'z') {
            return s == elem.tagName;
        }

        throw new Error('Unsupported selector ' + s);
    });
}

const transformText = (text: string): string => he.decode(text)
    .replace(/\u00A0/g, ' ')
    .replace(/\\/g, '\\textbackslash')
    .replace(/~/g, '\\textasciitilde')
    .replace(/\^/g, '\\textasciicircum')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/λ/g, '$\\lambda$');

const handleElems = (elems: HimalayaElement[], textSelectors: TextFormatSelectors): {
    title: string,
    subtitle?: string,
    latex: string,
    bibtex: string
} => {
    // Gross, should actually return these properly
    // This function should shield us higher up so we can refactor later
    let bibtex: string | undefined = undefined;

    const addBibliographyEntry: AddEntryFn = (entry) => {
        if (!bibtex) {
            bibtex = entry;
        } else {
            bibtex += '\n\n';
            bibtex += entry;
        }
    }

    const footnotes: { [refId: string]: string } = {};
    const addFootnoteEntry: AddKeyEntryFn = (refId, footnoteContent) => {
        footnotes[refId] = footnoteContent;
    }

    let title: string | undefined = undefined;
    let subtitle: string | undefined = undefined;
    const setTitle: SetTitleFn = (type, value) => {
        if (type == 'title') {
            if (title) {
                throw new Error('Duplicate titles defined: ' + title + ' ' + value);
            }
            title = value;
        } else if (type == 'subtitle') {
            if (subtitle) {
                throw new Error('Duplicate titles defined: ' + subtitle + ' ' + value);
            }
            subtitle = value;
        } else {
            throw new Error('Invalid title type ' + type)
        }
    }

    let latex = elems.map(mapToLatex(textSelectors, addBibliographyEntry, addFootnoteEntry, setTitle)).filter(notNully).join('\n\n');

    if (!title) throw new Error('Missing title')
    if (!latex) throw new Error('Missing latex')
    if (!bibtex) throw new Error('Missing bibtex')

    for (const refId in footnotes) {
        latex = latex.replace('\\cite{' + refId + '}', '\\footnote{' + footnotes[refId] + '}')
    }

    return {
        title,
        subtitle,
        latex,
        bibtex
    }
}

const generateLatexTitle = ({ title, subtitle }: { title: string, subtitle?: string }) => {
    if (!subtitle) {
        return '\\title{\\textbf{' + title + '}}';
    }

    return '\\title{%\n  \\textbf{' + title + '}\n  \\linebreak \\linebreak\n  \\large{' + subtitle + '}\n}'
}

const gdoc2latex = (options: { input: string, output: string, force: boolean, templateStart: string, templateEnd: string }) => {
    if(!options.input.endsWith('.html')) {
        throw new Error('Input file should start with .html but is ' + options.input)
    }

    if (!fs.existsSync(options.input)) {
        throw new Error('Input HTML not found at ' + options.input);
    }
    if (!fs.statSync(options.input).isFile()) {
        throw new Error('Input HTML not a file at ' + options.input);
    }

    if(!options.output.endsWith('.tex')) {
        throw new Error('Output file should end with .tex but is ' + options.output)
    }

    if (!fs.existsSync(path.dirname(options.output))) {
        if (options.force) {
            fs.mkdirSync(path.dirname(options.output), { recursive: true })
        } else {
            throw new Error('Output directory not found at ' + path.dirname(options.output) + '. Use -f or --force to create.');
        }
    }
    if (fs.existsSync(options.output) && fs.statSync(options.output).isDirectory()) {
        throw new Error('Output is a directory at ' + options.output + ', expected a file');
    }

    const imagesDirPath = path.dirname(options.output) + '/' + /* path.basename(options.output).slice(0, -4) + '_' + */ 'images';
    const bibtexPath = options.output.slice(0, -4) + '.bib';

    if(fs.existsSync(imagesDirPath) && !fs.statSync(imagesDirPath).isDirectory()) {
        throw new Error('Images output directory is a file at ' + imagesDirPath + ', expected a directory.');
    }

    if(!options.force && fs.existsSync(options.output)) {
        throw new Error('Output file already exists at ' + options.output + '. Use -f or --force to overwrite.');
    }
    if(!options.force && fs.existsSync(bibtexPath)) {
        throw new Error('Output file already exists at ' + bibtexPath + '. Use -f or --force to overwrite.');
    }
    if(!options.force && fs.existsSync(imagesDirPath) && fs.readdirSync(imagesDirPath).length > 0) {
        throw new Error('Images output directory is not empty at ' + imagesDirPath + '. Use -f or --force to overwrite.');
    }

    if (!fs.existsSync(options.templateStart)) {
        throw new Error('Start template not found at ' + options.templateStart);
    }

    if(!fs.existsSync(options.templateEnd)) {
        throw new Error('End template not found at ' + options.templateEnd);
    }

    const html: string = fs.readFileSync(options.input, { encoding: 'utf8' });
    const parsed: HimalayaElement[] = himalaya.parse(html);
    
    // @ts-ignore
    const css: string = parsed[0].children[0].children[1].children[0].content;
    // @ts-ignore
    const elems: HimalayaElement[] = parsed[0].children[1].children[0].children;

    const { title, subtitle, latex, bibtex } = handleElems(elems, getTextFormatSelectors(css));
    
    const combinedLatex = 
        generateLatexTitle({ title, subtitle })
        + fs.readFileSync(options.templateStart, { encoding: 'utf8' })
        + '\n\n\\maketitle\n\n'
        + latex
        + '\n\n\\bibliography{' + path.basename(options.output).slice(0, -4) + '}\n\n'
        + fs.readFileSync(options.templateEnd, { encoding: 'utf8' });

    fs.writeFileSync(options.output, combinedLatex, { flag: options.force ? 'w' : 'wx' });
    fs.writeFileSync(bibtexPath, bibtex, { flag: options.force ? 'w' : 'wx' });

    // Copy images if necessary
    const inputImagesDirPath = path.dirname(options.input) + '/images';
    if (inputImagesDirPath != imagesDirPath && fs.existsSync(inputImagesDirPath)) {
        const inputImages = fs.readdirSync(inputImagesDirPath);
        if (inputImages.length > 0 && !fs.existsSync(imagesDirPath)) {
            fs.mkdirSync(imagesDirPath);
        }

        for (let i = 0; i < inputImages.length; i++) {
            fs.copyFileSync(inputImagesDirPath + '/' + inputImages[i], imagesDirPath + '/' + path.basename(inputImages[i]), options.force ? undefined : fs.constants.COPYFILE_EXCL);
        }
    }
}

export default gdoc2latex;
