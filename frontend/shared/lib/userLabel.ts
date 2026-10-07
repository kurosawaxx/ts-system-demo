/** 氏名の表示に必要な、無効判定用のフィールドだけを持つ最小の形。 */
interface NameWithStatus {
  name: string;
  is_active?: boolean;
}

/**
 * 無効化(退職等)されたメンバーは担当者候補に出なくなるが、過去の工数実績には担当者として残る。
 * 現役メンバーと見分けられるよう「（無効）」を付けて表示する。
 * is_active を返さない API のレスポンスは現役扱いにする。
 */
export function isInactiveUser(user?: NameWithStatus | null): boolean {
  return user != null && user.is_active === false;
}

export function formatUserName(user?: NameWithStatus | null): string {
  if (!user) return '';
  return isInactiveUser(user) ? `${user.name}（無効）` : user.name;
}
