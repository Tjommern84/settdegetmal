export type LeadCreatedEmailParams = {
  serviceName: string;
  userName: string;
  message: string;
};

export type ProviderRepliedEmailParams = {
  serviceName: string;
  providerName: string;
  message: string;
};

export type ProviderInviteEmailParams = {
  inviteLink: string;
};

export const leadCreatedEmail = ({ serviceName, userName, message }: LeadCreatedEmailParams) => {
  return {
    subject: `Ny forespørsel til ${serviceName}`,
    body: `Hei,\n\nDu har mottatt en ny forespørsel for ${serviceName}.\n\nNavn: ${userName}\nMelding:\n${message}\n\nLogg inn for å svare.\n`,
  };
};

export const providerRepliedEmail = ({
  serviceName,
  providerName,
  message,
}: ProviderRepliedEmailParams) => {
  return {
    subject: `Du har fått svar fra ${serviceName}`,
    body: `Hei,\n\n${providerName} har svart på forespørselen din.\n\nSvar:\n${message}\n\nLogg inn for å se detaljer.\n`,
  };
};

export const providerInviteEmail = ({ inviteLink }: ProviderInviteEmailParams) => {
  return {
    subject: 'Du er invitert som tilbyder på settdegetmal.no',
    body: `Hei,\n\nDu er invitert til å bli tilbyder på settdegetmal.no.\n\nBruk denne lenken for å komme i gang:\n${inviteLink}\n\nLenken er personlig og kan bare brukes én gang.\n`,
  };
};

export type BookingConfirmedEmailParams = {
  serviceName: string;
  userName?: string;
  scheduledAt: string;
};

export type BookingCancelledEmailParams = {
  serviceName: string;
  userName?: string;
  scheduledAt: string;
};

export const bookingConfirmedEmail = ({
  serviceName,
  userName,
  scheduledAt,
}: BookingConfirmedEmailParams) => {
  const greeting = userName ? `Hei ${userName}` : 'Hei';
  return {
    subject: `Booking bekreftet med ${serviceName}`,
    body: `${greeting},\n\nDin booking med ${serviceName} er bekreftet.\n\nTidspunkt: ${scheduledAt}\n\nVi gleder oss til å se deg!\n`,
  };
};

export const bookingCancelledProviderEmail = ({
  serviceName,
  userName,
  scheduledAt,
}: BookingCancelledEmailParams) => {
  const customer = userName ?? 'kunden';
  return {
    subject: `Booking kansellert - ${serviceName}`,
    body: `Hei,\n\nBookingen med ${customer} på ${scheduledAt} har blitt kansellert.\n\nMed vennlig hilsen,\nsettdegetmal.no\n`,
  };
};

export const bookingCancelledUserEmail = ({
  serviceName,
  userName,
  scheduledAt,
}: BookingCancelledEmailParams) => {
  const greeting = userName ? `Hei ${userName}` : 'Hei';
  return {
    subject: `Booking kansellert - ${serviceName}`,
    body: `${greeting},\n\nDin booking med ${serviceName} på ${scheduledAt} har blitt kansellert.\n\nHvis du har spørsmål, ta kontakt med tilbyderen direkte.\n\nMed vennlig hilsen,\nsettdegetmal.no\n`,
  };
};
