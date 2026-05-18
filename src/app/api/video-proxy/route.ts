import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("id");

  if (!fileId) {
    return new Response("Missing file id", { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  if (!apiKey) {
    return new Response("Missing Google API Key", { status: 500 });
  }

  const googleUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;

  // Forward the Range header from the client to support seeking/scrubbing
  const rangeHeader = request.headers.get("range");
  const headers: HeadersInit = {};
  if (rangeHeader) {
    headers["Range"] = rangeHeader;
  }

  try {
    const response = await fetch(googleUrl, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return new Response(`Failed to fetch from Google: ${response.statusText}`, {
        status: response.status,
      });
    }

    // Forward crucial video stream headers
    const responseHeaders = new Headers();
    
    let contentType = response.headers.get("content-type") || "video/mp4";
    if (contentType === "application/octet-stream" || !contentType.startsWith("video/")) {
      contentType = "video/mp4";
    }
    responseHeaders.set("Content-Type", contentType);
    
    const contentLength = response.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    const contentRange = response.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    const acceptRanges = response.headers.get("accept-ranges") || "bytes";
    responseHeaders.set("Accept-Ranges", acceptRanges);

    // Stream response body directly back to the client browser
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("Video proxy error:", error);
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}
