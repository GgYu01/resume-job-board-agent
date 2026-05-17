export function hasAccessLimitSignal(input: { text?: string; url?: string }): boolean {
  return /安全验证|验证码|captcha|verify|访问受限|操作过于频繁/i.test(`${input.url ?? ""}\n${input.text ?? ""}`);
}
