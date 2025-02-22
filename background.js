// background.js

// Log extension initialization
console.log('Background script initialized');
const GEMINI_API_KEY = 'AIzaSyA0CvFe_hX5evqhQg6CsWhunYhGGnhfEwo';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// background.js
async function analyzeEligibility(resumeText, jobDescription) {
  try {
    console.log('Starting analysis with:', {
      resumeLength: resumeText?.length,
      jobDescriptionLength: jobDescription?.length
    });

    const prompt = `
      Task: Analyze if a candidate is eligible for a job position by comparing their resume with the job description.
      
      Resume:
      ${resumeText}
      
      Job Description:
      ${jobDescription}
      
      Please analyze the following aspects:
      1. Required skills match
      2. Experience level match
      3. Education requirements match
      4. Work authorization (providing he/she is international student has F1(OPT/CPT) looking for full time opportunities)
      5. Overall eligibility
      
      Provide a structured response with:
      1. Matched qualifications
      2. Missing qualifications
      3. Work authorization status (true/false)
      4. Overall eligibility (true/false)
      5. Confidence score (0-100)
      6. Brief explanation
    `;

    console.log('Sending request to Gemini API...');
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    console.log('Received response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Gemini API Response:', data);

    // Parse the Gemini response
    const analysis = parseGeminiResponse(data);
    return analysis;
  } catch (error) {
    console.error('Error in analyzeEligibility:', error);
    throw error;
  }
}

function parseGeminiResponse(data) {
  try {
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Invalid response structure:', data);
      throw new Error('Invalid API response structure');
    }

    const responseText = data.candidates[0].content.parts[0].text;
    console.log('Raw Gemini Response:', responseText);

    // Extract the overall eligibility, work authorization, and confidence score using regex
    const eligibilityMatch = responseText.match(/(?:overall )?eligibility:?\s*(true|false)/i);
    const workAuthMatch = responseText.match(/(?:work )?authorization:?\s*(true|false)/i);
    const confidenceMatch = responseText.match(/confidence:?\s*(\d+)/i);
    
    const result = {
      eligible: eligibilityMatch ? eligibilityMatch[1].toLowerCase() === 'true' : false,
      workAuthorized: workAuthMatch ? workAuthMatch[1].toLowerCase() === 'true' : false,
      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 0,
      fullAnalysis: responseText
    };

    console.log('Parsed result:', result);
    return result;
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    return {
      eligible: false,
      workAuthorized: false,
      confidence: 0,
      fullAnalysis: 'Error analyzing eligibility: ' + error.message
    };
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);

  if (request.action === 'analyze') {
    if (!request.resumeText || !request.jobDescription) {
      console.error('Missing required data:', {
        hasResume: !!request.resumeText,
        hasJobDescription: !!request.jobDescription
      });
      sendResponse({
        error: true,
        message: 'Missing resume or job description'
      });
      return true;
    }

    analyzeEligibility(request.resumeText, request.jobDescription)
      .then(result => {
        console.log('Analysis completed:', result);
        sendResponse({
          error: false,
          eligible: result.eligible,
          confidence: result.confidence,
          analysis: result.fullAnalysis
        });
      })
      .catch(error => {
        console.error('Analysis failed:', error);
        sendResponse({
          error: true,
          message: error.message || 'Error performing analysis'
        });
      });

    return true; // Required for async response
  }
});
