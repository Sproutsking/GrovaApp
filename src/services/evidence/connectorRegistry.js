class ConnectorRegistry {
  constructor() {
    this.connectors = new Map();
  }

  register(connector) {
    if (!connector?.provider) {
      throw new Error("Connector must define a provider");
    }

    this.connectors.set(connector.provider, connector);
    return connector;
  }

  unregister(provider) {
    this.connectors.delete(provider);
  }

  get(provider) {
    return this.connectors.get(provider);
  }

  list() {
    return Array.from(this.connectors.values()).map((connector) => ({
      provider: connector.provider,
      label: connector.label,
      supportedTypes: connector.supportedTypes,
      capabilities: connector.capabilities,
    }));
  }
}

export const connectorRegistry = new ConnectorRegistry();

export function registerConnector(connector) {
  return connectorRegistry.register(connector);
}

export function getConnector(provider) {
  return connectorRegistry.get(provider);
}

export function listConnectors() {
  return connectorRegistry.list();
}
