// Utility functions for formatting inputs

/**
 * Formats phone number: (11) 98765-4321 or (11) 3456-7890
 * Now handles international format (55 + DDD + number)
 */
export function formatPhone(value: string): string {
  // Remove all non-numeric characters
  let numbers = value.replace(/\D/g, "")

  if (numbers.length >= 12 && numbers.startsWith("55")) {
    numbers = numbers.slice(2)
  }

  // Limit to 11 digits (DDD + number)
  const limited = numbers.slice(0, 11)

  // Format based on length
  if (limited.length <= 2) {
    return limited
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2)}`
  } else if (limited.length <= 10) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`
  } else {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`
  }
}

/**
 * Formats CEP: 12345-678
 */
export function formatCEP(value: string): string {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, "")

  // Limit to 8 digits
  const limited = numbers.slice(0, 8)

  // Format: XXXXX-XXX
  if (limited.length <= 5) {
    return limited
  } else {
    return `${limited.slice(0, 5)}-${limited.slice(5)}`
  }
}

/**
 * Remove formatting from phone or CEP to get only numbers
 */
export function unformatNumbers(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * ViaCEP API response type
 */
export interface ViaCEPResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

/**
 * Fetch address data from ViaCEP API
 */
export async function fetchAddressFromCEP(cep: string): Promise<ViaCEPResponse | null> {
  try {
    // Remove formatting and validate
    const cleanCEP = unformatNumbers(cep)
    if (cleanCEP.length !== 8) {
      return null
    }

    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
    if (!response.ok) {
      return null
    }

    const data: ViaCEPResponse = await response.json()

    // Check if CEP was not found
    if (data.erro) {
      return null
    }

    return data
  } catch (error) {
    console.error("[v0] Error fetching CEP:", error)
    return null
  }
}

/**
 * Normalize phone number to international format (DDI + DDD + number)
 * Examples:
 * - "5511999999999" → "5511999999999" (already complete)
 * - "11999999999" → "5511999999999" (adds DDI 55)
 * - "999999999" → null (missing DDD, cannot normalize)
 * - "(11) 99999-9999" → "5511999999999" (removes formatting)
 */
export function normalizePhoneToInternational(phone: string): string | null {
  // Remove all non-numeric characters
  const numbers = phone.replace(/\D/g, "")

  // Already has DDI (13 digits starting with 55)
  if (numbers.length === 13 && numbers.startsWith("55")) {
    return numbers
  }

  // Has DDI but with 12 digits (landline: 55 + DDD + 8 digits)
  if (numbers.length === 12 && numbers.startsWith("55")) {
    return numbers
  }

  // Has DDD + mobile (11 digits: DDD + 9 digits)
  if (numbers.length === 11) {
    return `55${numbers}`
  }

  // Has DDD + landline (10 digits: DDD + 8 digits)
  if (numbers.length === 10) {
    return `55${numbers}`
  }

  // Cannot normalize without DDD
  return null
}
