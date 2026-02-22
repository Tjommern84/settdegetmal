export type AvailabilitySlot = {
  weekday: number;
  start_time: string;
  end_time: string;
};

export type LeadSuggestion = {
  id: string;
  suggested_at: string;
};

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Man',
  2: 'Tir',
  3: 'Ons',
  4: 'Tor',
  5: 'Fre',
  6: 'Lør',
  7: 'Søn',
};

export const formatSlotLabel = (slot: AvailabilitySlot): string => {
  const dayLabel = WEEKDAY_LABELS[slot.weekday] ?? 'Ukedag';
  return `${dayLabel} ${slot.start_time}–${slot.end_time}`;
};

export type CancellationType = 'on_time' | 'late';

export type BookingStatus = 'proposed' | 'confirmed' | 'cancelled';

export type BookingItem = {
  id: string;
  lead_id: string;
  service_id: string;
  service_name: string | null;
  user_id: string;
  scheduled_at: string;
  status: BookingStatus;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: 'user' | 'provider' | null;
  cancellation_type: CancellationType | null;
  no_show_marked: boolean;
  no_show_marked_at: string | null;
  created_at: string;
};

export const formatBookingTime = (value: string) =>
  new Date(value).toLocaleString('no-NO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

export const bookingStatusLabel: Record<BookingStatus, string> = {
  proposed: 'Forslag',
  confirmed: 'Bekreftet',
  cancelled: 'Avlyst',
};

export const cancellationTypeLabel: Record<CancellationType, string> = {
  on_time: 'Avlyst i tide',
  late: 'Sen avbestilling',
};
