import { createHmac, randomBytes, randomInt } from "node:crypto";

const MAILTM_API_URL = "https://api.mail.tm";
const MAILTM_ACCOUNT_PREFIX = "mailtm:v1:";

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

function providerUrl(path: string) {
  const url = new URL(path, MAILTM_API_URL);
  if (url.origin !== MAILTM_API_URL) {
    throw new Error("Mail.tm devolvió una URL de API no válida.");
  }
  return url;
}

async function getErrorMessage(response: Response) {
  const body = await response.text();
  if (!body) return `HTTP ${response.status}`;

  try {
    const data: unknown = JSON.parse(body);
    if (typeof data === "object" && data !== null) {
      const error = data as Record<string, unknown>;
      for (const key of ["detail", "message", "hydra:description", "title"]) {
        if (typeof error[key] === "string" && error[key]) {
          return `${response.status}: ${error[key]}`;
        }
      }
    }
  } catch {
    return `${response.status}: ${body.slice(0, 300)}`;
  }

  return `${response.status}: ${body.slice(0, 300)}`;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(providerUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const method = (init.method || "GET").toUpperCase();
    const endpoint = providerUrl(path).pathname;
    throw new Error(
      `Mail.tm rechazó ${method} ${endpoint}: HTTP ${await getErrorMessage(response)}`,
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

function getAccountIdFromToken(accountToken: string) {
  if (!accountToken.startsWith(MAILTM_ACCOUNT_PREFIX)) return null;
  return accountToken.slice(MAILTM_ACCOUNT_PREFIX.length) || null;
}

export function isMailTmMailbox(accountToken: string) {
  return getAccountIdFromToken(accountToken) !== null;
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
  return getAccessToken(emailAddress);
}

async function getAccessToken(emailAddress: string) {
  const password = getPassword(emailAddress);
  const tokenResult = await requestJson<MailTmToken>("/token", {
    method: "POST",
    body: JSON.stringify({ address: emailAddress, password }),
  });

  if (!tokenResult.token) {
    throw new Error("Mail.tm no devolvió un token de acceso.");
  }

  return tokenResult.token;
}

export async function createMailTmMailbox() {
  const domainResponse = await requestJson<
    MailTmCollection<MailTmDomain> | MailTmDomain[]
  >("/domains");
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
  });
  const accountId = getResourceId(account);

  if (!accountId) {
    throw new Error("Mail.tm creó el buzón, pero no devolvió su identificador.");
  }

  return {
    emailAddress,
    accountToken: `${MAILTM_ACCOUNT_PREFIX}${accountId}`,
  };
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

  const accessToken = await getAccessToken(emailAddress);
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
    >(path, {}, accessToken);
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
      const url = providerUrl(next);
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
) {
  return requestJson<MailTmMessage>(
    `/messages/${encodeURIComponent(messageId)}`,
    {},
    accessToken,
  );
}

export async function downloadMailTmAttachment(
  accessToken: string,
  messageId: string,
  attachment: MailTmAttachment,
) {
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
  const response = await fetch(providerUrl(path), {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Mail.tm: ${await getErrorMessage(response)}`);
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
  const accountId = getAccountIdFromToken(accountToken);
  if (!accountId) {
    throw new Error("El identificador del buzón de Mail.tm no es válido.");
  }

  const accessToken = await getAccessToken(emailAddress);
  const response = await fetch(
    providerUrl(`/accounts/${encodeURIComponent(accountId)}`),
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Mail.tm: ${await getErrorMessage(response)}`);
  }
}
