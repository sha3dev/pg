/**
 * PgClient
 */

/**
 * imports: externals
 */

import Logger from "@sha3/logger";
import pg from "pg";

/**
 * imports: internals
 */

import PgException from "./pg-exception";

/**
 * module: initializations
 */

const logger = new Logger("pg");

/**
 * types
 */

export type QueryOptions = {
  resultAsObject?: boolean;
  nullifyNotReplacedParams?: boolean;
};

export type IsolationLevel =
  | "SERIALIZABLE"
  | "REPEATABLE READ"
  | "READ COMMITTED"
  | "READ UNCOMMITTED";

/**
 * consts
 */

const RANDOM_STRING_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RANDOM_STRING_ALPHABET_LENGTH = RANDOM_STRING_ALPHABET.length;

/**
 * exports
 */

export default class PgClient {
  /**
   * private: attributes
   */

  /**
   * public: properties
   */

  /**
   * private static: methods
   */

  private static randomString(length: number = 5) {
    let result = "";
    for (let i = 0; i < length; i += 1) {
      result += RANDOM_STRING_ALPHABET.charAt(
        Math.floor(Math.random() * RANDOM_STRING_ALPHABET_LENGTH)
      );
    }
    return result;
  }

  private static encodeParameter(value: any, randomValue?: string) {
    const random = randomValue || PgClient.randomString(3);
    return value == null ? "NULL" : `$${random}$${value}$${random}$`;
  }

  private static getJSONColumns(json: Record<string, any>) {
    const columnNames = Object.keys(json)
      .filter((key) => json[key] !== undefined)
      .sort()
      .map((item) => `"${item}"`);
    return columnNames;
  }

  private static getJSONValues(json: Record<string, any>) {
    const columnValues = Object.keys(json)
      .filter((key) => json[key] !== undefined)
      .sort()
      .map((column) => {
        let value: string | null = null;
        if (json[column] === null || json[column] === "") {
          value = "NULL";
        } else if (
          Object.prototype.toString.call(json[column]) === "[object Date]"
        ) {
          value = `'${json[column].toJSON()}'`;
        } else if (typeof json[column] === "object") {
          value = PgClient.encodeParameter(JSON.stringify(json[column]));
        } else {
          value = PgClient.encodeParameter(json[column]);
        }
        return value;
      });
    return columnValues;
  }

  private static getJSONSet(json: Record<string, any>) {
    const columns = this.getJSONColumns(json);
    const values = this.getJSONValues(json);
    const columnAndValues = columns
      .map((c, index) => `${c}=${values[index]}`)
      .join(",");
    return columnAndValues;
  }

  /**
   * public: static
   */

  public static escape(value: string) {
    if (value) {
      const random = PgClient.randomString(5);
      return `$${random}$${value}$${random}$`;
    }
    return value;
  }

  /**
   * private: methods
   */

  /**
   * constructor
   */

  constructor(
    private client: pg.ClientBase,
    private options: {
      logging?: boolean;
      role?: string;
    } = {}
  ) {}

  /**
   * public: methods
   */

  public async begin(isolationLevel?: IsolationLevel) {
    let command = `BEGIN TRANSACTION`;
    if (isolationLevel) {
      command += ` ISOLATION LEVEL ${isolationLevel}`;
    }
    await this.client.query(`${command};`);
  }

  public async rollback() {
    await this.client.query("ROLLBACK;");
  }

  public async commit() {
    await this.client.query("COMMIT;");
  }

  public async raw(sql: string) {
    return this.client.query(sql);
  }

  public async release(err?: boolean) {
    if ((this.client as pg.PoolClient).release) {
      (this.client as pg.PoolClient).release(err);
    } else if ((this.client as pg.Client).end) {
      (this.client as pg.Client).end();
    }
  }

  public async query<T>(
    originalSql: string,
    params: Record<string, any> | null = null,
    options: QueryOptions = {}
  ): Promise<T[]> {
    const startedOn = Date.now();
    let err = null;
    let result = null;
    let sql = originalSql;
    try {
      sql = sql.replace(/\s+/g, " ");
      if (params) {
        const random = PgClient.randomString(5);
        Object.keys(params).forEach((key) => {
          if (Array.isArray(params[key])) {
            sql = sql.replace(
              new RegExp(`:${key}`, "g"),
              `ARRAY[${params[key]
                .map((item: any) => PgClient.encodeParameter(item, random))
                .join(",")}]`
            );
          } else if (
            Object.prototype.toString.call(params[key]) === "[object Date]"
          ) {
            sql = sql.replace(
              new RegExp(`:${key}`, "g"),
              PgClient.encodeParameter((params[key] as Date).toJSON(), random)
            );
          } else {
            sql = sql.replace(
              new RegExp(`:${key}`, "g"),
              PgClient.encodeParameter(params[key], random)
            );
          }
        });
      }
      sql = sql.trim();
      if (options.nullifyNotReplacedParams) {
        sql = sql.replace(/:[a-zA-Z0-9]+/g, "NULL");
      }
      const { rows } = await this.client.query(sql);
      if (!options.resultAsObject) {
        result = rows;
      } else {
        result = {};
        rows.forEach((row: any) => {
          result[row.id] = row;
        });
      }
      return result as T[];
    } catch (e: any) {
      err = e;
      throw new PgException(e, sql);
    } finally {
      const time = Date.now() - startedOn;
      if (err) {
        const errMessage = err.message || err.toString();
        logger.error(`[PG][${time}ms] ${sql} => ${errMessage}`);
      } else if (this.options.logging) {
        logger.debug(`[PG][${time}ms] ${sql}`);
      }
    }
  }

  public async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: Record<string, unknown> | null = null,
    options: QueryOptions = {}
  ): Promise<T | null> {
    const result = await this.query<T>(sql, params, options);
    return result && result[0] ? result[0] : null;
  }

  public async insert<T>(table: string, json: Record<string, any>) {
    const array = Array.isArray(json) ? json : [json];
    let sql = "";
    array.forEach((item) => {
      const columns = PgClient.getJSONColumns(item).join(",");
      const values = PgClient.getJSONValues(item).join(",");
      sql += `INSERT INTO ${table}(${columns}) VALUES(${values}) RETURNING *;\n`;
    });
    return this.queryOne<T>(sql, null);
  }

  public async update<T>(
    table: string,
    where: string,
    json: Record<string, any>,
    whereParams: Record<string, unknown> | null = null
  ) {
    const rowsToUpdate = await this.query(
      `SELECT TRUE FROM ${table} WHERE ${where}`,
      whereParams
    );
    if (rowsToUpdate.length > 1) {
      throw new Error(`this query updates more than one row!`);
    }
    const set = PgClient.getJSONSet(json);
    if (set) {
      return this.queryOne<T>(
        `UPDATE ${table} SET ${set} WHERE ${where} RETURNING *`,
        whereParams
      );
    }
    return this.queryOne<T>(
      `SELECT * FROM ${table} WHERE ${where}`,
      whereParams
    );
  }

  public async runFunction<T = Record<string, unknown>>(
    functionName: string,
    params: Record<string, unknown> | null = null,
    options: QueryOptions = {}
  ): Promise<T> {
    const paramsSql = [];
    if (params) {
      Object.keys(params)
        .filter((param) => params[param] !== undefined)
        .forEach((param) => {
          paramsSql.push(`${param} => :${param}`);
        });
    }
    const sql = `SELECT * FROM "${functionName}"(${paramsSql.join(",")})`;
    const result = await this.queryOne<T>(sql, params, options);
    return result;
  }
}
