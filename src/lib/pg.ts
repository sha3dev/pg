/**
 * PgService
 */

/**
 * imports: externals
 */

import Logger from "@sha3/logger";
import pg from "pg";

/**
 * imports: internals
 */

import PgClient from "./pg-client";

/**
 * module: initializations
 */

const logger = new Logger("pg");

/**
 * types
 */

/**
 * consts
 */

/**
 * exports
 */

export default class Pg {
  /**
   * private: attributes
   */

  private pool: pg.Pool | null = null;

  /**
   * private: properties
   */

  private get PoolStatus() {
    return this.pool
      ? `total:${this.pool.totalCount}/idle:${this.pool.idleCount}/waiting:${this.pool.waitingCount}`
      : "pool is null";
  }

  /**
   * public: properties
   */

  /**
   * private static: methods
   */

  /**
   * private: methods
   */

  private get Pool() {
    if (!this.pool) {
      this.pool = new pg.Pool({
        connectionString: this.options.connectionString,
        max: this.options.maxPoolSize || 50,
        connectionTimeoutMillis: this.options.connectionTimeoutMillis,
        idleTimeoutMillis: this.options.idleTimeoutMillis || 5000,
      });

      this.pool.on("error", (err: any) => {
        logger.error(err.stack);
        setTimeout(() => process.exit(-1));
      });

      if (this.options.logging) {
        this.pool.on("connect", () => {
          logger.debug(`client connection (${this.PoolStatus})`);
        });
        this.pool.on("acquire", () => {
          logger.debug(`client acquired (${this.PoolStatus})`);
        });
        this.pool.on("remove", () => {
          logger.debug(`client removed (${this.PoolStatus})`);
        });
      }
    }
    return this.pool;
  }

  /**
   * constructor
   */

  constructor(
    private options: {
      connectionString: string;
      maxPoolSize?: number;
      connectionTimeoutMillis?: number;
      idleTimeoutMillis?: number;
      logging?: boolean;
      role?: string;
    }
  ) {}

  /**
   * public: methods
   */

  public async getClient(): Promise<PgClient> {
    const { logging, role } = this.options;
    const poolClient = await this.Pool.connect();
    const client = new PgClient(poolClient, { logging, role });
    return client;
  }

  public async getSessionClient(): Promise<PgClient> {
    const { connectionString, logging } = this.options;
    const pgClient = new pg.Client({ connectionString });
    await pgClient.connect();
    const client = new PgClient(pgClient, { logging });
    return client;
  }

  public escape(
    value: string | number | undefined | null,
    nullifyIfEmpty?: boolean
  ) {
    if (typeof value === "number") {
      return PgClient.escape(value.toString());
    }
    if (value) {
      return PgClient.escape(value);
    }
    if (nullifyIfEmpty) {
      return "NULL";
    }
    return value;
  }

  public async check() {
    const client = await this.getClient();
    try {
      const { now } = (await client.query<{ now: Date }>("SELECT NOW()"))[0];
      logger.debug(`check database connection => ${now.toISOString()}`);
      return now;
    } catch (e: any) {
      throw new Error(`error connecting to database: ${e.message}`);
    } finally {
      client.release();
    }
  }
}
