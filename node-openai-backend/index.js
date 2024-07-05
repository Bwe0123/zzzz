const express = require('express');
const multer = require('multer');
const axios = require('axios');
const pdf = require('pdf-parse');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Multer configuration for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads');
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Middleware to allow CORS and parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// POST endpoint for file upload
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Extract text content from the uploaded PDF file
    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdf(pdfBuffer);

    // Extract necessary data from configuration
    const configData = {
      prompt: process.env.PROMPT,
    };

    // Assuming you want to use OpenAI to process the text
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const response = await axios.post(
      'https://api.openai.com/v1/completions',
      {
        model: 'text-davinci-003', // Specify the model you want to use
        prompt: pdfData.text,
        max_tokens: 1000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
      }
    );

    const extractedText = response.data.choices[0].text.trim();

    // Save extractedText to a file
    const saveFilePath = './extracted_text.txt';
    fs.writeFileSync(saveFilePath, extractedText);

    // Check if file was saved successfully
    const fileExists = fs.existsSync(saveFilePath);
    if (!fileExists) {
      console.error(`Failed to save extracted text to ${saveFilePath}`);
      return res.status(500).json({ error: 'Failed to save extracted text' });
    }

    res.status(200).json({ text: extractedText, savedFilePath: saveFilePath });
  } catch (error) {
    console.error('Error processing file upload:', error);
    res.status(500).json({ error: 'Failed to process file upload' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
