export function normalizeCpfDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function isValidCpf(value: string) {
  const digits = normalizeCpfDigits(value);

  if (digits.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const calculateCheckDigit = (input: string, factor: number) => {
    let sum = 0;

    for (let index = 0; index < input.length; index += 1) {
      sum += Number(input[index]) * (factor - index);
    }

    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstCheckDigit = calculateCheckDigit(digits.slice(0, 9), 10);
  const secondCheckDigit = calculateCheckDigit(`${digits.slice(0, 9)}${firstCheckDigit}`, 11);

  return firstCheckDigit === Number(digits[9]) && secondCheckDigit === Number(digits[10]);
}

export function formatCpf(value: string) {
  const digits = normalizeCpfDigits(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
