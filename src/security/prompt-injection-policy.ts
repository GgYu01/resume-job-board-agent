const forbiddenActionPatterns = [
  /open\s+(browser|tab|page)/i,
  /send\s+(message|resume|application)/i,
  /apply\s+(to|for)\s+job/i,
  /export\s+(cookie|token|credential|password)/i,
  /触发.*沟通/,
  /立即沟通/,
  /打开.*(浏览器|页面|标签)/,
  /发送.*消息/,
  /投递.*岗位/,
  /导出.*(cookie|token|凭据|密码)/i,
];

export function containsForbiddenExternalAction(text: string): boolean {
  return forbiddenActionPatterns.some((pattern) => pattern.test(text));
}
