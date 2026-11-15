import { createHmac, randomBytes, randomInt } from "node:crypto";

const MAILTM_API_URL = "https://api.mail.tm";
const MAILGW_API_URL = "https://api.mail.gw";
const MAILTM_LEGACY_ACCOUNT_PREFIX = "mailtm:v1:";
const MAILTM_ACCOUNT_PREFIX = "mailtm:v2:";

type MailTmProvider = "mail.tm" | "mail.gw";

class MailTmRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MailTmRequestError";
  }
}

interface MailTmDomain {
  domain: string;
  isActive?: boolean;
  isPrivate?: boolean;
}

interface MailTmAccount {
  id?: string;
  "@id"?: string;
}

export interface MailTmSender {
  address?: string;
  name?: string;
}

export interface MailTmAttachment {
  id?: string;
  filename?: string;
  contentType?: string;
  downloadUrl?: string;
}

export interface MailTmMessage {
  id?: string;
  "@id"?: string;
  msgid?: string;
  from?: MailTmSender | string;
  subject?: string;
  text?: string;
  html?: string | string[];
  intro?: string;
  hasAttachments?: boolean;
  attachments?: MailTmAttachment[];
  createdAt?: string;
}

interface MailTmCollection<T> {
  "hydra:member"?: T[];
  "hydra:totalItems"?: number;
  "hydra:view"?: {
    "hydra:next"?: string;
  };
}

interface MailTmToken {
  token?: string;
}

function getPassword(emailAddress: string) {
  const secret =
    process.env.MAILTM_PASSWORD_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "Configura MAILTM_PASSWORD_SECRET o JWT_SECRET para autenticar buzones de Mail.tm.",
    );
  }

  return createHmac("sha256", secret)
    .update(emailAddress.toLowerCase())
    .digest("hex");
}

function providerUrl(path: string, provider: MailTmProvider) {
  const baseUrl = provider === "mail.gw" ? MAILGW_API_URL : MAILTM_API_URL;
  const url = new URL(path, baseUrl);
  if (url.origin !== baseUrl) {
    throw new Error("Mail.tm devolvió una URL de API no válida.");
  }
  return url;
}

