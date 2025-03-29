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

        // --- Generate HTML from the parsed entries ---
        let htmlOutput = '<h2>Publications</h2>';
        const entryKeys = Object.keys(entries); // Get keys to check if empty

        if (entryKeys.length === 0) {
            htmlOutput += '<p>No publications found.</p>';
            console.warn("Parsing finished, but no BibTeX entries were extracted.");
        } else {
            htmlOutput += '<ul class="list-group">'; // Use Bootstrap list group for styling

            // Iterate over the entries object
            for (const key of entryKeys) { // Iterate using the keys
              const entry = entries[key];
              htmlOutput += `<li class="list-group-item">`;
              // Basic formatting example - adapt as needed!
              // htmlOutput += `<strong>${key}</strong>: `; // Optionally display the citation key

              if (entry.AUTHOR) {
                htmlOutput += `${entry.AUTHOR}. `;
              }
              if (entry.TITLE) {
                const title = entry.TITLE.replace(/[\{\}]/g, ''); // Remove extra curly braces
                htmlOutput += `<em>${title}</em>. `;
              }
              if (entry.JOURNAL) {
                htmlOutput += `${entry.JOURNAL}, `;
              }
               if (entry.BOOKTITLE) {
                   const booktitle = entry.BOOKTITLE.replace(/[\{\}]/g, ''); // Remove extra curly braces
                   htmlOutput += `In <em>${booktitle}</em>, `;
              }
              if (entry.YEAR) {
                htmlOutput += `${entry.YEAR}. `;
              }
              // Add more fields as needed (e.g., URL, DOI)
               if (entry.URL) {
                   htmlOutput += ` <a href="${entry.URL}" target="_blank">[Link]</a>`;
               }
               if (entry.DOI) {
                   htmlOutput += ` <a href="https://doi.org/${entry.DOI}" target="_blank">[DOI]</a>`;
               }
              // Add other fields like pages, volume, publisher etc.
              htmlOutput += `</li>`;
            }
            htmlOutput += '</ul>';
        }

        // Set the generated HTML to the publications div
        document.getElementById('publications').innerHTML = htmlOutput;

      })
      .catch(error => {
          console.error('Error loading or processing BibTeX file:', error);
          document.getElementById('publications').innerHTML = `<p class="text-danger">Failed to load or process publications: ${error.message}</p>`;
      });
  };
