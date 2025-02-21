import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/utils/prisma';
import { Prisma } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { emails } = req.body;

    if (!Array.isArray(emails)) {
      return res.status(400).json({ message: 'Invalid request body. Expected array of emails.' });
    }

    
    const validEmails = emails.filter(email => 
      email?.emailAddress && 
      typeof email.emailAddress === 'string' &&
      email.emailAddress.includes('@')
    );

    if (validEmails.length === 0) {
      return res.status(400).json({ message: 'No valid email addresses provided' });
    }

   
    const results = await Promise.all(
      validEmails.map(async (email) => {
        try {
          await prisma.email.create({
            data: {
              emailAddress: email.emailAddress,
            },
          });
          return { success: true, email: email.emailAddress };
        } catch (e) {
          const error = e as Prisma.PrismaClientKnownRequestError;
        
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return { success: false, email: email.emailAddress, error: 'Duplicate email address' };
          }
          return { success: false, email: email.emailAddress, error: 'Failed to create email entry' };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.status(200).json({ 
      message: `Successfully processed ${successCount} emails, ${failureCount} failed`,
      results 
    });
  } catch (error) {
    console.error('Error uploading emails:', error);
    res.status(500).json({ message: 'Internal server error while processing emails' });
  }
}