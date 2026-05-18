const { google } = require("googleapis");

const PROJECT_ID   = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY  = process.env.FIREBASE_PRIVATE_KEY
  ?.replace(/\\n/g, "\n")
  ?.replace(/^"/, "")
  ?.replace(/"$/, "");

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

    console.log("TOKEN:", token ? token.substring(0, 30) + "..." : "MANCANTE");
    console.log("TITLE:", title);
    console.log("PROJECT_ID:", PROJECT_ID);
    console.log("CLIENT_EMAIL:", CLIENT_EMAIL);
    console.log("PRIVATE_KEY inizio:", PRIVATE_KEY?.substring(0, 50));

    if (!token || !title) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "token e title richiesti" }) };

    const accessToken = await getAccessToken();
    console.log("ACCESS TOKEN ottenuto:", !!accessToken);

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
    console.log("FCM RESPONSE:", JSON.stringify(data));

    if (!res.ok) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: data }) };
    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
  } catch (e) {
    console.log("ERRORE:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
