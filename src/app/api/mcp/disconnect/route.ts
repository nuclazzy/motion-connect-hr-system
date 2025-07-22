import { NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp';

export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Server name is required' },
        { status: 400 }
      );
    }

    await mcpManager.disconnectFromServer(name);

    return NextResponse.json({
      success: true,
      message: `Disconnected from MCP server: ${name}`
    });
  } catch (error) {
    console.error('Failed to disconnect from MCP server:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect from MCP server' },
      { status: 500 }
    );
  }
}