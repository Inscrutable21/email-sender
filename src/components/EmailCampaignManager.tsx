// src/components/EmailCampaignManager.tsx
import React, { useState, useEffect } from 'react';
import { Email, EmailStatus } from '@prisma/client';
import { X } from 'lucide-react';

interface EmailType {
  id: string;
  emailAddress: string;
  status: EmailStatus;
  sentAt: Date | null;
}

interface Attachment {
  file: File;
  id: string;
}

const EmailCampaignManager: React.FC = () => {
  const [emails, setEmails] = useState<EmailType[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [template, setTemplate] = useState({
    subject: '',
    content: '',
    attachments: [] as Attachment[]
  });

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/emails');
      if (!response.ok) throw new Error('Failed to fetch emails');
      const data = await response.json();
      setEmails(data.emails);
    } catch (error) {
      console.error('Error fetching emails:', error);
      setNotification({
        type: 'error',
        message: 'Failed to fetch emails'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const rows = text.split('\n');
        const emails = rows
          .map(row => row.trim())
          .filter(row => row && row.includes('@'))
          .map(email => ({ emailAddress: email }));

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ emails })
        });

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();
        setNotification({
          type: 'success',
          message: data.message
        });
        fetchEmails();
      };

      reader.readAsText(file);
    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Failed to upload file'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttachmentAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      file,
      id: Math.random().toString(36).substring(7)
    }));

    // Check total size of all attachments (limit to 25MB total)
    const totalSize = [...template.attachments, ...newAttachments]
      .reduce((sum, att) => sum + att.file.size, 0);

    if (totalSize > 25 * 1024 * 1024) {
      setNotification({
        type: 'error',
        message: 'Total attachments size must be less than 25MB'
      });
      return;
    }

    setTemplate(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments]
    }));
    
    // Reset the input
    e.target.value = '';
  };

  const handleAttachmentRemove = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== id)
    }));
  };

  const handleSendEmails = async () => {
    if (!template.subject || !template.content) {
      setNotification({
        type: 'error',
        message: 'Please provide both subject and content for the email'
      });
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('subject', template.subject);
      formData.append('content', template.content);
      
      // Append all attachments
      template.attachments.forEach((attachment, index) => {
        formData.append(`attachment${index}`, attachment.file);
      });

      const response = await fetch('/api/send-emails', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send emails');
      }

      const data = await response.json();
      setNotification({
        type: 'success',
        message: data.message
      });
      fetchEmails();
      
      // Clear attachments after successful send
      setTemplate(prev => ({ ...prev, attachments: [] }));
    } catch (error) {
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send emails'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold mb-8">Email Campaign Manager</h1>

      {notification && (
        <div className={`p-4 rounded-lg ${
          notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          <p>{notification.message}</p>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Upload Contact List</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-2">Upload a CSV file with email addresses</p>
        </div>
      </div>

      {/* Template Editor Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Email Template</h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Email Subject"
            value={template.subject}
            onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            rows={5}
            placeholder="Email Content"
            value={template.content}
            onChange={(e) => setTemplate({ ...template, content: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          {/* Attachments Section */}
          <div className="border rounded p-4">
            <h3 className="text-sm font-medium mb-2">Attachments</h3>
            <input
              type="file"
              onChange={handleAttachmentAdd}
              multiple
              className="w-full"
            />
            <div className="mt-2 space-y-2">
              {template.attachments.map(attachment => (
                <div key={attachment.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm text-gray-600">{attachment.file.name}</span>
                  <button
                    onClick={() => handleAttachmentRemove(attachment.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">Maximum total size: 25MB</p>
          </div>

          <button
            onClick={handleSendEmails}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send Emails'}
          </button>
        </div>
      </div>

      {/* Email Status Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Email Status</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {emails.map((email) => (
                <tr key={email.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {email.emailAddress}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      email.status === 'SENT' ? 'bg-green-100 text-green-800' :
                      email.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {email.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {email.sentAt ? new Date(email.sentAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmailCampaignManager;