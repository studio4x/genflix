const AUTH_ERROR_TRANSLATIONS: Array<[
    RegExp,
    string
]> = [
    [/new password should be different from the old password/i, 'A nova senha deve ser diferente da senha atual.'],
    [/password should be at least (\d+) characters/i, 'A senha precisa ter pelo menos $1 caracteres.'],
    [/password is too weak/i, 'A senha informada é muito fraca. Use uma combinação mais segura.'],
    [/invalid login credentials/i, 'E-mail ou senha inválidos.'],
    [/email not confirmed/i, 'Confirme seu e-mail antes de entrar.'],
    [/user already registered/i, 'Este e-mail já está cadastrado.'],
    [/user not found/i, 'Não encontramos uma conta ativa para este e-mail.'],
    [/signup is disabled/i, 'O cadastro está temporariamente indisponível.'],
    [/signups not allowed for otp/i, 'Não encontramos uma conta ativa para este e-mail.'],
    [/signup is disabled/i, 'O cadastro está temporariamente indisponível.'],
    [/email rate limit exceeded/i, 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'],
    [/rate limit exceeded/i, 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'],
    [/token has expired or is invalid/i, 'O link expirou ou é inválido. Solicite um novo link.'],
    [/invalid refresh token/i, 'Sua sessão expirou. Faça login novamente.'],
    [/session not found/i, 'Sua sessão expirou. Faça login novamente.'],
];
export function translateAuthErrorMessage(message: string) {
    const normalizedMessage = message.trim();
    for (const [pattern, translation] of AUTH_ERROR_TRANSLATIONS) {
        if (pattern.test(normalizedMessage)) {
            return normalizedMessage.replace(pattern, translation);
        }
    }
    return normalizedMessage || 'Não foi possível concluir a ação. Tente novamente.';
}
export function toTranslatedAuthError(error: unknown, fallback = 'Não foi possível concluir a ação. Tente novamente.') {
    if (error instanceof Error) {
        return new Error(translateAuthErrorMessage(error.message));
    }
    if (typeof error === 'string') {
        return new Error(translateAuthErrorMessage(error));
    }
    return new Error(fallback);
}
