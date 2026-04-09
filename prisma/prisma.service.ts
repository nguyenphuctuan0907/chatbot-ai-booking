import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

function parseDatabaseUrl(url?: string) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      database: u.pathname ? u.pathname.replace(/^\//, '') : '',
    };
  } catch (err) {
    console.error('[parseDatabaseUrl] invalid DATABASE_URL:', url);
    console.error(err);
    return null;
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const parsed = parseDatabaseUrl(process.env.DATABASE_URL);

    if (!parsed) {
      // Nếu không parse được, throw để phát hiện sớm
      throw new Error('DATABASE_URL is missing or invalid. Check your .env.');
    }

    const adapter = new PrismaMariaDb({
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
    });

    super({
      adapter,
      log: ['info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch (err) {
      console.warn('[PrismaService] $disconnect ERROR', err);
    }
  }
}
