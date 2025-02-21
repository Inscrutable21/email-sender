// In Next.js, we need to use import type for type-only imports
import type { ParseResult } from 'papaparse';
// Regular imports
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface EmailData {
  email: string;
  name?: string;
  company?: string;
  position?: string;
}

export const parseCSV = (file: File): Promise<EmailData[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<EmailData>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<EmailData>) => {
        try {
          const emails = results.data
            .map((row: any) => ({
              email: row.email || row.Email || row.EMAIL,
              name: row.name || row.Name || row.NAME,
              company: row.company || row.Company || row.COMPANY,
              position: row.position || row.Position || row.POSITION
            }))
            .filter((row: EmailData) => row.email && isValidEmail(row.email));
          resolve(emails);
        } catch (err) {
          reject(err);
        }
      },
      error: (error: Error) => {
        reject(error);
      }
    });
  });
};

export const parseExcel = async (file: File): Promise<EmailData[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    return data
      .map((row: any) => ({
        email: row.email || row.Email || row.EMAIL,
        name: row.name || row.Name || row.NAME,
        company: row.company || row.Company || row.COMPANY,
        position: row.position || row.Position || row.POSITION
      }))
      .filter((row: EmailData) => row.email && isValidEmail(row.email));
  } catch (error) {
    throw new Error('Failed to parse Excel file: ' + (error as Error).message);
  }
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};