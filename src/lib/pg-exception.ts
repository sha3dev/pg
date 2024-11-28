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

  public status?: number;

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
        if (json.status) {
          this.status = json.status;
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
