import { MailSlurp } from "mailslurp-client";

const MAILSLURP_ACCOUNT_PREFIX = "mailslurp:v1:";

let client: MailSlurp | undefined;

export function getMailSlurpClient() {
  const apiKey = process.env.MAILSLURP_API_KEY;
  if (!apiKey) {
    throw new Error("Configura MAILSLURP_API_KEY para crear y consultar buzones.");
  }

  client ??= new MailSlurp({ apiKey });
  return client;
}

export function getMailSlurpInboxId(accountToken: string) {
  if (accountToken.startsWith(MAILSLURP_ACCOUNT_PREFIX)) {
    const inboxId = accountToken.slice(MAILSLURP_ACCOUNT_PREFIX.length);
    if (inboxId) return inboxId;
  } else if (!accountToken.startsWith("mailtm:") && accountToken) {
    return accountToken;
  }

  throw new Error("El identificador del buzón de MailSlurp no es válido.");
}

export function encodeMailSlurpInboxId(inboxId: string) {
  return `${MAILSLURP_ACCOUNT_PREFIX}${inboxId}`;
}

export async function createMailSlurpMailbox(aliasName: string) {
  const mailslurp = getMailSlurpClient();
  const inbox = await mailslurp.createInboxWithOptions({
    name: aliasName,
    description: `Buzón para: ${aliasName}`,
    expiresAt: null,
  });

  if (inbox.expiresAt) {
    try {
      await mailslurp.deleteInbox(inbox.id);
    } catch (cleanupError) {
      console.error("No se pudo limpiar el buzón temporal de MailSlurp:", cleanupError);
    }
    throw new Error(
      "Tu plan de MailSlurp no permite buzones permanentes. Actualiza a un plan con capacidad de buzones retenidos y vuelve a intentar.",
    );
  }

  return {
    emailAddress: inbox.emailAddress,
    accountToken: encodeMailSlurpInboxId(inbox.id),
  };
}
