document.getElementById('analyzeButton').addEventListener('click', async () => {
    const fileInput = document.getElementById('resumeUpload');
    const file = fileInput.files[0];
  
    if (file) {
      const resumeText = await parseResume(file);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: analyzeJob,
        args: [resumeText]
      });
    } else {
      alert('Please upload your resume first.');
    }
  });
  
  async function parseResume(file) {
    const formData = new FormData();
    formData.append('file', file);
  
    const response = await fetch('https://api.your-resume-parser.com/parse', {
      method: 'POST',
      body: formData
    });
  
    const data = await response.json();
    return data.text; // Assuming the API returns the parsed text in a 'text' field
  }
  
  function analyzeJob(resumeText) {
    const jobDescription = document.body.innerText;
  
    fetch('https://api.gemini.com/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_GEMINI_API_KEY'
      },
      body: JSON.stringify({ resume: resumeText, jobDescription })
    })
    .then(response => response.json())
    .then(data => {
      const result = document.createElement('div');
      result.textContent = data.eligible ? 'You are eligible to apply!' : 'You are not eligible to apply.';
      document.body.appendChild(result);
    })
    .catch(error => console.error('Error:', error));
  }