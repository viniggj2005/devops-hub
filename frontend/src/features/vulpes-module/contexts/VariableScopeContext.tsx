import { isRequestTab, useVulpesStore } from '../VulpesStore';
import { buildVariableMap, type VariableMap } from '../functions/Variables';
import { sourceRequestsOf, type SourceRequest } from '../functions/VariableSuggestions';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Collection, HttpResponse, Variable } from '../../../interfaces/VulpesInterfaces';
import ResponseReferenceModal, { type ResponseBuilderOptions } from '../components/modals/ResponseReferenceModal';

export interface VariableScopeValue {
  variables: VariableMap;
  requests: SourceRequest[];
  collectionId: number | null;
  currentItemId: string | null;
  collection: Collection | null;
  responsesByItemId: Record<string, HttpResponse>;
  openResponseBuilder: (options?: ResponseBuilderOptions) => void;
}

const VariableScopeContext = createContext<VariableScopeValue | null>(null);

interface VariableScopeProviderProps {
  children: React.ReactNode;
  collectionId?: number | null;
  currentItemId?: string | null;
  collectionVariablesOverride?: Variable[];
  environmentVariablesOverride?: Variable[];
}

export const VariableScopeProvider: React.FC<VariableScopeProviderProps> = ({
  children,
  collectionId = null,
  currentItemId = null,
  collectionVariablesOverride,
  environmentVariablesOverride,
}) => {
  const tabs = useVulpesStore((state) => state.tabs);
  const runtimes = useVulpesStore((state) => state.runtimes);
  const collections = useVulpesStore((state) => state.collections);
  const environments = useVulpesStore((state) => state.environments);
  const itemResponses = useVulpesStore((state) => state.itemResponses);
  const activeEnvironmentId = useVulpesStore((state) => state.activeEnvironmentId);

  const [builderOptions, setBuilderOptions] = useState<ResponseBuilderOptions | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const collection = useMemo(
    () => (collectionId ? collections.find((candidate) => candidate.id === collectionId) ?? null : null),
    [collections, collectionId]
  );

  const environment = useMemo(
    () => (activeEnvironmentId ? environments.find((candidate) => candidate.id === activeEnvironmentId) ?? null : null),
    [environments, activeEnvironmentId]
  );

  const variables = useMemo(() => {
    const effectiveCollection =
      collection && collectionVariablesOverride
        ? { ...collection, variables: collectionVariablesOverride }
        : collectionVariablesOverride
          ? ({ variables: collectionVariablesOverride } as Collection)
          : collection;
    const effectiveEnvironment =
      environment && environmentVariablesOverride
        ? { ...environment, variables: environmentVariablesOverride }
        : environmentVariablesOverride
          ? ({ variables: environmentVariablesOverride } as typeof environment)
          : environment;
    return buildVariableMap(effectiveCollection, effectiveEnvironment);
  }, [collection, environment, collectionVariablesOverride, environmentVariablesOverride]);

  const requests = useMemo(() => sourceRequestsOf(collection?.items), [collection?.items]);

  const responsesByItemId = useMemo(() => {
    if (!collectionId) return {};
    const mapped: Record<string, HttpResponse> = {};
    const prefix = `${collectionId}:`;
    Object.entries(itemResponses).forEach(([key, response]) => {
      if (key.startsWith(prefix)) {
        mapped[key.slice(prefix.length)] = response;
      }
    });
    tabs.forEach((tab) => {
      if (isRequestTab(tab) && tab.collectionId === collectionId && tab.itemId) {
        const runtimeResponse = runtimes[tab.id]?.httpResponse;
        if (runtimeResponse) mapped[tab.itemId] = runtimeResponse;
      }
    });
    return mapped;
  }, [collectionId, itemResponses, tabs, runtimes]);

  const openResponseBuilder = useCallback((options?: ResponseBuilderOptions) => {
    setBuilderOptions(options ?? null);
    setBuilderOpen(true);
  }, []);

  const value = useMemo<VariableScopeValue>(
    () => ({
      variables,
      requests,
      collection,
      collectionId,
      currentItemId,
      responsesByItemId,
      openResponseBuilder,
    }),
    [variables, requests, collection, collectionId, currentItemId, responsesByItemId, openResponseBuilder]
  );

  return (
    <VariableScopeContext.Provider value={value}>
      {children}
      <ResponseReferenceModal
        isOpen={builderOpen}
        requests={requests}
        collection={collection}
        options={builderOptions}
        currentItemId={currentItemId}
        responsesByItemId={responsesByItemId}
        onClose={() => setBuilderOpen(false)}
      />
    </VariableScopeContext.Provider>
  );
};

const noopOpenBuilder = () => undefined;

export const useVariableScope = (overrideVariables?: VariableMap): VariableScopeValue => {
  const context = useContext(VariableScopeContext);
  const collections = useVulpesStore((state) => state.collections);
  const environments = useVulpesStore((state) => state.environments);
  const activeTabId = useVulpesStore((state) => state.activeTabId);
  const tabs = useVulpesStore((state) => state.tabs);
  const activeEnvironmentId = useVulpesStore((state) => state.activeEnvironmentId);

  return useMemo(() => {
    if (context) {
      return overrideVariables ? { ...context, variables: overrideVariables } : context;
    }
    const activeTab = tabs.find((candidate) => candidate.id === activeTabId);
    const collectionId = activeTab?.collectionId ?? null;
    const currentItemId = isRequestTab(activeTab) ? activeTab.itemId : null;
    const collection = collectionId ? collections.find((candidate) => candidate.id === collectionId) ?? null : null;
    const environment = activeEnvironmentId ? environments.find((candidate) => candidate.id === activeEnvironmentId) ?? null : null;
    const variables = overrideVariables ?? buildVariableMap(collection, environment);
    const requests = sourceRequestsOf(collection?.items);
    return {
      variables,
      requests,
      collection,
      collectionId,
      currentItemId,
      responsesByItemId: {},
      openResponseBuilder: noopOpenBuilder,
    };
  }, [context, overrideVariables, collections, environments, activeTabId, tabs, activeEnvironmentId]);
};

