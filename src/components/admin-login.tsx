"use client";

import { FormEvent, useState } from "react";

export function AdminLogin() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Unable to sign in.");
      return;
    }
    window.location.reload();
  }

  return <form className="admin-login" onSubmit={submit}><h1>WISE coordinator sign-in</h1><label>Shared passcode<input type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} required /></label>{error && <p className="form-error">{error}</p>}<button className="button-primary">Open dashboard</button></form>;
}
