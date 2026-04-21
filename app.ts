import cors from 'cors';
import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/routes/authRoutes.js';
import formRoutes from "./modules/form/routes/formRoutes.js"
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  


  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  //! route for auth 
  app.use('/api/', authRoutes);
//! route for form
app.use("/api/v1/form",formRoutes);
  // app.use((_req, _res, next) => {
  //   console.log(_req.url);
  //   const err = new Error('Route Not Found') as Error & { status: number };
  //   err.status = 404;
  //   next(err);
  // });

  app.use(errorHandler);
  return app;
}