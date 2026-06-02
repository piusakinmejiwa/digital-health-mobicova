// Minimal RFC-4180-style CSV parser — no dependency. Handles quoted fields,
// escaped quotes (""), and commas/newlines inside quotes, plus CRLF endings and
// a leading UTF-8 BOM (Excel adds one). Returns rows of string cells.
export function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // ignore — handled when the matching \n arrives
    } else {
      field += c;
    }
  }
  // Flush the final field/row unless the file ended on a clean newline.
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// The member fields a CSV column can map to.
export type MemberField =
  | 'fullName' | 'phone' | 'email' | 'dateOfBirth' | 'gender' | 'channel'
  | 'bloodGroup' | 'allergies' | 'chronicConditions' | 'currentMedications';

// Accepted header spellings (lowercased, alphanumeric only) → canonical field.
const HEADER_ALIASES: Record<string, MemberField> = {
  fullname: 'fullName', name: 'fullName',
  phone: 'phone', mobile: 'phone', phonenumber: 'phone',
  email: 'email', emailaddress: 'email',
  dateofbirth: 'dateOfBirth', dob: 'dateOfBirth', birthdate: 'dateOfBirth',
  gender: 'gender', sex: 'gender',
  channel: 'channel',
  bloodgroup: 'bloodGroup', bloodtype: 'bloodGroup',
  allergies: 'allergies',
  chronicconditions: 'chronicConditions', conditions: 'chronicConditions',
  currentmedications: 'currentMedications', medications: 'currentMedications', meds: 'currentMedications',
};

function normaliseHeader(h: string): MemberField | null {
  const key = h.toLowerCase().replace(/[^a-z0-9]/g, '');
  return HEADER_ALIASES[key] ?? null;
}

export interface ParsedImport {
  records: Record<string, string>[]; // one object per data row, keyed by MemberField
  recognisedColumns: MemberField[];
  unknownHeaders: string[];
  hasFullNameColumn: boolean;
}

// Parse CSV text into member records using the header row to map columns.
export function parseMemberCsv(text: string): ParsedImport {
  const rows = parseCsv(text).filter((r) => r.some((cell) => cell.trim() !== ''));
  if (rows.length === 0) {
    return { records: [], recognisedColumns: [], unknownHeaders: [], hasFullNameColumn: false };
  }

  const header = rows[0];
  const mapping = header.map(normaliseHeader);
  const recognisedColumns = mapping.filter((m): m is MemberField => m !== null);
  const unknownHeaders = header.filter((_, i) => mapping[i] === null).map((h) => h.trim()).filter(Boolean);

  const records = rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    mapping.forEach((field, i) => {
      if (field) rec[field] = (cells[i] ?? '').trim();
    });
    return rec;
  });

  return {
    records,
    recognisedColumns,
    unknownHeaders,
    hasFullNameColumn: recognisedColumns.includes('fullName'),
  };
}
