export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalizedPhone = phone.replace(/[^\d]/g, "");
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

export function buildLeadWhatsAppMessage(args: {
  leadId: string;
  customerName: string;
  preliminaryTotal: number;
}): string {
  return [
    `Hola, soy ${args.customerName}.`,
    `Ya cargue mi configuracion en la web.`,
    `Lead: ${args.leadId}.`,
    `Total preliminar orientativo: $${args.preliminaryTotal.toFixed(2)}.`,
    "Quiero confirmar el presupuesto final.",
  ].join(" ");
}
