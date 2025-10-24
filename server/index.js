const express = require('express');
const app = express();
const port = 8080;
const dotenv = require("dotenv")

const bodyParser = require('body-parser');
const { spawn } = require('child_process'); // for executing python scripts
const cors = require('cors'); // for handling cross-origin requests


app.use(cors());
app.use(bodyParser.json({limit:'5mb'}));
app.use(bodyParser.urlencoded({limit:'5mb',extended: true }));



app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});



app.post('/api/search', (req, res) => {
  const { article, searchText, windowSize, stepSize, dissimilarityThreshold, topK, irish_algo } = req.body;
  if (!searchText || !article) {
    return res.status(400).json({ error: 'searchText and article cannot be empty' });
  }


  const scriptName = irish_algo ? 'service/search_algorithm_irish.py' : 'service/search_algorithm_standard.py';
  console.log(scriptName)
  const pythonProcess = spawn('python', [
    scriptName,
    article,
    searchText, 
    windowSize || 0.5,
    stepSize || 1,
    dissimilarityThreshold || 0.5,
    topK || 5,
  ]);

  let scriptOutput = '';
  let scriptError = '';
  
  pythonProcess.stdout.on('data', (data) => {
    scriptOutput += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    scriptError += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code === 0) {
      try {
        // Parse the results as JSON from the Python script
        const results = JSON.parse(scriptOutput.trim());
        res.json({ results });
      } catch (error) {
        console.error('Error parsing Python output:', error);
        res.status(500).json({ 
          error: 'Error parsing search results', 
          details: scriptOutput 
        });
      }
    } else {
      console.error('Python script execution failed with code:', code);
      console.error('Python script error:', scriptError);
      res.status(500).json({ 
        error: 'Python script execution failed', 
        details: scriptError 
      });
    }
  });
});


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});