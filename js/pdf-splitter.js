// pdf-splitter.js
// Gestisce il parsing e il taglio dei PDF multi-pagina (Buste Paga)

/**
 * Estrae il testo da tutte le pagine del PDF fornito
 */
export async function parseMultiPayslipPDF(file, workersList) {
    if (typeof pdfjsLib !== 'undefined' && (!pdfjsLib.GlobalWorkerOptions.workerSrc)) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // Leggi il file come ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Carica il documento con PDF.js
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const numPages = pdf.numPages;
    const assignments = [];

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map(item => item.str).join(' ');
        
        // Cerca di abbinare il testo a un lavoratore
        const workerId = matchWorkerFromText(textItems, workersList);
        
        assignments.push({
            pageIndex: i - 1, // pdf-lib usa indici a base 0
            pageNumber: i,
            workerId: workerId,
            extractedTextSnippet: textItems.substring(0, 100) + "..." // Per debug o preview
        });
    }

    return {
        originalArrayBuffer: arrayBuffer,
        assignments: assignments
    };
}

/**
 * Cerca il nome e cognome di un lavoratore all'interno del testo estratto.
 * Funziona con un approccio basato su parole chiave.
 */
function matchWorkerFromText(text, workersList) {
    const upperText = text.toUpperCase();
    
    for (const worker of workersList) {
        // Usa matricola se presente (molto affidabile)
        if (worker.matricola && upperText.includes(worker.matricola.toUpperCase())) {
            return worker.id;
        }

        // Dividi nome e cognome
        const parts = worker.name.toUpperCase().split(' ');
        if (parts.length >= 2) {
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ');
            
            // Cerca "Nome Cognome" oppure "Cognome Nome"
            const format1 = `${firstName} ${lastName}`;
            const format2 = `${lastName} ${firstName}`;
            
            if (upperText.includes(format1) || upperText.includes(format2)) {
                return worker.id;
            }
            
            // Cerca le parti vicine (approccio di fallback)
            if (upperText.includes(firstName) && upperText.includes(lastName)) {
                return worker.id;
            }
        }
    }
    
    return null; // Nessun match trovato
}

/**
 * Prende il buffer originale, le assegnazioni, e genera dei file PDF singoli
 * restituiti in formato DataURL Base64
 */
export async function splitAndGenerateBase64(originalBuffer, finalAssignments) {
    const { PDFDocument } = PDFLib;
    
    // Carica il PDF originale con pdf-lib
    const sourceDoc = await PDFDocument.load(originalBuffer);
    const results = []; // { workerId, base64 }

    // Per ogni assegnazione valida (che ha un workerId)
    for (const assignment of finalAssignments) {
        if (!assignment.workerId) continue;
        
        // Crea un nuovo documento
        const newPdf = await PDFDocument.create();
        
        // Copia la pagina dal documento originale
        const [copiedPage] = await newPdf.copyPages(sourceDoc, [assignment.pageIndex]);
        newPdf.addPage(copiedPage);
        
        // Esporta in Base64
        const base64Uri = await newPdf.saveAsBase64({ dataUri: true });
        
        results.push({
            workerId: assignment.workerId,
            base64Data: base64Uri
        });
    }
    
    return results;
}

// Espone le funzioni a window per poterle chiamare da index.html (che non usa i moduli es6 nativamente per ora)
window.parseMultiPayslipPDF = parseMultiPayslipPDF;
window.splitAndGenerateBase64 = splitAndGenerateBase64;
