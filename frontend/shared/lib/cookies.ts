import Cookies from 'js-cookie';

const TOKEN_KEY = 'auth_token';

export const getToken = (): string | undefined => Cookies.get(TOKEN_KEY);

export const setToken = (token: string): void => {
  Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: 'strict' });
};

export const removeToken = (): void => {
  Cookies.remove(TOKEN_KEY);
};
