import { NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp';

export async function POST(request: Request) {
  try {
    const { serverName, toolName, args } = await request.json();

    if (!serverName || !toolName) {
      return NextResponse.json(
        { error: 'Server name and tool name are required' },
        { status: 400 }
      );
    }

    const result = await mcpManager.callTool(serverName, toolName, args || {});
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Failed to call tool:', error);
    return NextResponse.json(
      { error: 'Failed to call tool' },
      { status: 500 }
    );
  }
}