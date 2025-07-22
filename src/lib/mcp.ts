export interface MCPClientConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPClient {
  request(method: { method: string }, params: unknown): Promise<unknown>;
  close(): Promise<void>;
}

export class MCPManager {
  private clients: Map<string, MCPClient> = new Map();

  async connectToServer(name: string, config: MCPClientConfig): Promise<MCPClient> {
    if (typeof window === 'undefined') {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      
      try {
        const transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: config.env
        });

        const client = new Client(
          {
            name: `motion-connect-${name}`,
            version: '1.0.0'
          },
          {
            capabilities: {}
          }
        );

        await client.connect(transport);
        this.clients.set(name, client);
        
        return client;
      } catch (error) {
        console.error(`Failed to connect to MCP server ${name}:`, error);
        throw error;
      }
    } else {
      throw new Error('MCP client connections are only available on the server side');
    }
  }

  async disconnectFromServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.close();
      this.clients.delete(name);
    }
  }

  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  async listResources(serverName: string) {
    const client = this.getClient(serverName);
    if (!client) {
      throw new Error(`No client found for server: ${serverName}`);
    }

    try {
      const response = await client.request(
        { method: 'resources/list' },
        {}
      );
      return response;
    } catch (error) {
      console.error(`Failed to list resources from ${serverName}:`, error);
      throw error;
    }
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>) {
    const client = this.getClient(serverName);
    if (!client) {
      throw new Error(`No client found for server: ${serverName}`);
    }

    try {
      const response = await client.request(
        { method: 'tools/call' },
        {
          name: toolName,
          arguments: args
        }
      );
      return response;
    } catch (error) {
      console.error(`Failed to call tool ${toolName} on ${serverName}:`, error);
      throw error;
    }
  }

  async readResource(serverName: string, uri: string) {
    const client = this.getClient(serverName);
    if (!client) {
      throw new Error(`No client found for server: ${serverName}`);
    }

    try {
      const response = await client.request(
        { method: 'resources/read' },
        { uri }
      );
      return response;
    } catch (error) {
      console.error(`Failed to read resource ${uri} from ${serverName}:`, error);
      throw error;
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.keys()).map(name =>
      this.disconnectFromServer(name)
    );
    await Promise.all(disconnectPromises);
  }
}

export const mcpManager = new MCPManager();