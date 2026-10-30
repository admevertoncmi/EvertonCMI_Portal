import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("id");

  if (!fileId) {
    return new Response("Missing file id", { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("NEXT_PUBLIC_GOOGLE_API_KEY não configurada");
    return new Response("Google API key not configured", { status: 500 });
  }

  const googleUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;

  const rangeHeader = request.headers.get("range");

  try {
    const headers: HeadersInit = {};
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const response = await fetch(googleUrl, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return new Response(`Failed to fetch from Google`, { status: response.status });
    }

    // Read only the requested chunk as an arrayBuffer
    const data = await response.arrayBuffer();

    const responseHeaders = new Headers();
    // Force video/mp4 for mobile browser compatibility
    responseHeaders.set("Content-Type", "video/mp4");
    responseHeaders.set("Accept-Ranges", "bytes");

    const contentRange = response.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }
    
    responseHeaders.set("Content-Length", data.byteLength.toString());

    // Return a static buffer response with status 206 (Partial Content) for seeking/iOS WebKit
    return new Response(data, {
      status: rangeHeader ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("Video proxy error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
