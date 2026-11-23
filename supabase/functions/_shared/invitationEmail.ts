const templates = {
  en: ['Join your team on Ceriga', 'Open this invitation to join your workspace on Ceriga.', 'Sign in with your existing account or use the invitation to set your password. If you did not expect this email, you can ignore it.'],
  'zh-CN': ['加入 Ceriga 团队', '打开此邀请以加入您的 Ceriga 工作区。', '请使用现有账户登录，或通过邀请设置密码。如果您未预期收到此邮件，可以忽略。'],
  tr: ['Ceriga ekibinize katılın', 'Ceriga çalışma alanınıza katılmak için bu daveti açın.', 'Mevcut hesabınızla giriş yapın veya davet üzerinden parolanızı oluşturun. Bu e-postayı beklemiyorsanız yok sayabilirsiniz.'],
  pt: ['Junte-se à sua equipa na Ceriga', 'Abra este convite para entrar no seu espaço de trabalho na Ceriga.', 'Inicie sessão com a sua conta ou use o convite para definir a palavra-passe. Se não esperava este e-mail, pode ignorá-lo.'],
  es: ['Únete a tu equipo en Ceriga', 'Abre esta invitación para unirte a tu espacio de trabajo en Ceriga.', 'Inicia sesión con tu cuenta o usa la invitación para crear tu contraseña. Si no esperabas este correo, puedes ignorarlo.'],
  fr: ['Rejoignez votre équipe sur Ceriga', 'Ouvrez cette invitation pour rejoindre votre espace de travail Ceriga.', 'Connectez-vous avec votre compte ou utilisez l’invitation pour définir votre mot de passe. Si vous n’attendiez pas cet e-mail, vous pouvez l’ignorer.'],
} as const;

const expiryNotices = {
  en: 'Team invitations expire after 7 days. Password setup links may expire sooner. Ask the factory owner to resend an expired link.',
  'zh-CN': '团队邀请将在 7 天后过期。密码设置链接可能更早失效。请工厂负责人重新发送已过期的链接。',
  tr: 'Ekip davetleri 7 gün sonra sona erer. Parola oluşturma bağlantıları daha erken sona erebilir. Süresi dolan bağlantıyı fabrika sahibinden yeniden isteyin.',
  pt: 'Os convites de equipa expiram após 7 dias. A ligação para definir a palavra-passe pode expirar mais cedo. Peça ao responsável pela fábrica que reenvie a ligação expirada.',
  es: 'Las invitaciones de equipo caducan a los 7 días. El enlace para crear la contraseña puede caducar antes. Pide al responsable de la fábrica que reenvíe el enlace.',
  fr: 'Les invitations expirent au bout de 7 jours. Le lien de création du mot de passe peut expirer plus tôt. Demandez au responsable de l’atelier de renvoyer le lien.',
} as const;

export function invitationEmail(language: string | null | undefined, link: string, options: { workspace?: string; expiresInSevenDays?: boolean } = {}) {
  const key = language && Object.prototype.hasOwnProperty.call(templates, language) ? language as keyof typeof templates : 'en';
  const [subject, opening, instructions] = templates[key];
  const text = [opening, options.workspace, link, instructions,
    options.expiresInSevenDays ? expiryNotices[key] : undefined,
  ].filter(Boolean).join('\n\n');
  return { subject, text };
}
