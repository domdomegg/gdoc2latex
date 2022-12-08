import he from 'he';
// @ts-ignore
import * as himalaya from 'himalaya';
import { end, start } from './default_templates';
import { checkType } from './helper';

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
const nullyToEmptyString = (x: any) => notNully(x) ? x : "";

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
        return newFragment.slice(newFragment.lastIndexOf('}') + 1);
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
        const content: string | undefined = elem.children.map(mapToLatex(tfs, addBibliographyEntry, addFootnoteEntry, setTitle)).map(nullyToEmptyString).join('\n\n');

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

        let latex = '\\begin{adjustbox}{center}\\begin{tabular}{ |' + 'l|'.repeat(rows[0].children.length) + ' }\n  \\hline\n';

        for (const row of rows) {
            latex += '  ' + row.children.map(mapText(tfs)).join(' & ') + ' \\\\\n  \\hline\n';
        }

        latex += '\\end{tabular}\\end{adjustbox}\\\\';

        return latex;
    }

    if (elem.tagName == 'p' && !selectorMatches(elem, ['.title', '.subtitle'])) {
        return mapText(tfs)(elem);
    }

    const childrenText = elem.children.map(mapText(tfs)).map(nullyToEmptyString).join('') || undefined;
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

    throw new Error('Unsupported tag ' + elem.tagName + ' with content:\n\t' + childrenText);
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
                // TODO: fetch the document width from the body's max-width
                lineWidths = Math.min((parseFloat(widthMatch[1]) / 600), 1).toFixed(3);
            }
        }

        latex += '  \\includegraphics[width=' + lineWidths + '\\linewidth]{' + src.value + '}\n'

        const alt = elem.attributes.find(attr => attr.key == 'alt')
        if (alt?.value) {
            latex += '  \\caption{' + transformText(alt.value) + '}\n'
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

    const childrenText: string | undefined = elem.children.map(mapText(tfs)).filter(nullyToEmptyString).join('') || undefined;
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
                return '\\hyperref[id:' + href.value.slice(1) + ']{' + childrenText + '}'
            }

            // Attempt to remove Google redirects
            if (href.value.startsWith('https://www.google.com/url?')) {
                const params = new URLSearchParams(new URL(href.value).search);
                const q = params.get('q');
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

/**
 * Tidies up latex citations by:
 * - joining multiple citations: `\cite{ref1}\cite{ref2}` -> `\cite{ref1,ref2}`
 * - replacing parentheses around a citation with parencite: `(\cite{ref1})` -> `\parencite{ref1}`
 * - replacing space before citation with non-breaking space: ` \cite{ref1}` -> `~\cite{ref1}` (and parencite)
 * @param latex LaTeX source to tidy up
 */
const citeTidier = (latex: string): string => {
    // TODO: we can get away with more string splitting and slicing here, will be much more performant than all these regexes

    // Join multiple citations
    const multiCitationRegex = /(\\cite{([^}]*)}){2,}/g
    latex = latex.replace(multiCitationRegex, (v) => {
        const citationRegex = /\\cite{([^}]*)}/g
        const refs = []
        let match = citationRegex.exec(v);
        while (match) {
            refs.push(match[1]);
            match = citationRegex.exec(v);
        }
        return '\\cite{' + refs.join(',') + '}';
    })

    // Replace parenthesis around a citation with parencite
    const parenthesisCitation = /\(\\cite{([^}]*)}\)/g
    const parenthesisCitationSingle = /\(\\cite{([^}]*)}\)/
    latex = latex.replace(parenthesisCitation, (v) => '\\citep{' + (v.match(parenthesisCitationSingle) as RegExpMatchArray)[1] + '}');

    // Replace space before citations
    const spaceCitation = / \\(paren)?cite{[^}]*}/g
    latex = latex.replace(spaceCitation, (v) => '~' + v.slice(1))

    return latex;
}

const blockSnippeter = (latex: string): string => latex
    .split('\\blocksnippet{')
    .map((s, i) => {
        if (i % 2 == 0) return s;
        const explictLang = s.match(/^[A-Za-z]*/)![0];
        return '\\begin{minted}[breaklines' + (explictLang == "math" ? ',escapeinside=||,mathescape=true' : '') + ']{' + (explictLang && explictLang != "math" ? explictLang : 'text') + '}'
            + s.slice(explictLang.length + 1)
            + '\\end{minted'; // nb: the split means we'll have a `}` after with correct usage
    })
    .join('');

