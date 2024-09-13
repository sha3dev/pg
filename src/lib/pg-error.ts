/**
 * PgError
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

export default class PgError extends Error {
  /**
   * private: attributes
   */

  /**
   * public: properties
   */

  public sql: string;

  public message: string;

  /**
   * private: methods
   */

  /**
   * constructor
   */

  constructor(error: Error, sql: string) {
    super(error.message);
    this.message = error.message || error.toString();
    this.sql = sql;
  }

  /**
   * public: methods
   */
}
