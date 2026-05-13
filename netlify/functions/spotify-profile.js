const CLIENT_ID     = "55165498e55146938faeb24666d5fd40";
const CLIENT_SECRET = "9c5ec319d41a45c79aa8f0d13e030da1";

async function getToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token;
}

function estraiArtistId(url) {
  const match = url.match(/artist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };

  try {
    const { spotifyUrl } = JSON.parse(event.body || "{}");
    if (!spotifyUrl) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "URL mancante" }) };

    const artistId = estraiArtistId(spotifyUrl);
    if (!artistId) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "URL Spotify non valido" }) };

    const token = await getToken();

    const [artistRes, albumsRes] = await Promise.all([
      fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }),
      fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?limit=5&include_groups=album,single&market=IT`, {
        headers: { "Authorization": `Bearer ${token}` },
      }),
    ]);

    const artist = await artistRes.json();
    const albums = await albumsRes.json();

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        nome:      artist.name,
        followers: artist.followers?.total ?? 0,
        immagine:  artist.images?.[0]?.url ?? null,
        generi:    artist.genres ?? [],
        brani:     (albums.items ?? []).slice(0, 5).map(a => ({
          nome:      a.name,
          album:     a.album_type === "single" ? "Singolo" : "Album",
          copertina: a.images?.[1]?.url ?? null,
          url:       a.external_urls?.spotify,
        })),
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
