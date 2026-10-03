import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

/** Maps TypeScript camelCase properties to snake_case columns. Explicit column names win. */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  public override tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? toSnakeCase(targetName);
  }

  public override columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    const prefix =
      embeddedPrefixes.length === 0 ? '' : `${toSnakeCase(embeddedPrefixes.join('_'))}_`;
    return prefix + (customName || toSnakeCase(propertyName));
  }
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
}
