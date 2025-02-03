/**
 * Type for internal database IDs
 * Example: "cm6nyy1qr000016bts9zay1pd"
 */
export type DatabaseId = string & { readonly __brand: unique symbol };

/**
 * Type for Telegram user IDs
 * Example: "2061615306"
 */
export type TelegramId = string & { readonly __brand: unique symbol };

/**
 * Helper functions to type-cast IDs
 */
export const Ids = {
  /**
   * Cast a string to a DatabaseId type
   * @param id - The internal database ID string
   */
  database: (id: string): DatabaseId => id as DatabaseId,

  /**
   * Cast a string to a TelegramId type
   * @param id - The Telegram user ID string
   */
  telegram: (id: string): TelegramId => id as TelegramId
};