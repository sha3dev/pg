/**
 * PgException
 */

/**
 * imports: externals
 */

/**
 * imports: internals
 */

/**
 * types
 */

/**
 * consts
 */

/**
 * exports
 */

export default class PgException extends Error {
  /**
   * private: attributes
   */

  /**
   * public: properties
   */

  public sql: string;

  public message: string;

  public code?: number;

  public cause?: unknown;

  /**
   * private: methods
   */

  /**
   * constructor
   */

  constructor(error: Error, sql: string) {
    super(error.message || error.toString());
    this.sql = sql;
    try {
      const json = JSON.parse(error.message);
      if (json.error) {
        if (json.message) {
          this.message = json.message;
        }
        if (json.code) {
          this.code = json.message;
        }
        if (json.cause) {
          this.cause = json.cause;
        }
      }
    } catch {}
  }

  /**
   * public: methods
   */
}
