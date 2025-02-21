import { useState } from "react";

export default function TemplateEditor() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const handleSubmit = async () => {
    if (!subject || !body) return;

    const response = await fetch("/api/send-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });

    if (response.ok) {
      console.log("Emails sent successfully");
    } else {
      console.error("Failed to send emails");
    }
  };

  return (
    <div>
      <h2>Email Template</h2>
      <input
        type="text"
        placeholder="Subject (use {{name}})"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <textarea
        rows={5}
        placeholder="Body (use {{name}})"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button onClick={handleSubmit} style={{ marginTop: "1rem" }}>
        Send Emails
      </button>
    </div>
  );
}