const transformText = (text: string): string => he.decode(text)
    .replace(/\u00A0/g, ' ')
    .replace(/\\\\/g, '\\textbackslash ')
    .replace(/~/g, '\\textasciitilde ')
    .replace(/\^/g, '\\textasciicircum ')
    .replace(/&#39;/g, '\'')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/α/g, '$\\alpha$')
    .replace(/β/g, '$\\beta$')
    .replace(/γ/g, '$\\gamma$')
    .replace(/δ/g, '$\\delta$')
    .replace(/ε/g, '$\\epsilon$')
    .replace(/ζ/g, '$\\zeta$')
    .replace(/η/g, '$\\eta$')
    .replace(/θ/g, '$\\theta$')
    .replace(/ι/g, '$\\iota$')
    .replace(/κ/g, '$\\kappa$')
    .replace(/λ/g, '$\\lambda$')
    .replace(/μ/g, '$\\mu$')
    .replace(/ν/g, '$\\nu$')
    .replace(/ξ/g, '$\\xi$')
    .replace(/ο/g, '$\\o$')
    .replace(/π/g, '$\\pi$')
    .replace(/ρ/g, '$\\rho$')
    .replace(/σ/g, '$\\sigma$')
    .replace(/ς/g, '$\\varsigma$')
    .replace(/τ/g, '$\\tau$')
    .replace(/υ/g, '$\\upsilon$')
    .replace(/φ/g, '$\\phi$')
    .replace(/χ/g, '$\\chi$')
    .replace(/ψ/g, '$\\psi$')
    .replace(/ω/g, '$\\omega$')
    .replace(/⌊/g, '$\\lfloor$')
    .replace(/⌋/g, '$\\rfloor$')
    .replace(/⌈/g, '$\\lceil$')
    .replace(/⌉/g, '$\\rceil$')
    .replace(/∀/g, '$\\forall$')
    .replace(/∃/g, '$\\exists$')
    .replace(/∞/g, '$\\infty$')
    .replace(/∅/g, '$\\varnothing$')
    .replace(/∩/g, '$\\cap$')
    .replace(/∪/g, '$\\cup$')
    .replace(/⊂/g, '$\\subset$')
    .replace(/⊆/g, '$\\subseteq$')
    .replace(/⊃/g, '$\\supset$')
    .replace(/⊇/g, '$\\supseteq$')
    .replace(/⊥/g, '$\\bot$')
    .replace(/⊤/g, '$\\top$')
    .replace(/```([a-zA-Z]*)/g, '\\blocksnippet{$1}')
    .split(/`/g).map((s, i) => i % 2 == 0 ? s : '\\mintinline{text}{|' + s + '|}').join('')
    ;

const handleElems = (elems: HimalayaElement[], textSelectors: TextFormatSelectors): {
    title?: string,
    subtitle?: string,
    latex: string,
    bibtex?: string
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

    let latex = elems.map(mapToLatex(textSelectors, addBibliographyEntry, addFootnoteEntry, setTitle)).map(nullyToEmptyString).join('\n');

    if (!latex) throw new Error('Missing latex')

    for (const refId in footnotes) {
        latex = latex.replace('\\cite{' + refId + '}', '\\footnote{' + footnotes[refId] + '}')
    }

    latex = citeTidier(latex);
    latex = blockSnippeter(latex);

    return {
        title,
        subtitle,
        latex,
        bibtex
    }
}

const generateLatexTitle = ({ title, subtitle }: { title?: string, subtitle?: string }): string => {
    if (title && subtitle) {
        return '\\title{%\n  \\Huge{' + title + '}\n  \\\\\n  \\Large{' + subtitle + '}\n}';
    }

    if (title && !subtitle) {
        return '\\title{\\textbf{' + title + '}}';
    }

    if (!title && subtitle) {
        return '\\title{\\textbf{' + subtitle + '}}';
    }

    return '\\title{\\textbf{Document Title}}';
}

const gdoc2latex = (options: { inputHTML: string, outputFile?: string, templateStart?: string, templateEnd?: string }): { latex: string, bibtex?: string } => {
    if (!options.templateStart) {
        options.templateStart = start;
    }
    if (!options.templateEnd) {
        options.templateEnd = end;
    }
    if (!options.outputFile) {
        options.outputFile = "index.tex";
    }
    checkType(options, "object", 'options');
    checkType(options.inputHTML, "string", 'input HTML option');
    checkType(options.outputFile, "string", 'output file option');
    checkType(options.templateStart, "string", 'template start option');
    checkType(options.templateEnd, "string", 'template end option');

    const parsed: HimalayaElement[] = himalaya.parse(options.inputHTML.trim());

    // @ts-ignore
    const css: string = parsed[0].children[0].children[1].children[0].content;
    // @ts-ignore
    const elems: HimalayaElement[] = parsed[0].children[1].children;

    const { title, subtitle, latex, bibtex } = handleElems(elems, getTextFormatSelectors(css));

    const combinedLatex =
        generateLatexTitle({ title, subtitle }) + '\n'
        + options.templateStart
        + '\n' + latex
        + '\n\n\\bibliography{' + options.outputFile.slice(0, -4) + '}\n\n'
        + options.templateEnd;

    return {
        latex: combinedLatex,
        bibtex
    }
}

export default gdoc2latex;
