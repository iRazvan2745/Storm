import { NextResponse } from "next/server";

const server = process.env.SERVER_URL || "http://localhost:3000";

export async function GET() {
  try {
    // Fetch latency data from the server
    const serverResponse = await fetch(`${server}/api/latency`, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store"
    });

    if (!serverResponse.ok) {
      throw new Error(`Failed to fetch latency data: ${serverResponse.status}`);
    }

    const data = await serverResponse.json();
    
    // Return the latency data directly from the server response
    return NextResponse.json({
      success: data.success,
      latencyData: data.latencyData || {}
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to fetch latency data",
      success: false
    }, { status: 500 });
  }
}