async function getErrorMessage(response: Response) {
  const body = await response.text();
  if (!body) return "";

  try {
    const data: unknown = JSON.parse(body);
    if (typeof data === "object" && data !== null) {
      const error = data as Record<string, unknown>;
      for (const key of ["detail", "message", "hydra:description", "title"]) {
        if (typeof error[key] === "string" && error[key]) {
          return error[key];
        }
      }
    }
  } catch {
    return body.slice(0, 300);
  }

  return body.slice(0, 300);
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
  provider: MailTmProvider = "mail.tm",
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(providerUrl(path, provider), {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const method = (init.method || "GET").toUpperCase();
    const endpoint = providerUrl(path, provider).pathname;
    const details = await getErrorMessage(response);
    throw new MailTmRequestError(
      `${provider} rechazó ${method} ${endpoint}: HTTP ${response.status}${details ? `: ${details}` : ""}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

function getResourceId(resource: MailTmAccount | MailTmMessage) {
  if (typeof resource.id === "string" && resource.id) return resource.id;
  if (typeof resource["@id"] === "string") {
    return resource["@id"].split("/").filter(Boolean).at(-1) || null;
  }
  return null;
}

function getAccountFromToken(
  accountToken: string,
): { id: string; provider: MailTmProvider } | null {
  if (accountToken.startsWith(MAILTM_LEGACY_ACCOUNT_PREFIX)) {
    const id = accountToken.slice(MAILTM_LEGACY_ACCOUNT_PREFIX.length);
    return id ? { id, provider: "mail.tm" as const } : null;
  }

  if (!accountToken.startsWith(MAILTM_ACCOUNT_PREFIX)) return null;
  const [provider, ...idParts] = accountToken
    .slice(MAILTM_ACCOUNT_PREFIX.length)
    .split(":");
  const id = idParts.join(":");
  if ((provider !== "mail.tm" && provider !== "mail.gw") || !id) return null;
  return { id, provider };
}

export function isMailTmMailbox(accountToken: string) {
  return getAccountFromToken(accountToken) !== null;
}

function getProviderFromAccountToken(accountToken: string) {
  const account = getAccountFromToken(accountToken);
  if (!account) {
    throw new Error("El identificador del buzón de correo no es válido.");
  }
  return account.provider;
}

export async function authenticateMailTmMailbox(
  emailAddress: string,
  accountToken: string,
) {
  if (!isMailTmMailbox(accountToken)) {
    throw new Error(
      "Este buzón fue creado con otro proveedor. Elimínalo y crea uno nuevo para usar Mail.tm.",
    );
  }
  return getAccessToken(
    emailAddress,
    getProviderFromAccountToken(accountToken),
  );
}

async function getAccessToken(
  emailAddress: string,
  provider: MailTmProvider = "mail.tm",
) {
  const password = getPassword(emailAddress);
  const tokenResult = await requestJson<MailTmToken>("/token", {
    method: "POST",
    body: JSON.stringify({ address: emailAddress, password }),
  }, undefined, provider);

  if (!tokenResult.token) {
    throw new Error("Mail.tm no devolvió un token de acceso.");
  }

  return tokenResult.token;
}

async function createMailTmMailboxWithProvider(provider: MailTmProvider) {
  const domainResponse = await requestJson<
    MailTmCollection<MailTmDomain> | MailTmDomain[]
  >("/domains", {}, undefined, provider);
  const availableDomains = Array.isArray(domainResponse)
    ? domainResponse
    : domainResponse["hydra:member"];
  const domains = availableDomains?.filter(
    (domain) =>
      typeof domain.domain === "string" &&
      domain.domain.length > 0 &&
      domain.isActive !== false &&
      domain.isPrivate !== true,
  );

  if (!domains?.length) {
    throw new Error("Mail.tm no tiene dominios públicos disponibles.");
  }

  const domain = domains[randomInt(domains.length)].domain;
  const emailAddress = `boreal${randomBytes(8).toString("hex")}@${domain}`;
  const password = getPassword(emailAddress);
  const account = await requestJson<MailTmAccount>("/accounts", {
    method: "POST",
    body: JSON.stringify({ address: emailAddress, password }),
  }, undefined, provider);
  const accountId = getResourceId(account);

  if (!accountId) {
    throw new Error("Mail.tm creó el buzón, pero no devolvió su identificador.");
  }

  return {
    emailAddress,
    accountToken: `${MAILTM_ACCOUNT_PREFIX}${provider}:${accountId}`,
  };
}

export async function createMailTmMailbox() {
  try {
    return await createMailTmMailboxWithProvider("mail.tm");
  } catch (error) {
    if (!(error instanceof MailTmRequestError) || error.status !== 403) {
      throw error;
    }

    try {
      return await createMailTmMailboxWithProvider("mail.gw");
    } catch (fallbackError) {
      throw new Error(
        `Mail.tm rechazó la solicitud con HTTP 403. También falló el endpoint oficial compatible Mail.gw: ${fallbackError instanceof Error ? fallbackError.message : "error desconocido"}`,
      );
    }
  }
}

export async function listMailTmMessages(
  emailAddress: string,
  accountToken: string,
) {
  if (!isMailTmMailbox(accountToken)) {
    throw new Error(
      "Este buzón fue creado con otro proveedor. Elimínalo y crea uno nuevo para usar Mail.tm.",
    );
  }

  const provider = getProviderFromAccountToken(accountToken);
  const accessToken = await getAccessToken(emailAddress, provider);
  const messages: MailTmMessage[] = [];
  let path = "/messages?page=1";
  let pageCount = 0;

  while (path) {
    pageCount += 1;
    if (pageCount > 1000) {
      throw new Error("Mail.tm devolvió demasiadas páginas de mensajes.");
    }

    const page = await requestJson<
      MailTmCollection<MailTmMessage> | MailTmMessage[]
    >(path, {}, accessToken, provider);
    if (Array.isArray(page)) {
      messages.push(...page);
      break;
    }

    const members = page["hydra:member"];
    if (!Array.isArray(members)) {
      throw new Error("Mail.tm devolvió una lista de mensajes no válida.");
    }
    messages.push(...members);

    const next = page["hydra:view"]?.["hydra:next"];
    if (next) {
      const url = providerUrl(next, provider);
      path = `${url.pathname}${url.search}`;
    } else {
      if (
        typeof page["hydra:totalItems"] === "number" &&
        page["hydra:totalItems"] > messages.length
      ) {
        throw new Error("Mail.tm indicó más mensajes, pero no devolvió la página siguiente.");
      }
      path = "";
    }
  }

  return { accessToken, messages };
}

export async function getMailTmMessage(
  accessToken: string,
  messageId: string,
  accountToken: string,
) {
  const provider = getProviderFromAccountToken(accountToken);
  return requestJson<MailTmMessage>(
    `/messages/${encodeURIComponent(messageId)}`,
    {},
    accessToken,
    provider,
  );
}

export async function downloadMailTmAttachment(
  accessToken: string,
  messageId: string,
  attachment: MailTmAttachment,
  accountToken: string,
) {
  const provider = getProviderFromAccountToken(accountToken);
  if (!attachment.downloadUrl && !attachment.id) {
    throw new Error("Mail.tm no devolvió la ruta del adjunto.");
  }

  let path = attachment.downloadUrl;
  if (!path) {
    if (!attachment.id) {
      throw new Error("Mail.tm no devolvió el identificador del adjunto.");
    }
    path = `/messages/${encodeURIComponent(messageId)}/attachment/${encodeURIComponent(attachment.id)}`;
  }
  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
  });
  const response = await fetch(providerUrl(path, provider), {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await getErrorMessage(response);
    throw new Error(
      `${provider} rechazó la descarga del adjunto: HTTP ${response.status}${details ? `: ${details}` : ""}`,
    );
  }

  return {
    content: Buffer.from(await response.arrayBuffer()),
    contentType:
      attachment.contentType ||
      response.headers.get("content-type") ||
      "application/octet-stream",
    filename: attachment.filename || "adjunto",
  };
}

export async function deleteMailTmMailbox(
  emailAddress: string,
  accountToken: string,
) {
  const account = getAccountFromToken(accountToken);
  if (!account) {
    throw new Error("El identificador del buzón de Mail.tm no es válido.");
  }

  const accessToken = await getAccessToken(emailAddress, account.provider);
  const response = await fetch(
    providerUrl(`/accounts/${encodeURIComponent(account.id)}`, account.provider),
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const details = await getErrorMessage(response);
    throw new Error(
      `${account.provider} rechazó DELETE /accounts: HTTP ${response.status}${details ? `: ${details}` : ""}`,
    );
  }
}
