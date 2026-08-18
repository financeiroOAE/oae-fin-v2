const toLocalDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function getRolling30DayRange() {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 30);
  return { start: toLocalDateInput(today), end: toLocalDateInput(end) };
}
