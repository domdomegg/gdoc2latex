// Download the document as a webpage (File > Download > Web page), and save it as index.html

const fs = require('fs');
const himalaya = require('himalaya');
const he = require('he');

const notNully = x => !!x;


const getTextSelectors = (css) => {
    return {
        bold: getSelectorsWith(css, 'font-weight:700'),
        italic: getSelectorsWith(css, 'font-style:italic'),
        underlined: getSelectorsWith(css, 'text-decoration:underline')
    }
}

const getSelectorsWith = (css, selector) => 
    css.split(selector).slice(0, -1).map(fragment => {
        const newFragment = fragment.slice(0, fragment.lastIndexOf('{'));
        return newFragment.slice(newFragment.lastIndexOf('}')+1);
    });

const mapToLatex = (textSelectors, addBibliographyEntry, setTitle) => (elem) => {
    if (elem.type == 'text') {
        return transformText(elem.content);
    }

    if (elem.tagName == 'hr' && elem.attributes[0].key == 'style' && elem.attributes[0].value.includes('page-break-before:always')) {
        return '\\pagebreak';
    }

    if (!elem.children || elem.children.length == 0) {
        return undefined;
    }

    if (elem.tagName == 'div') {
        /** @type {string|undefined} */
        const content = elem.children.map(mapToLatex(textSelectors, addBibliographyEntry, setTitle)).filter(notNully).join('\n\n');

        // See footnote content detection elsewhere
        // This is pretty disgusting, pls don't hate me
        if (content && content.startsWith('REFERENCE<')) {
            const key = content.slice('REFERENCE<'.length, content.indexOf('>'));

            // Slice off reference marker, unescape braces, replace key, remove blank lines and trim whitespace
            const bibtexContent = content
                .slice('REFERENCE<>'.length + key.length)
                .replace(/\\{/g, '{')
                .replace(/\\}/g, '}')
                .replace(/@([a-zA-Z]+?)\s*{\s*[a-zA-Z0-9]+\s*,/, '@$1{' + key + ',')
                .replace(/(^[ \t]*\n)/gm, '')
                .trim();

            addBibliographyEntry(bibtexContent);
            return undefined;
        }

        return content;
    }

    if (elem.tagName == 'ul') {
        return '\\begin{itemize}\n' + elem.children.map(mapText(textSelectors)).filter(notNully).map(t => '  \\item ' + t).join('\n') + '\n\\end{itemize}';
    }

    if (elem.tagName == 'ol') {
        return '\\begin{enumerate}\n' + elem.children.map(mapText(textSelectors)).filter(notNully).map(t => '  \\item ' + t).join('\n') + '\n\\end{enumerate}';
    }

    if (elem.tagName == 'table') {
        const rows = elem.children[0].children;
    
        let latex = '\\begin{center}\\begin{tabular}{ |' + 'l|'.repeat(rows[0].children.length) + ' }\n  \\hline\n';
    
        for (const row of rows) {
            latex += '  ' + row.children.map(mapText(textSelectors)).join(' & ') + ' \\\\\n  \\hline\n';
        }
    
        latex += '\\end{tabular}\\end{center}';
    
        return latex;
    }

    const childrenText = elem.children.map(mapText(textSelectors)).filter(notNully).join('') || undefined;
    if (!notNully(childrenText)) {
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

const mapText = (textSelectors) => (elem) => {
    if (elem.type == 'text') {
        return transformText(elem.content);
    }

    if (!elem.children || elem.children.length == 0) {
        return undefined;
    }

    const childrenText = elem.children.map(mapText(textSelectors)).filter(notNully).join('') || undefined;
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

    if (elem.tagName == 'p' || elem.tagName == 'span' || elem.tagName == 'sup' || elem.tagName == 'sub' || elem.tagName == 'a' || elem.tagName == 'li' | elem.tagName == 'td') {
        let s = childrenText;

        if (selectorMatches(elem, textSelectors.bold)) {
            s = '\\textbf{' + s + '}';
        }
        if (selectorMatches(elem, textSelectors.italic)) {
            s = '\\textit{' + s + '}';
        }
        if (selectorMatches(elem, textSelectors.underlined)) {
            s = '\\underline{' + s + '}';
        }

        return s;        
    }

    throw new Error('Unsupported tag ' + elem.tagName);
}

const selectorMatches = (elem, selectors) => {    
    return selectors.some(s => {
        if (s.startsWith('.')) {
            const c = s.slice(1);
            const value = (elem.attributes.find(attr => attr.key == 'class') || { value: '' }).value;
            return value == c || value.startsWith(c + ' ') || value.endsWith(' ' + c) || value.includes(' ' + c + ' ')
        }

        if (s.charAt(0) >= 'a' && s.charAt(0) <= 'z') {
            return s == elem.tagName;
        }

        throw new Error('Unsupported selector ' + s);
    });
}

const transformText = (text) => he.decode(text)
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

const handleElems = (elems, textSelectors) => {
    // Gross, should actually return these properly
    // This function should shield us higher up so we can refactor later
    let bibtex = undefined;

    const addBibliographyEntry = (entry) => {
        if (!bibtex) {
            bibtex = entry;
        } else {
            bibtex += '\n\n';
            bibtex += entry;
        }
    }

    let title = undefined;
    let subtitle = undefined;
    const setTitle = (type, value) => {
        if (type == 'title') {
            if (title) {
                throw new Error('Duplicate titles defined', title, value);
            }
            title = value;
        } else if (type == 'subtitle') {
            if (subtitle) {
                throw new Error('Duplicate subtitles defined', subtitle, value);
            }
            subtitle = value;
        } else {
            throw new Error('Invalid title type', type)
        }
    }

    const latex = elems.map(mapToLatex(textSelectors, addBibliographyEntry, setTitle)).filter(notNully).join('\n\n');

    return {
        title,
        subtitle,
        latex,
        bibtex
    }
}

const generateLatexTitle = ({ title, subtitle }) => {
    if (!title) {
        throw new Error('Missing title')
    }

    if (!subtitle) {
        return '\\title{\\textbf{' + title + '}}';
    }

    return '\\title{%\n  \\textbf{' + title + '}\n  \\linebreak \\linebreak\n  \\large{' + subtitle + '}\n}'
}

const main = () => {
    const html = fs.readFileSync('index.html', { encoding: 'utf8' });
    const parsed = himalaya.parse(html);
    
    const css = parsed[0].children[0].children[1].children[0].content;
    // TODO: a better name to describe this
    const textSelectors = getTextSelectors(css);
    const elems = parsed[0].children[1].children[0].children

    const { title, subtitle, latex, bibtex } = handleElems(elems, textSelectors);
    
    fs.writeFileSync('index.tex',
        generateLatexTitle({ title, subtitle })
        + fs.readFileSync('template_start.tex', { encoding: 'utf8' })
        + '\\maketitle\n\n'
        + latex
        + fs.readFileSync('template_end.tex', { encoding: 'utf8' })
    );
    fs.writeFileSync('index.bib', bibtex);
}
main();