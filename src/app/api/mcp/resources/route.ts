import { NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serverName = searchParams.get('server');

  if (!serverName) {
    return NextResponse.json(
      { error: 'Server name is required' },
      { status: 400 }
    );
  }

  try {
    const resources = await mcpManager.listResources(serverName);
    return NextResponse.json({ resources });
  } catch (error) {
    console.error('Failed to list resources:', error);
    return NextResponse.json(
      { error: 'Failed to list resources' },
      { status: 500 }
    );
  }
}