const express = require('express');
const { Octokit } = require('@octokit/rest');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const REPO_OWNER = 'hl7au';
const REPO_NAME = 'au-fhir-test-data';
const REDIRECT_URI = 'http://localhost:3000/api/auth/github/callback';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

app.use(cors());
app.use(bodyParser.json());

// Simple FHIR validation (replace with hapi-fhir for production)
const validateFhir = (data) => {
  if (!data.resourceType || !data.id) {
    return { valid: false, error: 'resourceType and id are required' };
  }
  return { valid: true };
};

// Fetch FHIR resources from GitHub
app.get('/api/resources', async (req, res) => {
  try {
    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'resources',
    });

    const resources = [];
    for (const item of data) {
      if (item.type === 'dir') {
        const { data: files } = await octokit.repos.getContent({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          path: item.path,
        });
        for (const file of files) {
          if (file.name.endsWith('.json')) {
            const { data: fileContent } = await octokit.repos.getContent({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              path: file.path,
            });
            const content = Buffer.from(fileContent.content, 'base64').toString();
            resources.push(JSON.parse(content));
          }
        }
      }
    }
    res.json(resources);
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Initiate GitHub OAuth
app.get('/api/auth/github', (req, res) => {
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo`;
  res.redirect(url);
});

// Handle GitHub OAuth callback
app.get('/api/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    }, {
      headers: { Accept: 'application/json' },
    });
    const token = response.data.access_token;
    // In production, store token securely (e.g., session)
    res.send(`
      <script>
        localStorage.setItem('github_token', '${token}');
        window.location.href = '/';
      </script>
    `);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Handle contribution
app.post('/api/contribute', async (req, res) => {
  const { data } = req.body;
  const validation = validateFhir(data);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    // Create an issue for tracking
    const issue = await octokit.issues.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `New FHIR Test Data: ${data.resourceType}/${data.id}`,
      body: 'New test data submitted via AU FHIR Search app.',
    });

    // Get the main branch SHA
    const { data: ref } = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: 'heads/main',
    });

    // Create a new branch
    const branchName = `issue-${issue.data.number}-${data.resourceType.toLowerCase()}-${data.id.toLowerCase()}`;
    await octokit.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });

    // Commit the new file
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `resources/${data.resourceType}/${data.id}.json`,
      message: `Add ${data.resourceType}/${data.id} for issue #${issue.data.number}`,
      content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
      branch: branchName,
    });

    // Create a pull request
    await octokit.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `Add ${data.resourceType}/${data.id} for issue #${issue.data.number}`,
      head: branchName,
      base: 'main',
      body: `Closes #${issue.data.number}\n\nNew FHIR test data submitted via web app.`,
    });

    res.json({ message: 'Contribution submitted successfully' });
  } catch (error) {
    console.error('Contribution error:', error);
    res.status(500).json({ error: 'Failed to submit contribution' });
  }
});

// Handle issue creation
app.post('/api/issues', async (req, res) => {
  const { title, description, steps } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    await octokit.issues.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title,
      body: `**Description**:\n${description}\n\n**Steps to Reproduce**:\n${steps || 'N/A'}`,
    });
    res.json({ message: 'Issue created successfully' });
  } catch (error) {
    console.error('Issue creation error:', error);
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
