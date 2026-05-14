const { google } = require("googleapis");

const PROJECT_ID    = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL  = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

async function getAccessToken() {
  const auth = new google.auth.JWT(
    CLIENT_EMAIL,
    null,
    PRIVATE_KEY,
    ["https://www.googleapis.com/auth/firebase.messaging"]
  );
  const token = await auth.authorize();
  return token.access_token;
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };

  try {
    const { token, title, body } = JSON.parse(event.body || "{}");
    if (!token || !title) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "token e title richiesti" }) };

    const accessToken = await getAccessToken();

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body: body ?? "" },
          webpush: {
            notification: {
              title,
              body: body ?? "",
              icon: "https://beatcavebooking.netlify.app/logo.png",
            }
          }
        }
      }),
    });

    const data = await res.json();
    if (!res.ok) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: data }) };

    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
