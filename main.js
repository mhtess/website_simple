window.onload = function() {
  // Fetch Markdown content
  fetch('content.md')
    .then(response => {
      console.log('Response status:', response.status);
      if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(mdText => {
      console.log('Fetched Markdown:', mdText.substring(0, 100) + '...'); // Log beginning
      const converter = new showdown.Converter();
      const html = converter.makeHtml(mdText);
      document.getElementById('content').innerHTML = html;
    })
    .catch(err => console.error('Error loading Markdown:', err));

    // Fetch and process the BibTeX file
    fetch('publications.bib')
      .then(response => {
          if (!response.ok) {
             throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
      })
      .then(bibtexText => {
        console.log('Fetched BibTeX (raw):', bibtexText); // Log the raw text

        // --- NEW: Remove potential YAML front matter ---
        let cleanedBibtexText = bibtexText;
        const yamlEndMarker = '\n---\n'; // Common YAML end marker
        const yamlStartIndex = cleanedBibtexText.indexOf('---');
        const yamlEndIndex = cleanedBibtexText.indexOf(yamlEndMarker);

        // Basic check if it looks like YAML front matter (starts with ---, has another --- after)
        if (yamlStartIndex === 0 && yamlEndIndex > 0) {
            cleanedBibtexText = cleanedBibtexText.substring(yamlEndIndex + yamlEndMarker.length);
            console.log('Cleaned BibTeX (after removing YAML):', cleanedBibtexText.substring(0, 200) + '...');
        } else {
             // Alternative approach if no YAML marker: find the first '@' sign
             const firstEntryIndex = cleanedBibtexText.indexOf('@');
             if (firstEntryIndex > 0) { // Make sure it's not the very first character potentially
                 // Check if stuff before the first '@' is just comments or whitespace
                 const prefix = cleanedBibtexText.substring(0, firstEntryIndex).trim();
                 // Simple check: If the prefix contains lines not starting with '%' or empty
                 const prefixLines = prefix.split('\n');
                 let looksLikeHeader = false;
                 for (const line of prefixLines) {
                     if (line.trim().length > 0 && !line.trim().startsWith('%')) {
                         looksLikeHeader = true;
                         break;
                     }
                 }
                 // If it looks like a non-comment header, try removing it
                 if (looksLikeHeader) {
                    console.warn("Found non-comment text before first '@' entry, attempting to strip.");
                    cleanedBibtexText = cleanedBibtexText.substring(firstEntryIndex);
                    console.log('Cleaned BibTeX (after removing potential header):', cleanedBibtexText.substring(0, 200) + '...');
                 } else {
                   console.log("No obvious YAML front matter or header found.");
                 }
             } else if (firstEntryIndex < 0) {
                 console.warn("No '@' symbol found in the BibTeX file.");
                 // Proceed anyway, parser might handle comments only file gracefully or error out
             } else {
                console.log("No obvious YAML front matter or header found.");
             }
        }
        // --- End of YAML removal ---

        // Check if the BibtexParser is available
        if (typeof BibtexParser === 'undefined') {
          console.error("BibtexParser library is not loaded correctly.");
          document.getElementById('publications').innerHTML = `<p class="text-danger">Error: BibTeX parsing library failed to load.</p>`;
          return;
        }

        // Instantiate the parser
        const bibtexParser = new BibtexParser();

        // Set the *cleaned* input and parse
        bibtexParser.setInput(cleanedBibtexText); // Use the cleaned text
        bibtexParser.bibtex(); // This performs the parsing

        // Check for parsing errors (optional but recommended)
        if (bibtexParser.error) {
            console.error("Error parsing BibTeX:", bibtexParser.error);
            console.error("Attempted to parse:", cleanedBibtexText.substring(0, 500) + '...'); // Log text that caused error
            document.getElementById('publications').innerHTML = `<p class="text-danger">Error parsing BibTeX file. Check console for details.</p>`;
            return;
        }

        // Access the parsed entries (an object where keys are citation keys)
        const entries = bibtexParser.entries;
        console.log("Parsed BibTeX Entries:", entries);

        // -------------------------------------------------------------------------
        // Group entries by YEAR, newest first, then render as bulleted lists
        // -------------------------------------------------------------------------
        function formatEntry(e, citeKey) {
          const bibId = `bib-${citeKey}`;   // unique per item

          //-----------------------------------------------------------------------
          // 1. helpers
          //-----------------------------------------------------------------------
          const MY_LASTNAME = 'tessler';       // <— change once if your name changes

          // build “Tolkien, J. R. R.” → (bold) + ★ if it’s you
          // ── Helpers ───────────────────────────────────────────────────────────────
          function nameToInitials(raw) {
            raw = raw.trim();

            // ❶ Joint-authorship marker
            let isJoint = false;
            if (raw.startsWith('*')) {
              isJoint = true;
              raw = raw.slice(1).trim();        // strip the leading asterisk
            }

            // ❷ Split "Last, First" vs "First Last"
            let last, given;
            if (raw.includes(',')) {
              [last, given] = raw.split(',').map(s => s.trim());
            } else {
              const parts = raw.split(/\s+/);
              last  = parts.pop();
              given = parts.join(' ');
            }

            // ❸ Build initials
            const initials = given
              .split(/\s+/).filter(Boolean)
              .map(n => n[0].toUpperCase() + '.')
              .join(' ');

            let formatted = `${last}, ${initials}`;

            // ❹ Bold *your* surname
            if (last.toLowerCase() === 'tessler') {
              formatted = `<strong>${formatted}</strong>`;
            }

            // ❺ Append joint-authorship mark if needed
            if (isJoint) {
              formatted += '<sup>*</sup>';
            }
            return formatted;
          }


          function formatAuthors(str){
            const names=str.split(/\s+and\s+/i).map(nameToInitials);
            return names.length<2 ? names[0] : names.slice(0,-1).join(', ')+' & '+names.slice(-1);
          }

          // turn this entry back into a compact BibTeX block for the [bib] reveal
          function toBibtex(obj) {
            const fieldLines = Object.entries(obj)
              .filter(([k]) => !k.startsWith('_'))  // skip parser metadata if any
              .map(([k,v]) => `  ${k.toLowerCase()} = {${v}},`);
            return `@${obj.ENTRYTYPE || 'article'}{${citeKey},\n${fieldLines.join('\n')}\n}`;
          }

          //-----------------------------------------------------------------------
          // 2. assemble HTML
          //-----------------------------------------------------------------------
          const url   = e.URL || e.url || '';
          const title = (e.TITLE||'').replace(/[{}]/g,'');
          const titleHTML = url
              ? `<a href="${url}" target="_blank" class="title-link">${title}.</a>`
              : `${title}.`;

          const authorsHTML = e.AUTHOR ? ` ${formatAuthors(e.AUTHOR)}.` : '';
          const yearHTML    = e.YEAR   ? ` (${e.YEAR}).`                : '';
          const journalSrc  = e.JOURNAL || e.BOOKTITLE || '';
          const journalHTML = journalSrc ? ` <em>${journalSrc.replace(/[{}]/g,'')}</em>.` : '';
          const doiHTML     = e.DOI ? ` <a href="https://doi.org/${e.DOI}" target="_blank">[doi]</a>` : '';

          // [bib] toggle (3)
          // const bibId   = `bib-${citeKey}`;
          const bibHTML = `<a href="#" class="bib-toggle" data-id="${bibId}">[bib]</a>`
                        + `<pre id="${bibId}" class="bibtex d-none">${toBibtex(e)}</pre>`;

          return `${titleHTML}${authorsHTML}${yearHTML}${journalHTML}${doiHTML} ${bibHTML}`;
        }



        // ---- build the HTML ------------------------------------------------------
        const entriesArr = Object.values(entries);

        // sort newest-first
        entriesArr.sort((a, b) => (b.YEAR || 0) - (a.YEAR || 0));

        // bucket by year
        const byYear = {};
        entriesArr.forEach(e => {
          const y = e.YEAR || 'Other';
          (byYear[y] ||= []).push(e);
        });
        // render
        let htmlOutput = '<h2>Publications</h2>';
        let idx = 0;  // running unique index for IDs
        Object.keys(byYear)
              .sort((a, b) => b - a)                 // newest year first
              .forEach(year => {
                htmlOutput += `<h3 class="pub-year">${year}</h3><ul class="pub-list">`;
                byYear[year].forEach(e => {
                  htmlOutput += `<li>${formatEntry(e, idx)}</li>`;
                  idx += 1;                          // bump index
                });
                htmlOutput += '</ul>';
              });

        document.getElementById('publications').innerHTML = htmlOutput;


      })
      .catch(error => {
          console.error('Error loading or processing BibTeX file:', error);
          document.getElementById('publications').innerHTML = `<p class="text-danger">Failed to load or process publications: ${error.message}</p>`;
      });
  };

  // -------------------------------------------------------------------------
  // Toggle raw BibTeX blocks
  // -------------------------------------------------------------------------
  document.addEventListener('click', ev => {
    const t = ev.target;
    if (t.classList.contains('bib-toggle')) {
      ev.preventDefault();
      document.getElementById(t.dataset.id)?.classList.toggle('d-none');
    }
  });
