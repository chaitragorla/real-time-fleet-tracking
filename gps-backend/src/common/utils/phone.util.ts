export function formatPhoneNumber(phoneNumber: string): string {
  const cleanNumber = phoneNumber.replace(/[\s\-+]/g, '');
  if (cleanNumber.startsWith('91') && cleanNumber.length === 12) {
    return cleanNumber.substring(2);
  }
  return cleanNumber;
}

export function isValidIndianPhoneNumber(phoneNumber: string): boolean {
  return /^[6-9]\d{9}$/.test(formatPhoneNumber(phoneNumber));
}
