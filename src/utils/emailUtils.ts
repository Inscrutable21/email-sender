export interface EmailTemplate {
    subject: string;
    body: string;
  }
  
  export const parseTemplate = (template: EmailTemplate, data: Record<string, string>): EmailTemplate => {
    let parsedSubject = template.subject;
    let parsedBody = template.body;
  
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      parsedSubject = parsedSubject.replace(placeholder, value || '');
      parsedBody = parsedBody.replace(placeholder, value || '');
    });
  
    return {
      subject: parsedSubject,
      body: parsedBody
    };
  };
  
  export const validateTemplate = (template: EmailTemplate): string[] => {
    const errors: string[] = [];
  
    if (!template.subject.trim()) {
      errors.push('Subject is required');
    }
    if (!template.body.trim()) {
      errors.push('Body is required');
    }
  
    // Check for valid placeholder syntax
    const placeholderRegex = /{{([^{}]+)}}/g;
    const subjectPlaceholders = [...template.subject.matchAll(placeholderRegex)];
    const bodyPlaceholders = [...template.body.matchAll(placeholderRegex)];
  
    const allPlaceholders = new Set([
      ...subjectPlaceholders.map(match => match[1]),
      ...bodyPlaceholders.map(match => match[1])
    ]);
  
    // Validate that only supported placeholders are used
    const supportedPlaceholders = ['name', 'company', 'position'];
    allPlaceholders.forEach(placeholder => {
      if (!supportedPlaceholders.includes(placeholder)) {
        errors.push(`Unsupported placeholder: {{${placeholder}}}`);
      }
    });
  
    return errors;
  };