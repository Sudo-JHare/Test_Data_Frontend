const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');
const app = express();
const port = process.env.PORT || 3050; // Changed from 3000 to 3050

// Commented out GitHub dependencies
// const { Octokit } = require('@octokit/rest');
// const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
// const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
// const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
// const REPO_OWNER = 'Sudo-JHare';
// const REPO_NAME = 'au-fhir-test-data';
// const REDIRECT_URI = 'http://localhost:3000/api/auth/github/callback';
// const octokit = new Octokit({ auth: GITHUB_TOKEN });

app.use(cors());
app.use(bodyParser.json());

// Paths for local data
const DATA_DIR = path.join(__dirname, 'data', 'au-fhir-test-data-set');
const LAST_UPDATED_FILE = path.join(__dirname, 'data', 'last_updated.json');
const ISSUES_FILE = path.join(__dirname, 'data', 'issues.json');

// Simple FHIR validation (replace with hapi-fhir for production)
const validateFhir = (data) => {
  if (!data.resourceType || !data.id) {
    return { valid: false, error: 'resourceType and id are required' };
  }
  return { valid: true };
};

// Fetch FHIR resources from local directory
app.get('/api/resources', async (req, res) => {
  try {
    console.log(`Reading FHIR resources from ${DATA_DIR}...`);
    const resources = [];
    
    // Read files directly in au-fhir-test-data-set
    const items = await fs.readdir(DATA_DIR, { withFileTypes: true });
    for (const item of items) {
      if (item.isFile() && item.name.endsWith('.json')) {
        const fullPath = path.join(DATA_DIR, item.name);
        console.log('Reading file:', fullPath);
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          resources.push(JSON.parse(content));
        } catch (parseError) {
          console.error(`Error parsing JSON file ${fullPath}:`, parseError);
        }
      }
    }
    
    console.log('Final resources:', JSON.stringify(resources, null, 2));
    res.json(resources);
  } catch (error) {
    console.error('Error fetching resources:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch resources', details: error.message });
  }
});

// Refresh local test data from GitHub repository
app.get('/api/refresh', async (req, res) => {
  try {
    console.log('Refreshing test data from Sudo-JHare/au-fhir-test-data...');
    const repoUrl = 'https://github.com/Sudo-JHare/au-fhir-test-data/archive/refs/heads/main.zip';
    const response = await axios.get(repoUrl, { responseType: 'stream' });
    
    // Create temporary directory
    const tempDir = path.join(__dirname, 'data', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Save ZIP
    const zipPath = path.join(tempDir, 'repo.zip');
    const writeStream = fs.createWriteStream(zipPath);
    response.data.pipe(writeStream);
    
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    // Unzip and move au-fhir-test-data-set
    await fs.rm(DATA_DIR, { recursive: true, force: true });
    await fs.mkdir(DATA_DIR, { recursive: true });
    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: tempDir }))
        .on('close', resolve)
        .on('error', reject);
    });
    
    // Move au-fhir-test-data-set contents
    const extractedDir = path.join(tempDir, 'au-fhir-test-data-main', 'au-fhir-test-data-set');
    const files = await fs.readdir(extractedDir, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile()) {
        await fs.rename(
          path.join(extractedDir, file.name),
          path.join(DATA_DIR, file.name)
        );
      }
    }
    
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });
    
    // Update timestamp
    const timestamp = new Date().toISOString();
    await fs.writeFile(LAST_UPDATED_FILE, JSON.stringify({ lastUpdated: timestamp }));
    console.log(`Data refreshed at ${timestamp}`);
    
    res.json({ message: 'Test data refreshed successfully', timestamp });
  } catch (error) {
    console.error('Error refreshing test data:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to refresh test data', details: error.message });
  }
});

// Get last updated timestamp
app.get('/api/last-updated', async (req, res) => {
  try {
    const content = await fs.readFile(LAST_UPDATED_FILE, 'utf8');
    const { lastUpdated } = JSON.parse(content);
    res.json({ lastUpdated });
  } catch (error) {
    console.error('Error reading last updated timestamp:', error);
    res.status(404).json({ error: 'Timestamp not found' });
  }
});

// Handle contribution (store locally)
app.post('/api/contribute', async (req, res) => {
  const { data } = req.body;
  const validation = validateFhir(data);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    // Store in au-fhir-test-data-set/<resourceType>/<id>.json for future compatibility
    const filePath = path.join(DATA_DIR, data.resourceType, `${data.id}.json`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved contribution: ${filePath}`);
    res.json({ message: 'Contribution saved successfully' });
  } catch (error) {
    console.error('Contribution error:', error);
    res.status(500).json({ error: 'Failed to save contribution' });
  }
});

// Handle issue creation (store locally)
app.post('/api/issues', async (req, res) => {
  const { title, description, steps } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    const issue = { title, description, steps: steps || 'N/A', timestamp: new Date().toISOString() };
    let issues = [];
    try {
      const content = await fs.readFile(ISSUES_FILE, 'utf8');
      issues = JSON.parse(content);
      if (!Array.isArray(issues)) issues = [];
    } catch (error) {
      // File doesn't exist yet
    }
    issues.push(issue);
    await fs.writeFile(ISSUES_FILE, JSON.stringify(issues, null, 2));
    console.log('Issue saved:', issue);
    res.json({ message: 'Issue saved successfully' });
  } catch (error) {
    console.error('Issue creation error:', error);
    res.status(500).json({ error: 'Failed to save issue' });
  }
});

// Commented out GitHub OAuth endpoints
// app.get('/api/auth/github', (req, res) => {
//   const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo`;
//   res.redirect(url);
// });

// app.get('/api/auth/github/callback', async (req, res) => {
//   const { code } = req.query;
//   try {
//     const response = await axios.post('https://github.com/login/oauth/access_token', {
//       client_id: GITHUB_CLIENT_ID,
//       client_secret: GITHUB_CLIENT_SECRET,
//       code,
//       redirect_uri: REDIRECT_URI,
//     }, {
//       headers: { Accept: 'application/json' },
//     });
//     const token = response.data.access_token;
//     res.send(`
//       <script>
//         localStorage.setItem('github_token', '${token}');
//         window.location.href = '/';
//       </script>
//     `);
//   } catch (error) {
//     console.error('OAuth error:', error);
//     res.status(500).send('Authentication failed');
//   }
// });

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
