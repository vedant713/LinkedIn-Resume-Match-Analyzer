// content.js
let uploadedResumeText = null;

// Function to wait for an element to appear in the DOM
function waitForElement(selector) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(mutations => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// Function to create a resume upload button
function createResumeUploadButton(container) {
  const uploadDiv = document.createElement('div');
  uploadDiv.style.margin = '10px 0';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.doc,.docx,.txt';
  input.style.display = 'none';

  const button = document.createElement('button');
  button.textContent = 'Upload Resume';
  button.style.marginRight = '10px';
  button.style.padding = '5px 10px';
  button.style.backgroundColor = '#0077B5';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';

  const status = document.createElement('span');

  button.addEventListener('click', () => input.click());

  input.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
      status.textContent = 'Reading resume...';
      try {
        uploadedResumeText = await parseResumeFile(file);
        status.textContent = '✅ Resume uploaded';
        button.textContent = 'Change Resume';

        // Debugging: Print resume content to console
        console.log("--- Uploaded Resume Content (Debug) ---");
        console.log(uploadedResumeText);
        console.log("---------------------------------------");

      } catch (error) {
        status.textContent = '❌ Error reading resume';
        console.error('Resume reading error:', error);
      }
    }
  });

  uploadDiv.appendChild(input);
  uploadDiv.appendChild(button);
  uploadDiv.appendChild(status);
  container.appendChild(uploadDiv);
}

// Function to parse resume files
async function parseResumeFile(file) {
  if (file.type === 'text/plain') {
    // Handle plain text files
    return await file.text();
  } else if (file.type === 'application/pdf') {
    // Handle PDF files using pdf.js
    return await parsePDF(file);
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // Handle DOCX files using mammoth.js (if available)
    return await parseDOCX(file);
  } else {
    throw new Error('Unsupported file type');
  }
}

// Function to parse PDF files using pdf.js
async function parsePDF(file) {
  // Import the prebuilt pdf.js library
  const pdfjsLib = await import(chrome.runtime.getURL('pdfjs/pdf.mjs'));

  // Set the worker source (required for pdf.js to work)
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdfjs/pdf.worker.mjs');

  // Read the file as an ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Load the PDF document
  const pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;

  let pdfText = '';

  // Extract text from each page
  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    pdfText += pageText + '\n';
  }

  return pdfText;
}

// Function to parse DOCX files (if mammoth.js is available)
async function parseDOCX(file) {
  // If you have mammoth.js, you can use it here
  // Example:
  // const mammoth = await import(chrome.runtime.getURL('path/to/mammoth.js'));
  // const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  // return result.value;

  throw new Error('DOCX parsing not implemented. Please use mammoth.js or another library.');
}

// Function to add the Analyze Eligibility button and Copy Job Description button
function addAnalyzeButton() {
  const jobTitleElement = document.querySelector('.job-details-jobs-unified-top-card__job-title h1');

  if (jobTitleElement && !jobTitleElement.nextElementSibling?.classList.contains('analyze-container')) {
    const container = document.createElement('div');
    container.classList.add('analyze-container');

    createResumeUploadButton(container);

    const analyzeButton = document.createElement('button');
    analyzeButton.textContent = 'Analyze Eligibility';
    analyzeButton.style.padding = '5px 10px';
    analyzeButton.style.backgroundColor = '#4CAF50';
    analyzeButton.style.color = 'white';
    analyzeButton.style.border = 'none';
    analyzeButton.style.borderRadius = '5px';
    analyzeButton.style.cursor = 'pointer';

    const copyJobDescriptionButton = document.createElement('button');
    copyJobDescriptionButton.textContent = 'Copy Job Description';
    copyJobDescriptionButton.style.padding = '5px 10px';
    copyJobDescriptionButton.style.backgroundColor = '#0077B5';
    copyJobDescriptionButton.style.color = 'white';
    copyJobDescriptionButton.style.border = 'none';
    copyJobDescriptionButton.style.borderRadius = '5px';
    copyJobDescriptionButton.style.cursor = 'pointer';
    copyJobDescriptionButton.style.marginLeft = '10px';

    const resultDiv = document.createElement('div');
    resultDiv.style.marginTop = '10px';

    analyzeButton.addEventListener('click', async () => {
      if (!uploadedResumeText) {
        alert('Please upload your resume first');
        return;
      }

      try {
        const jobDescriptionElement = await waitForElement('.jobs-description__content');
        const descriptionText = Array.from(jobDescriptionElement.querySelectorAll('.jobs-box__html-content'))
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0)
          .join('\n');

        resultDiv.textContent = 'Analyzing...';

        chrome.runtime.sendMessage({
          action: 'analyze',
          resumeText: uploadedResumeText,
          jobDescription: descriptionText
        }, (response) => {
          if (response) {
            resultDiv.innerHTML = `
              <div style="margin-top: 10px;">
                <div style="margin-top: 10px; white-space: pre-line;">
                  ${response.analysis}
                </div>
              </div>
            `;
          } else {
            resultDiv.textContent = 'Error analyzing eligibility';
          }
        });
      } catch (error) {
        console.error('Error:', error);
        resultDiv.textContent = 'Error analyzing job description';
      }
    });

    copyJobDescriptionButton.addEventListener('click', async () => {
      try {
        const jobDescriptionElement = await waitForElement('.jobs-description__content');
        const descriptionText = Array.from(jobDescriptionElement.querySelectorAll('.jobs-box__html-content'))
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0)
          .join('\n');

        await navigator.clipboard.writeText(descriptionText);
        alert('Job description copied to clipboard!');
      } catch (error) {
        console.error('Error copying job description:', error);
        alert('Failed to copy job description');
      }
    });

    container.appendChild(analyzeButton);
    container.appendChild(copyJobDescriptionButton);
    container.appendChild(resultDiv);
    jobTitleElement.parentNode.insertBefore(container, jobTitleElement.nextElementSibling);
  }
}

// Add the Analyze Eligibility button when the page loads
addAnalyzeButton();

// Observe DOM changes to add the button dynamically
const observer = new MutationObserver(addAnalyzeButton);
observer.observe(document.body, { childList: true, subtree: true });