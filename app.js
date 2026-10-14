import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'public');

export function createApp(database = db) {
  const app = express();

  // Parse JSON request bodies.
  app.use(express.json({ limit: '10kb' }));

  // Serve CSS, JavaScript, and other static files from public/.
  app.use(express.static(publicPath));

  // Explicitly serve the homepage at the root URL.
  app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  // API health check.
  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  // Get all projects.
  app.get('/api/projects', async (req, res, next) => {
    try {
      res.json(await database.list());
    } catch (error) {
      next(error);
    }
  });

  // Validate project ID.
  function readId(req, res) {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      res.status(400).json({ error: 'Invalid project id.' });
      return null;
    }

    return id;
  }

  // Validate project data.
  function readProject(req, res) {
    const name =
      typeof req.body?.name === 'string'
        ? req.body.name.trim()
        : '';

    const status = req.body?.status;

    if (
      name.length < 1 ||
      name.length > 80 ||
      !['Planned', 'In Progress', 'Completed'].includes(status)
    ) {
      res.status(400).json({
        error: 'Use a name of 1-80 characters and a valid status.'
      });
      return null;
    }

    return { name, status };
  }

  // Create a project.
  app.post('/api/projects', async (req, res, next) => {
    try {
      const project = readProject(req, res);
      if (!project) return;

      res.status(201).json(await database.create(project));
    } catch (error) {
      next(error);
    }
  });

  // Update a project.
  app.put('/api/projects/:id', async (req, res, next) => {
    try {
      const id = readId(req, res);
      if (id === null) return;

      const project = readProject(req, res);
      if (!project) return;

      const row = await database.update(id, project);

      if (!row) {
        return res.status(404).json({
          error: 'Project not found.'
        });
      }

      res.json(row);
    } catch (error) {
      next(error);
    }
  });

  // Delete a project.
  app.delete('/api/projects/:id', async (req, res, next) => {
    try {
      const id = readId(req, res);
      if (id === null) return;

      if (!(await database.remove(id))) {
        return res.status(404).json({
          error: 'Project not found.'
        });
      }

      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  });

  // Handle unknown API routes.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  // Handle invalid JSON and other errors.
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON.' });
    }

    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request too large.' });
    }

    console.error('Request failed:', error);

    res.status(500).json({ error: 'Server error.' });
  });

  return app;
}

// Export the Express app for Vercel.
const app = createApp();

export default app;