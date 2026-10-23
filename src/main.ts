/**
 * @file src/main.ts
 * @description ERP Pro backend bootstrap configuration for local and Vercel
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { resolve } from 'node:path';

import { AppModule } from './core/app.module';

const server: Express = express();
server.use('/uploads', express.static(resolve(process.cwd(), 'uploads')));
let initializationPromise: Promise<void> | null = null;

const allowedOrigins = [
  'https://erp-front-opal.vercel.app',
  'http://localhost:3000',
  'http://localhost:3015',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3015',
];

async function createNestApp(expressInstance: Express): Promise<void> {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
    { bodyParser: false },
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.enableCors({
    origin: (origin, callback) => {
      // درخواست‌های بدون Origin یا منطبق با دامنه‌های مجاز و زیردامنه‌های ورسل
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
    ],
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: false,
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.init();
}

function initializeNestApp(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = createNestApp(server).catch((err) => {
      initializationPromise = null;
      throw err;
    });
  }
  return initializationPromise;
}

// اجرای سرور لوکال
if (process.env.VERCEL !== '1') {
  void (async () => {
    const logger = new Logger('Bootstrap');
    try {
      await initializeNestApp();
      const port = Number(process.env.PORT) || 3016;
      server.listen(port, () => {
        logger.log(`ERP Pro API is running on port ${port}`);
      });
    } catch (error) {
      logger.error('Failed to start ERP Pro API', error);
      process.exitCode = 1;
    }
  })();
}

// هندلر سرورلس Vercel
export default async function handler(req: Request, res: Response) {
  try {
    await initializeNestApp();
    server(req, res);
  } catch (error) {
    const logger = new Logger('VercelHandler');
    logger.error('Runtime error in Nest bootstrap', error);
    if (!res.headersSent) {
      res.status(500).json({
        statusCode: 500,
        message: 'Internal server initialization error',
      });
    }
  }
}
