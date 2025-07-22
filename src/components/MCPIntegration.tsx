'use client';

import { useState, useEffect } from 'react';
import type { MCPClientConfig } from '@/lib/mcp';

interface MCPServer {
  name: string;
  config: MCPClientConfig;
  connected: boolean;
}

export default function MCPIntegration() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [newServerName, setNewServerName] = useState('');
  const [newServerCommand, setNewServerCommand] = useState('');
  const [newServerArgs, setNewServerArgs] = useState('');
  const [selectedServer, setSelectedServer] = useState('');
  const [resources, setResources] = useState<unknown[]>([]);
  const [toolName, setToolName] = useState('');
  const [toolArgs, setToolArgs] = useState('{}');
  const [toolResult, setToolResult] = useState<unknown>(null);

  const addServer = async () => {
    if (!newServerName || !newServerCommand) return;

    const config: MCPClientConfig = {
      command: newServerCommand,
      args: newServerArgs ? newServerArgs.split(' ') : [],
    };

    try {
      const response = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newServerName,
          command: newServerCommand,
          args: config.args,
          env: config.env
        })
      });

      if (response.ok) {
        setServers(prev => [...prev, {
          name: newServerName,
          config,
          connected: true
        }]);
        setNewServerName('');
        setNewServerCommand('');
        setNewServerArgs('');
      } else {
        const error = await response.json();
        alert(`Failed to connect: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to connect to server:', error);
      alert('Failed to connect to MCP server');
    }
  };

  const disconnectServer = async (serverName: string) => {
    try {
      const response = await fetch('/api/mcp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: serverName })
      });

      if (response.ok) {
        setServers(prev => prev.filter(s => s.name !== serverName));
        if (selectedServer === serverName) {
          setSelectedServer('');
          setResources([]);
        }
      }
    } catch (error) {
      console.error('Failed to disconnect server:', error);
    }
  };

  const listResources = async () => {
    if (!selectedServer) return;

    try {
      const response = await fetch(`/api/mcp/resources?server=${selectedServer}`);
      if (response.ok) {
        const data = await response.json();
        setResources(Array.isArray(data.resources) ? data.resources : []);
      } else {
        setResources([]);
      }
    } catch (error) {
      console.error('Failed to list resources:', error);
      setResources([]);
    }
  };

  const callTool = async () => {
    if (!selectedServer || !toolName) return;

    try {
      const args = JSON.parse(toolArgs);
      const response = await fetch('/api/mcp/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName: selectedServer,
          toolName,
          args
        })
      });

      if (response.ok) {
        const data = await response.json();
        setToolResult(data.result);
      } else {
        const error = await response.json();
        setToolResult({ error: error.error });
      }
    } catch (error) {
      console.error('Failed to call tool:', error);
      setToolResult({ error: error instanceof Error ? error.message : String(error) });
    }
  };

  useEffect(() => {
    return () => {
      servers.forEach(server => {
        fetch('/api/mcp/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: server.name })
        }).catch(console.error);
      });
    };
  }, [servers]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">MCP Integration</h1>
      
      {/* Add Server Section */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Add MCP Server</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Server Name"
            value={newServerName}
            onChange={(e) => setNewServerName(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            placeholder="Command"
            value={newServerCommand}
            onChange={(e) => setNewServerCommand(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            placeholder="Arguments (space-separated)"
            value={newServerArgs}
            onChange={(e) => setNewServerArgs(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <button
          onClick={addServer}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Connect Server
        </button>
      </div>

      {/* Connected Servers */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Connected Servers</h2>
        {servers.length === 0 ? (
          <p className="text-gray-500">No servers connected</p>
        ) : (
          <div className="space-y-2">
            {servers.map((server) => (
              <div key={server.name} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <span className="font-medium">{server.name}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    ({server.config.command})
                  </span>
                  <span className={`ml-2 px-2 py-1 text-xs rounded ${
                    server.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {server.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <button
                  onClick={() => disconnectServer(server.name)}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Server Operations */}
      {servers.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Server Operations</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Server:</label>
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="">Select a server...</option>
              {servers.map((server) => (
                <option key={server.name} value={server.name}>
                  {server.name}
                </option>
              ))}
            </select>
          </div>

          {selectedServer && (
            <>
              {/* List Resources */}
              <div className="mb-6">
                <button
                  onClick={listResources}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mb-4"
                >
                  List Resources
                </button>
                
                {resources.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Available Resources:</h3>
                    <div className="bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
                      <pre className="text-sm">{JSON.stringify(resources, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Call Tool */}
              <div>
                <h3 className="font-medium mb-2">Call Tool</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Tool Name"
                    value={toolName}
                    onChange={(e) => setToolName(e.target.value)}
                    className="border rounded px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Arguments (JSON)"
                    value={toolArgs}
                    onChange={(e) => setToolArgs(e.target.value)}
                    className="border rounded px-3 py-2"
                  />
                </div>
                <button
                  onClick={callTool}
                  className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 mb-4"
                >
                  Call Tool
                </button>

                {toolResult ? (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Tool Result:</h3>
                    <div className="bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
                      <pre className="text-sm">{JSON.stringify(toolResult, null, 2)}</pre>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}