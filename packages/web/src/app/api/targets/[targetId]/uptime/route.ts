import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: { targetId: string } }) {
  try {
    const targetId = params.targetId;
    const server = process.env.SERVER_URL || "http://localhost:3000";
    
    // Forward the request to the backend API
    const apiUrl = `${server}/api/targets/${targetId}/uptime`;
    console.log(`Fetching target uptime data from: ${apiUrl}`);
    
    const backendResponse = await fetch(apiUrl, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store"
    });
    
    if (!backendResponse.ok) {
      throw new Error(`Failed to fetch uptime data for target ${targetId}: ${backendResponse.status}`);
    }
    
    // Simply pass through the response from the backend
    const data = await backendResponse.json();
    console.log(`Target uptime data response for ${targetId}:`, data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching target uptime data:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch target uptime data",
      },
      { status: 500 }
    );
  }
}