# Installation instructions (or at least what I did on Ubuntu 20.04):
#   sudo apt install texlive-latex-extra
#   sudo apt install texlive-bibtex-extra

# Clean old stuff
rm -f index.aux index.bbl index.blg index.dvi index.log index.pdf index.toc index.out

# This is done as one chained command so if an early step fails the entire thing fails
# You may question why we run latex three times? Nobody knows.
# Serious answer: https://tex.stackexchange.com/a/53236
pdflatex -interaction=nonstopmode index \
&& bibtex index \
&& pdflatex -interaction=nonstopmode index \
&& pdflatex -interaction=nonstopmode index