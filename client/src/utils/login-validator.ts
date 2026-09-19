export function validateAccount(account: string): string {
  const trimmed = account.trim()

  if (!trimmed) {
    return '请输入账号'
  }

  if (/^\d{11}$/.test(trimmed) || /^[A-Za-z0-9_]{4,20}$/.test(trimmed)) {
    return ''
  }

  return '账号需为 4-20 位字母、数字或下划线，手机号可直接输入 11 位数字'
}

export function validatePassword(password: string): string {
  const trimmed = password.trim()

  if (!trimmed) {
    return '请输入密码'
  }

  if (/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,20}$/.test(trimmed)) {
    return ''
  }

  return '密码需为 8-20 位，且至少包含字母和数字'
}
