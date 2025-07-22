import { NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp';

export async function POST(request: Request) {
  try {
    const { name, command, args, env } = await request.json();

    if (!name || !command) {
      return NextResponse.json(
        { error: 'Name and command are required' },
        { status: 400 }
      );
    }

    await mcpManager.connectToServer(name, {
      command,
      args: args || [],
      env: env || {}
    });

    return NextResponse.json({
      success: true,
      message: `Connected to MCP server: ${name}`
    });
  } catch (error) {
    console.error('Failed to connect to MCP server:', error);
    return NextResponse.json(
      { error: 'Failed to connect to MCP server' },
      { status: 500 }
    );
  }
}