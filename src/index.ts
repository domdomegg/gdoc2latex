#!/usr/bin/env node

// Download the document as a webpage (File > Download > Web page), and save it as index.html

import fs from 'fs';
import he from 'he';
import { program } from 'commander';
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
}
type AddBibliographyEntryFn = (entry: string) => void;
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
        underlined: getSelector(css, 'text-decoration:underline')
    }
}

const getSelector = (css: string, selector: string): Selectors => 
    css.split(selector).slice(0, -1).map(fragment => {
        const newFragment = fragment.slice(0, fragment.lastIndexOf('{'));
        return newFragment.slice(newFragment.lastIndexOf('}')+1);
    });

const mapToLatex = (tfs: TextFormatSelectors, addBibliographyEntry: AddBibliographyEntryFn, setTitle: SetTitleFn) => (elem: HimalayaNode): string | undefined => {
    if (elem.type == 'text') {
        return transformText(elem.content);
    }

    if (elem.type == 'comment') {
        return undefined;
    }

    if (elem.tagName == 'hr' && elem.attributes[0].key == 'style' && elem.attributes[0].value.includes('page-break-before:always')) {
        return '\\pagebreak';
    }

    if (!elem.children || elem.children.length == 0) {
        return undefined;
    }

    if (elem.tagName == 'div') {
        const content: string | undefined = elem.children.map(mapToLatex(tfs, addBibliographyEntry, setTitle)).filter(notNully).join('\n\n');

        // See footnote content detection elsewhere
        // This is pretty disgusting, pls don't hate me
        if (content && content.startsWith('REFERENCE<')) {
            const key = content.slice('REFERENCE<'.length, content.indexOf('>'));

            // Slice off reference marker, unescape braces, replace key, remove blank lines and trim whitespace
            const bibtexContent = content
                .slice('REFERENCE<>'.length + key.length)
                .replace(/\\{/g, '{')
                .replace(/\\}/g, '}')
                .replace(/@([a-zA-Z]+?)\s*{\s*[^,]+\s*,/, '@$1{' + key + ',')
                .replace(/(^[ \t]*\n)/gm, '')
                .trim();

            addBibliographyEntry(bibtexContent);
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
        return '\\section{' + childrenText + '}';
    }

    if (elem.tagName == 'h2') {
        return '\\subsection{' + childrenText + '}';
    }
    
    if (elem.tagName == 'h3') {
        return '\\subsubsection{' + childrenText + '}';
    }

    if (elem.tagName == 'h4') {
        return '\\subsubsubsection{' + childrenText + '}';
    }

    if (elem.tagName == 'p') {
        return childrenText;
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

    if (!elem.children || elem.children.length == 0) {
        return undefined;
    }

    const childrenText: string | undefined = elem.children.map(mapText(tfs)).filter(notNully).join('') || undefined;
    if (!notNully(childrenText)) {
        return undefined;
    }

    if (elem.tagName == 'a') {
        // In-text footnote reference 
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
            return 'REFERENCE<' + key + '>';
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

        return s;        
    }

    throw new Error('Unsupported tag ' + elem.tagName);
}

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

    const addBibliographyEntry: AddBibliographyEntryFn = (entry) => {
        if (!bibtex) {
            bibtex = entry;
        } else {
            bibtex += '\n\n';
            bibtex += entry;
        }
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

    const latex = elems.map(mapToLatex(textSelectors, addBibliographyEntry, setTitle)).filter(notNully).join('\n\n');

    if (!title) throw new Error('Missing title')
    if (!latex) throw new Error('Missing latex')
    if (!bibtex) throw new Error('Missing bibtex')

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

const main = () => {
    program
        .description("Converts Google Docs files to Latex")
        .option('-i, --input <file>', 'Input HTML file, downloaded from Google Docs', 'index.html')
        .option('-o, --output <file>', 'Output TeX file', 'index.tex')
        .option('-f, --force', 'Force overwrite output TeX file if it already exists', false)
        .option('-s, --template-start <file>', 'Starting template TeX source', 'template_start.tex')
        .option('-e, --template-end <file>', 'Ending template TeX source', 'template_end.tex')
        .parse(process.argv);
    
    if(!fs.existsSync(program.input)) {
        throw new Error('Input HTML not found at path ' + program.input);
    }

    if(!program.output.endsWith('.tex')) {
        throw new Error('Output file should end with .tex but is ' + program.output)
    }

    if(!program.force && fs.existsSync(program.output)) {
        throw new Error('Output already exists at path ' + program.input);
    }

    if(!fs.existsSync(program.templateStart)) {
        throw new Error('Start template not found at path ' + program.input);
    }

    if(!fs.existsSync(program.templateEnd)) {
        throw new Error('End template not found at path ' + program.input);
    }

    const html: string = fs.readFileSync(program.input, { encoding: 'utf8' });
    const parsed: HimalayaElement[] = himalaya.parse(html);
    
    // @ts-ignore
    const css: string = parsed[0].children[0].children[1].children[0].content;
    // @ts-ignore
    const elems: HimalayaElement[] = parsed[0].children[1].children[0].children;

    const { title, subtitle, latex, bibtex } = handleElems(elems, getTextFormatSelectors(css));
    
    fs.writeFileSync(program.output,
        generateLatexTitle({ title, subtitle })
        + fs.readFileSync(program.templateStart, { encoding: 'utf8' })
        + '\n\n\\maketitle\n\n'
        + latex
        + '\n\n\\bibliography{index}\n\n'
        + fs.readFileSync(program.templateEnd, { encoding: 'utf8' })
    );
    fs.writeFileSync(program.output.slice(0, -3) + 'bib', bibtex);
}
main();
