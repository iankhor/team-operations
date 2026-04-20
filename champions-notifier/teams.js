export async function postToTeams(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Teams webhook failed: ${res.status} ${res.statusText}\n${body}`,
    );
  }
  return res.status;
}
