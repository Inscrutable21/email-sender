import { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';
import { prisma } from '@/utils/prisma';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';

// Disable the default body parser to handle form data
export const config = {
  api: {
    bodyParser: false,
  },
};

// Types
type EmailStatus = 'PENDING' | 'SENT' | 'FAILED';
interface EmailRecord {
  id: string;
  emailAddress: string;
  status: EmailStatus;
  sentAt?: Date;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
}
interface EmailAttachment {
  filename?: string;
  content: Buffer;
  contentType: string;
}
interface EmailSendResult {
  success: boolean;
  email: string;
  error?: string;
}

// Ensure temporary directory exists
const ensureTempDirExists = async () => {
  const tmpDir = path.join(process.cwd(), 'tmp');
  try {
    await fs.access(tmpDir);
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.mkdir(tmpDir, { recursive: true });
  }
  return tmpDir;
};

// Parse form data
const parseForm = async (req: NextApiRequest) => {
  const tmpDir = await ensureTempDirExists();
  
  const form = formidable({
    multiples: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB max
    uploadDir: tmpDir,
    keepExtensions: true,
    filter: ({ mimetype }) => mimetype === 'application/pdf',
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });
};

// Handle single email sending
const sendSingleEmail = async (
  emailRecord: EmailRecord,
  subject: string,
  content: string,
  attachments: EmailAttachment[],
  transporter: nodemailer.Transporter
): Promise<EmailSendResult> => {
  try {
    await transporter.sendMail({
      from: {
        name: process.env.SMTP_FROM_NAME || 'Anand Singh ',
        address: process.env.SMTP_USER || ''
      },
      to: emailRecord.emailAddress,
      subject,
      html: content,
      attachments,
      headers: {
        'X-Campaign-ID': emailRecord.id,
        'List-Unsubscribe': `<${process.env.UNSUBSCRIBE_URL}?email=${encodeURIComponent(emailRecord.emailAddress)}>`
      }
    });

    // Update email status
    await prisma.email.update({
      where: { id: emailRecord.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        errorMessage: null,
        metadata: {
          attachments: attachments.map(att => ({
            filename: att.filename || 'unknown',
            type: 'application/pdf'
          }))
        }
      }
    });

    return { success: true, email: emailRecord.emailAddress };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update email status with error
    await prisma.email.update({
      where: { id: emailRecord.id },
      data: {
        status: 'FAILED',
        errorMessage,
        metadata: {
          lastError: errorMessage,
          attemptedAt: new Date().toISOString()
        }
      }
    });

    return { success: false, email: emailRecord.emailAddress, error: errorMessage };
  }
};

// Main handler function
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const filesToDelete: string[] = [];

  try {
    // Parse the form data
    const { fields, files } = await parseForm(req) as any;
    
    const subject = fields.subject?.[0] || '';
    const content = fields.content?.[0] || '';

    if (!subject || !content) {
      return res.status(400).json({ message: 'Missing required fields: subject and content' });
    }

    // Initialize email transporter
    const transporter = createTransporter();
    await transporter.verify();

    // Get pending emails 
    const pendingEmails = await prisma.email.findMany({
      where: { status: 'PENDING' }
    }) as EmailRecord[];

    if (pendingEmails.length === 0) {
      return res.status(200).json({ message: 'No pending emails to send' });
    }

    // Prepare PDF attachments
    const attachments: EmailAttachment[] = [];

    for (const [key, fileArray] of Object.entries(files)) {
      if (key.startsWith('attachment') && Array.isArray(fileArray) && fileArray[0]) {
        const file = fileArray[0] as any;
        
        try {
          // Validate file exists and is a PDF
          if (file.mimetype !== 'application/pdf') {
            return res.status(400).json({ message: 'Only PDF files are allowed' });
          }
          
          if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ message: 'PDF file size must be less than 10MB' });
          }
          
          // Check if file exists before trying to read it
          await fs.access(file.filepath);
          
          // Read the file
          const fileContent = await fs.readFile(file.filepath);
          
          attachments.push({
            filename: file.originalFilename || 'attachment.pdf',
            content: fileContent,
            contentType: 'application/pdf'
          });
          
          filesToDelete.push(file.filepath);
        } catch (error) {
          console.error(`Error processing file ${file.originalFilename}:`, error);
          return res.status(500).json({ 
            message: 'Error processing attachment',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    // Send emails
    const results = await Promise.allSettled(
      pendingEmails.map(emailRecord => 
        sendSingleEmail(emailRecord, subject, content, attachments, transporter)
      )
    );

    // Clean up temporary files - only delete files that exist
    for (const filepath of filesToDelete) {
      try {
        await fs.access(filepath);
        await fs.unlink(filepath);
      } catch (error) {
        console.error(`Failed to delete temporary file ${filepath}:`, error);
      }
    }

    // Calculate statistics
    const successCount = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;
    
    // Send response
    res.status(200).json({
      message: `Successfully sent ${successCount} emails, ${results.length - successCount} failed`,
      results: results.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        return {
          email: pendingEmails[index].emailAddress,
          success: false,
          error: result.reason
        };
      }),
      statistics: {
        total: results.length,
        success: successCount,
        failed: results.length - successCount,
        attachments: attachments.length
      }
    });
  } catch (error) {
    // Clean up temporary files - safely
    for (const filepath of filesToDelete) {
      try {
        await fs.access(filepath);
        await fs.unlink(filepath);
      } catch (error) {
        // Ignore errors when cleaning up
      }
    }

    console.error('Error sending emails:', error);
    res.status(500).json({ 
      message: 'Failed to send emails',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}