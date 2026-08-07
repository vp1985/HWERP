import express from 'express';
import cors from 'cors';
import entitiesRouter from './routes/entities.js';
import sequencesRouter from './routes/sequences.js';
import numberCirclesRouter from './routes/numberCircles.js';
import serviceReportsRouter from './routes/serviceReports.js';
import assetTypesRouter from './routes/assetTypes.js';
import resetRouter from './routes/reset.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.use('/api/entities', entitiesRouter);
app.use('/api/sequences', sequencesRouter);
app.use('/api/number-circles', numberCirclesRouter);
app.use('/api/service-reports', serviceReportsRouter);
app.use('/api/asset-types', assetTypesRouter);
app.use('/api/reset', resetRouter);

const apiPort = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);

const server = app.listen(apiPort);

server.on('listening', () => {
  console.log(`API on :${apiPort}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`API port ${apiPort} is already in use. Set API_PORT to a free port.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
